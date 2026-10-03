// Site renderer for system-docs. Reads data/keybinds.json and
// content/guides/*.md, then writes:
//   dist/index.html            - landing page (hero + search + app cards + guides)
//   dist/apps/<id>.html        - keybinding pages (DOM contract in SPEC.md)
//   dist/guides/<slug>.html    - markdown guides with TOC
//   dist/404.html              - Nord-styled not-found page (absolute Pages base)
//   dist/assets/bindings.json  - compact index for the landing-page lookup
// Runs from the repo root (esbuild-bundled + spawned by scripts/build.mjs).
//
// Honesty checks (hard failures, see SPEC "Guide reference checks"):
//   - every `guide` slug on an app and every `app` id on a guide must exist
//   - every key chord in a guide's code spans must be a bind in the data
//   - every nixos_config path in a guide must exist in the local checkout
//     (skipped with a notice when there is no checkout, e.g. in CI)

import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import MarkdownIt from "markdown-it";
import { esc, kbdChips, page, rowIdBase } from "./templates";

/** GitHub Pages serves the site under this base; only 404.html needs it. */
const SITE_BASE = "/system-docs/";
const REPO_URL = "https://github.com/krsmrk/nixos_config";
/** Local nixos_config checkout for the guide path check (env override). */
const NIXOS_CONFIG_DIR = process.env.NIXOS_CONFIG ?? join(homedir(), "nixos_config");

// ---------------------------------------------------------------------------
// data schema: data/keybinds.json
// ---------------------------------------------------------------------------

interface Binding {
  keys: string;
  label: string;
  command?: string;
  source?: string;
  /** True when this bind comes from the machine's own config (vs stock default). */
  custom?: boolean;
}

interface BindingGroup {
  name: string;
  /** Optional crafted prose explaining the group's design intent. */
  description?: string;
  bindings: Binding[];
}

interface App {
  id: string;
  title: string;
  tagline: string;
  description: string;
  icon: string;
  guide?: string;
  groups: BindingGroup[];
}

interface SiteMeta {
  generatedAt: string;
  sourceCommit: string;
  host: string;
}

interface KeybindsFile {
  meta: SiteMeta;
  apps: App[];
}

// ---------------------------------------------------------------------------
// guide model: content/guides/*.md
// ---------------------------------------------------------------------------

interface TocEntry {
  level: 2 | 3;
  slug: string;
  text: string;
}

interface GuideDoc {
  file: string;
  slug: string;
  title: string;
  summary: string;
  order: number;
  /** Related app id (front matter `app`) - preferred target for key refs. */
  app?: string;
  /** nixos_config commit the prose was last reviewed against (front matter `verified`). */
  verified?: string;
  /** Chords exempt from the key-ref check (front matter `ignore-keys`, comma-separated). */
  ignoreKeys: Set<string>;
  /** Last git commit date (YYYY-MM-DD), or the file's mtime when untracked. */
  updated: string;
  /** Markdown body (front matter stripped). */
  markdown: string;
  /** Final article HTML (anchored headings, h1 injected when absent). */
  html: string;
  toc: TocEntry[];
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** Landing-page card order (SPEC "Build pipeline"); unknown ids sort last. */
const APP_ORDER = ["keyd", "niri", "waybar", "qutebrowser", "fuzzel", "ghostty", "tmux", "yazi", "zathura", "zsh"];

// Consistent inline-SVG icons (24px, stroke style, currentColor). The data
// schema's `icon` glyph remains the fallback for ids not listed here.
const S = (inner: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const APP_SVG: Record<string, string> = {
  niri: S('<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="9.5" y="4" width="5" height="16" rx="1"/><rect x="16" y="4" width="5" height="16" rx="1"/>'),
  waybar: S('<rect x="2.5" y="5.5" width="19" height="3.4" rx="1.7" fill="currentColor" stroke="none"/><rect x="2.5" y="12" width="5.5" height="2.6" rx="1.3" fill="currentColor" stroke="none" opacity="0.5"/><rect x="9.3" y="12" width="5.5" height="2.6" rx="1.3" fill="currentColor" stroke="none" opacity="0.5"/><rect x="16" y="12" width="5.5" height="2.6" rx="1.3" fill="currentColor" stroke="none" opacity="0.5"/>'),
  fuzzel: S('<circle cx="10" cy="10" r="6.5"/><line x1="14.8" y1="14.8" x2="20.6" y2="20.6" stroke-width="2.2"/>'),
  ghostty: S('<rect x="2.5" y="4" width="19" height="16" rx="2"/><path d="M7 9.5l3 2.5-3 2.5"/><line x1="12.5" y1="14.5" x2="17.5" y2="14.5"/>'),
  tmux: S('<rect x="3" y="4.5" width="18" height="15" rx="2"/><line x1="12" y1="4.5" x2="12" y2="19.5"/><line x1="12" y1="11.75" x2="21" y2="11.75"/>'),
  qutebrowser: S('<circle cx="12" cy="12" r="8.5"/><ellipse cx="12" cy="12" rx="3.8" ry="8.5"/><line x1="3.5" y1="12" x2="20.5" y2="12"/>'),
  yazi: S('<path d="M3 6.5a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
  zathura: S('<path d="M6 3h8l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M13.5 3v5h5"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="16.5" x2="14" y2="16.5"/>'),
  keyd: S('<rect x="2.5" y="6.5" width="19" height="11" rx="2"/><line x1="6" y1="9.5" x2="9" y2="9.5"/><line x1="11" y1="9.5" x2="13" y2="9.5"/><line x1="15" y1="9.5" x2="18" y2="9.5"/><line x1="6" y1="12.5" x2="18" y2="12.5"/><line x1="6" y1="15" x2="9" y2="15"/><line x1="11" y1="15" x2="13" y2="15"/><line x1="15" y1="15" x2="18" y2="15"/>'),
  zsh: S('<path d="M5 7l6 5-6 5"/><line x1="13.5" y1="17.5" x2="20" y2="17.5" stroke-width="2.2"/>'),
};

function appIcon(app: App): string {
  return APP_SVG[app.id] ?? esc(app.icon);
}

function fail(msg: string): never {
  console.error(`build: fatal: ${msg}`);
  process.exit(1);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isStr(v: unknown): v is string {
  return typeof v === "string";
}

function countBindings(app: App): number {
  return app.groups.reduce((n, g) => n + g.bindings.length, 0);
}

function countCustom(app: App): number {
  return app.groups.reduce((n, g) => n + g.bindings.filter((b) => b.custom === true).length, 0);
}

/** JSON for <script type="application/json"> - `<` and friends made html-safe. */
function jsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll(" ", "\\u2028")
    .replaceAll(" ", "\\u2029");
}

// ---------------------------------------------------------------------------
// validation of data/keybinds.json
// ---------------------------------------------------------------------------

function validateKeybinds(raw: unknown): KeybindsFile {
  if (!isRecord(raw)) fail("data/keybinds.json: root must be an object");

  const metaRaw = raw.meta;
  if (!isRecord(metaRaw)) fail('data/keybinds.json: "meta" must be an object');
  for (const k of ["generatedAt", "sourceCommit", "host"] as const) {
    if (!isStr(metaRaw[k])) fail(`data/keybinds.json: meta.${k} must be a string`);
  }
  const meta: SiteMeta = {
    generatedAt: metaRaw.generatedAt as string,
    sourceCommit: metaRaw.sourceCommit as string,
    host: metaRaw.host as string,
  };

  if (!Array.isArray(raw.apps)) fail('data/keybinds.json: "apps" must be an array');

  const apps: App[] = (raw.apps as unknown[]).map((entry, ai) => {
    const where = `apps[${ai}]`;
    if (!isRecord(entry)) fail(`${where}: must be an object`);
    for (const k of ["id", "title", "tagline", "description", "icon"] as const) {
      if (!isStr(entry[k]) || (entry[k] as string).length === 0)
        fail(`${where}: missing or empty "${k}"`);
    }
    const id = entry.id as string;
    if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) fail(`${where}: id "${id}" must be kebab-case`);
    if (entry.guide !== undefined && !isStr(entry.guide))
      fail(`${where}: "guide" must be a string`);
    if (!Array.isArray(entry.groups)) fail(`${where}: "groups" must be an array`);

    const groups: BindingGroup[] = (entry.groups as unknown[]).map((grp, gi) => {
      const gwhere = `${where}.groups[${gi}]`;
      if (!isRecord(grp)) fail(`${gwhere}: must be an object`);
      if (!isStr(grp.name) || grp.name.length === 0)
        fail(`${gwhere}: missing or empty "name"`);
      if (!Array.isArray(grp.bindings)) fail(`${gwhere}: "bindings" must be an array`);

      const bindings: Binding[] = (grp.bindings as unknown[]).map((bnd, bi) => {
        const bwhere = `${gwhere}.bindings[${bi}]`;
        if (!isRecord(bnd)) fail(`${bwhere}: must be an object`);
        const { keys, label, command, source, custom } = bnd;
        if (!isStr(label) || label.trim() === "")
          fail(`${bwhere}: every binding needs a non-empty "label"`);
        if (!isStr(keys))
          fail(`${bwhere}: every binding needs a "keys" string (empty allowed only when "command" is present) - label: "${label}"`);
        if (keys === "" && !(isStr(command) && command.trim() !== ""))
          fail(`${bwhere}: keys may be "" only when "command" is present - label: "${label}"`);
        if (command !== undefined && !isStr(command))
          fail(`${bwhere}: "command" must be a string`);
        if (source !== undefined && !isStr(source))
          fail(`${bwhere}: "source" must be a string`);
        if (custom !== undefined && typeof custom !== "boolean")
          fail(`${bwhere}: "custom" must be a boolean`);
        return { keys, label, command, source, custom };
      });
      if (grp.description !== undefined && !isStr(grp.description))
        fail(`${gwhere}: "description" must be a string`);
      return { name: grp.name, description: grp.description as string | undefined, bindings };
    });

    return {
      id,
      title: entry.title as string,
      tagline: entry.tagline as string,
      description: entry.description as string,
      icon: entry.icon as string,
      guide: entry.guide as string | undefined,
      groups,
    };
  });

  const ids = new Set<string>();
  for (const app of apps) {
    if (ids.has(app.id)) fail(`duplicate app id "${app.id}"`);
    ids.add(app.id);
  }

  return { meta, apps };
}

// ---------------------------------------------------------------------------
// row anchors: one stable id per binding row, first occurrence wins the
// bare id, repeats (qutebrowser binds the same keys in several modes) get
// "-2", "-3"… - so a guide's key reference lands on the first row.
// ---------------------------------------------------------------------------

interface RowIndex {
  /** rowIds[groupIndex][bindingIndex] */
  rowIds: string[][];
  /** keys → id of the first row with those keys */
  firstByKeys: Map<string, string>;
}

function indexRows(app: App): RowIndex {
  const used = new Map<string, number>();
  const firstByKeys = new Map<string, string>();
  const rowIds = app.groups.map((g) =>
    g.bindings.map((b) => {
      const base = rowIdBase(b.keys);
      const n = (used.get(base) ?? 0) + 1;
      used.set(base, n);
      const id = n === 1 ? base : `${base}-${n}`;
      if (!firstByKeys.has(b.keys)) firstByKeys.set(b.keys, id);
      return id;
    }),
  );
  return { rowIds, firstByKeys };
}

// ---------------------------------------------------------------------------
// markdown guides
// ---------------------------------------------------------------------------

const md = new MarkdownIt({ html: false, linkify: false });

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function decodeEntities(s: string): string {
  return s
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&#039;", "'")
    .replaceAll("&nbsp;", " ");
}

/**
 * Inject id attributes on rendered <h2>/<h3> (slugified text, deduped) and
 * collect them as TOC entries.
 */
function injectHeadingAnchors(html: string): { html: string; toc: TocEntry[] } {
  const seen = new Map<string, number>();
  const toc: TocEntry[] = [];
  const out = html.replace(
    /<h([23])(\s[^>]*)?>([\s\S]*?)<\/h\1>/g,
    (_match: string, lvl: string, attrs: string | undefined, inner: string) => {
      const level: 2 | 3 = lvl === "2" ? 2 : 3;
      const text = decodeEntities(inner.replace(/<[^>]*>/g, "")).trim();
      let slug = slugify(text);
      if (slug === "") slug = "section";
      const count = seen.get(slug) ?? 0;
      seen.set(slug, count + 1);
      if (count > 0) slug = `${slug}-${count + 1}`;
      toc.push({ level, slug, text });
      return `<h${level} id="${slug}"${attrs ?? ""}>${inner}</h${level}>`;
    },
  );
  return { html: out, toc };
}

/** Hand-rolled front-matter parser: ---\nkey: value\n---, quotes stripped. */
function parseFrontMatter(raw: string): { fields: Record<string, string>; body: string } | null {
  const text = raw.replace(/\r\n/g, "\n");
  const m = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(text);
  if (m === null) return null;
  const fields: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i <= 0) continue;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if (
      value.length >= 2 &&
      (value.startsWith('"') || value.startsWith("'")) &&
      value.endsWith(value[0])
    ) {
      value = value.slice(1, -1);
    }
    fields[key] = value;
  }
  return { fields, body: text.slice(m[0].length) };
}

/** Last commit date of a file (YYYY-MM-DD); mtime for untracked files. */
function lastUpdated(root: string, file: string): string {
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%cs", "--", file], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(out)) return out;
  } catch {
    /* no git - fall through */
  }
  return statSync(file).mtime.toISOString().slice(0, 10);
}

async function loadGuides(root: string): Promise<GuideDoc[]> {
  const dir = join(root, "content/guides");
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".md")).sort();
  } catch {
    return []; // no content/guides dir yet - index shows the empty state
  }
  const docs: GuideDoc[] = [];
  for (const [i, file] of files.entries()) {
    const path = join(dir, file);
    const raw = await readFile(path, "utf8");
    const fm = parseFrontMatter(raw);
    const fields = fm?.fields ?? {};
    const title = isStr(fields.title) && fields.title !== "" ? fields.title : basename(file, ".md");
    const slug = slugify(fields.slug ?? "") || slugify(basename(file, ".md"));
    const parsedOrder = Number(fields.order);
    const order = Number.isFinite(parsedOrder) ? parsedOrder : 1e9 + i;
    const summary = fields.summary ?? "";
    const app = fields.app !== undefined && fields.app !== "" ? fields.app : undefined;
    const verified = fields.verified !== undefined && fields.verified !== "" ? fields.verified : undefined;
    if (verified !== undefined && !/^[0-9a-f]{7,40}$/.test(verified))
      fail(`content/guides/${file}: "verified" must be a nixos_config commit hash, got "${verified}"`);
    const ignoreKeys = new Set(
      (fields["ignore-keys"] ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s !== ""),
    );
    const markdown = fm?.body ?? raw;

    const anchored = injectHeadingAnchors(md.render(markdown));
    const article = /<h1[\s>]/.test(anchored.html)
      ? anchored.html
      : `<h1>${esc(title)}</h1>\n${anchored.html}`;
    docs.push({
      file: `content/guides/${file}`,
      slug,
      title,
      summary,
      order,
      app,
      verified,
      ignoreKeys,
      updated: lastUpdated(root, path),
      markdown,
      html: article,
      toc: anchored.toc,
    });
  }
  docs.sort((a, b) => a.order - b.order);
  const slugs = new Set<string>();
  for (const d of docs) {
    if (slugs.has(d.slug)) fail(`${d.file}: duplicate guide slug "${d.slug}"`);
    slugs.add(d.slug);
  }
  return docs;
}

// ---------------------------------------------------------------------------
// guide reference checks: key chords and nixos_config paths
// ---------------------------------------------------------------------------

const MOD_ALIASES: Record<string, string> = {
  mod: "Mod", super: "Mod", win: "Mod", logo: "Mod",
  ctrl: "Ctrl", control: "Ctrl",
  alt: "Alt", meta: "Alt",
  shift: "Shift",
};
const MOD_ORDER = ["Mod", "Ctrl", "Alt", "Shift"];
const KEY_ALIASES: Record<string, string> = {
  "[": "BracketLeft", "]": "BracketRight", "-": "Minus", "=": "Equal",
  ",": "Comma", ".": "Period", ";": "Semicolon", "'": "Quote", "/": "Slash",
  "\\": "Backslash", "`": "Grave",
  esc: "Escape", enter: "Return", del: "Delete", ins: "Insert",
  pgup: "PageUp", pgdn: "PageDown", bksp: "Backspace",
};

/** Is this code span a key chord the data could know? Pseudo-keys count too. */
function looksLikeChord(text: string): boolean {
  if (/^(Mouse|Scroll|Wheel) [A-Za-z]+( [A-Za-z]+)?$/.test(text)) return true;
  if (/[\/…*<>(){}|]/.test(text)) return false; // "Mod+H/L", "Mod+1…9" are shorthand
  return /^((Mod|Ctrl|Alt|Shift|Super|Meta|Win|Control)\+)+[^\s+]+(\s[^\s]+)*$/i.test(text);
}

/** Canonical spelling candidates for a chord as a guide author wrote it. */
function chordCandidates(text: string): string[] {
  if (/^(Mouse|Scroll|Wheel) /.test(text)) return [text];
  const steps = text.trim().split(/\s+/);
  const canon = steps.map((step) => {
    const parts = step.split("+").filter((p) => p !== "");
    const mods: string[] = [];
    let key = "";
    for (const p of parts) {
      const m = MOD_ALIASES[p.toLowerCase()];
      if (m) mods.push(m);
      else key = p;
    }
    // "Mod+=" / "Mod++" lose their key to the split
    if (key === "" && /\+[=+]$/.test(step)) key = step.slice(-1);
    mods.sort((a, b) => MOD_ORDER.indexOf(a) - MOD_ORDER.indexOf(b));
    const alias = KEY_ALIASES[key] ?? KEY_ALIASES[key.toLowerCase()];
    if (alias) key = alias;
    else if (/^xf86/i.test(key)) key = key;
    else if (key.length > 1 && /^[a-z]/.test(key)) key = key[0].toUpperCase() + key.slice(1);
    return { mods, key };
  });
  const render = (caseFn: (k: string) => string): string =>
    canon.map(({ mods, key }) => [...mods, key.length === 1 ? caseFn(key) : key].join("+")).join(" ");
  // the raw spelling first: character-keyed apps (tmux) store "," or "[" as
  // written, not the XKB names niri uses
  const variants = [text.trim(), render((k) => k), render((k) => k.toUpperCase()), render((k) => k.toLowerCase())];
  return [...new Set(variants)];
}

interface KeyIndex {
  apps: Map<string, { title: string; rows: RowIndex }>;
}

/** Resolve a chord to {app, rowId}; prefer the guide's app; null when unbound. */
function resolveChord(
  text: string,
  index: KeyIndex,
  preferApp: string | undefined,
): { app: string; rowId: string } | "ambiguous" | null {
  const candidates = chordCandidates(text);
  const tryApp = (appId: string, exact: boolean): string | null => {
    const entry = index.apps.get(appId);
    if (!entry) return null;
    for (const c of candidates) {
      const hit = entry.rows.firstByKeys.get(c);
      if (hit) return hit;
    }
    if (!exact) {
      const lower = candidates.map((c) => c.toLowerCase());
      for (const [keys, id] of entry.rows.firstByKeys)
        if (lower.includes(keys.toLowerCase())) return id;
    }
    return null;
  };
  if (preferApp) {
    const id = tryApp(preferApp, true) ?? tryApp(preferApp, false);
    if (id) return { app: preferApp, rowId: id };
  }
  const hits: { app: string; rowId: string }[] = [];
  for (const appId of index.apps.keys()) {
    if (appId === preferApp) continue;
    const id = tryApp(appId, true) ?? tryApp(appId, false);
    if (id) hits.push({ app: appId, rowId: id });
  }
  if (hits.length === 1) return hits[0];
  if (hits.length > 1) return "ambiguous";
  return null;
}

/**
 * Check every chord-looking <code> span of a guide against the data and
 * link the ones that resolve to exactly one app page row. Spans inside an
 * existing <a> are left alone (no nested anchors).
 */
function linkKeyRefs(doc: GuideDoc, index: KeyIndex, problems: string[]): string {
  const segments = doc.html.split(/(<a\b[^>]*>[\s\S]*?<\/a>)/g);
  return segments
    .map((seg, i) => {
      if (i % 2 === 1) return seg; // inside <a>…</a>
      return seg.replace(/<code>([^<]+)<\/code>/g, (whole: string, inner: string) => {
        const text = decodeEntities(inner);
        if (!looksLikeChord(text)) return whole;
        if (doc.ignoreKeys.has(text)) return whole;
        const hit = resolveChord(text, index, doc.app);
        if (hit === null) {
          problems.push(
            `${doc.file}: \`${text}\` is not a bind in any app (fix the spelling, or list it under ignore-keys: in the front matter)`,
          );
          return whole;
        }
        if (hit === "ambiguous") return whole; // valid, but no unique page to link
        return `<a class="kb-ref" href="../apps/${esc(hit.app)}.html#${esc(hit.rowId)}">${whole}</a>`;
      });
    })
    .join("");
}

const REPO_PATH_HEADS = /^(modules|hosts|scripts|home|lib|templates)\//;
const REPO_ROOT_FILES = new Set(["flake.nix", "flake.lock", "justfile", "README.md", "treefmt.nix"]);

/** nixos_config-relative paths a guide mentions (code spans and GitHub blob links). */
function repoPathsIn(markdown: string): string[] {
  const out = new Set<string>();
  const consider = (raw: string): void => {
    let p = raw.trim();
    if (/[\s<>*{}$()|…]/.test(p)) return; // globs, placeholders, prose
    p = p.replace(/^(~|\/home\/[a-z]+)\/nixos_config\//, "").replace(/^nixos_config\//, "");
    p = p.replace(/#.*$/, "").replace(/:\d+$/, "").replace(/\/+$/, "");
    if (REPO_PATH_HEADS.test(p) || REPO_ROOT_FILES.has(p)) out.add(p);
  };
  for (const m of markdown.matchAll(/`([^`\n]+)`/g)) consider(m[1]);
  for (const m of markdown.matchAll(/github\.com\/krsmrk\/nixos_config\/(?:blob|tree)\/[^/\s)]+\/([^\s)#]+)/g))
    consider(m[1]);
  return [...out];
}

function checkRepoPaths(docs: GuideDoc[], problems: string[]): void {
  if (!existsSync(NIXOS_CONFIG_DIR)) {
    console.log(`  (no nixos_config checkout at ${NIXOS_CONFIG_DIR} - path check skipped; set NIXOS_CONFIG to run it)`);
    return;
  }
  let checked = 0;
  for (const doc of docs) {
    for (const p of repoPathsIn(doc.markdown)) {
      checked++;
      if (!existsSync(join(NIXOS_CONFIG_DIR, p)))
        problems.push(`${doc.file}: path \`${p}\` does not exist in ${NIXOS_CONFIG_DIR}`);
    }
  }
  console.log(`  path check: ${checked} nixos_config paths verified against ${NIXOS_CONFIG_DIR}`);
}

// ---------------------------------------------------------------------------
// page bodies
// ---------------------------------------------------------------------------

function originSummary(app: App): string {
  const total = countBindings(app);
  const custom = countCustom(app);
  if (custom === total) return "all custom";
  if (custom === 0) return "stock defaults";
  return `${custom} custom · ${total - custom} stock`;
}

function renderIndexBody(data: KeybindsFile, guides: GuideDoc[]): string {
  const ranked = data.apps
    .map((app, i) => {
      const canonical = APP_ORDER.indexOf(app.id);
      return { app, rank: canonical === -1 ? APP_ORDER.length + i : canonical };
    })
    .sort((a, b) => a.rank - b.rank);

  const totalBindings = data.apps.reduce((n, a) => n + countBindings(a), 0);

  const cards = ranked
    .map(({ app }) => {
      const total = countBindings(app);
      return `    <a class="app-card" href="apps/${esc(app.id)}.html">
      <span class="card-icon" aria-hidden="true">${appIcon(app)}</span>
      <h3>${esc(app.title)}</h3>
      <p class="tagline">${esc(app.tagline)}</p>
      <div class="card-meta"><span class="count">${total} ${total === 1 ? "binding" : "bindings"}</span><span>${esc(originSummary(app))}</span></div>
    </a>`;
    })
    .join("\n");

  const guideItems =
    guides.length === 0
      ? "    <p>Guides coming soon.</p>"
      : guides
          .map(
            (g) =>
              `    <a href="guides/${esc(g.slug)}.html">${esc(g.title)} <span class="g-summary">${esc(g.summary)}</span><span class="g-date" title="last updated">${esc(g.updated)}</span></a>`,
          )
          .join("\n");

  const genDate = data.meta.generatedAt.slice(0, 10);
  return `<div class="hero">
  <h1>Keybindings and guides for ${esc(data.meta.host)}</h1>
  <p class="hero-sub">Cheat sheets are generated from the live NixOS configuration. Guides are hand-written and checked against it at build time.</p>
  <p class="hero-stats">
    <span class="stat"><strong>${totalBindings}</strong> bindings</span>
    <span class="stat"><strong>${data.apps.length}</strong> apps</span>
    <span class="stat"><strong>${guides.length}</strong> guides</span>
    <span class="stat dim">bindings as of ${esc(genDate)}</span>
  </p>
</div>

<div class="site-search">
  <input class="kb-search" type="search" placeholder="What does Ctrl+R do? Look up a key or action across every layer… (press /)" aria-label="Search all bindings" autocomplete="off">
  <span class="kb-counter" aria-live="polite"></span>
</div>
<div class="sr-list" hidden></div>

<div class="card-grid">
${cards}
</div>

<h2 id="guides">Guides</h2>
<div class="guide-list">
${guideItems}
</div>`;
}

/** Provenance hint for sources that are not repo files (generated or yadm-managed). */
const SOURCE_HINTS: Record<string, string> = {
  "config.kdl": "~/.config/niri/config.kdl - generated from modules/home/niri.nix",
  "default.conf": "~/.config/keyd/default.conf",
  "tmux.conf": "~/.config/tmux/tmux.conf (yadm)",
  "keymap.toml": "~/.config/yazi/keymap.toml (yadm)",
  ".zshrc": "~/.zshrc (yadm)",
};

function renderSource(source: string, commit: string): string {
  const m = /^(.*):(\d+)$/.exec(source);
  const file = m ? m[1] : source;
  const line = m ? m[2] : null;
  if (REPO_PATH_HEADS.test(file)) {
    const href = `${REPO_URL}/blob/${encodeURIComponent(commit)}/${file}${line ? `#L${line}` : ""}`;
    return `<a href="${esc(href)}" title="open in nixos_config @ ${esc(commit)}">${esc(source)}</a>`;
  }
  const hint = SOURCE_HINTS[file] ?? file;
  return `<span title="${esc(hint)}">${esc(source)}</span>`;
}

function renderRow(b: Binding, rowId: string, commit: string): string {
  const sourceCell =
    b.source !== undefined
      ? `\n      <td class="kb-source">${renderSource(b.source, commit)}</td>`
      : "";
  const cmdAttr = b.command !== undefined ? ` data-cmd="${esc(b.command.toLowerCase())}"` : "";
  return `    <tr class="kb-row${b.custom === true ? " custom" : ""}" id="${esc(rowId)}" data-keys="${esc(b.keys)}"${cmdAttr}>
      <td class="kb-keys">${kbdChips(b.keys)}</td>
      <td class="kb-label">${esc(b.label)}</td>
      <td class="kb-command">${b.command !== undefined ? `<code>${esc(b.command)}</code>` : ""}</td>${sourceCell}
    </tr>`;
}

function renderAppBody(
  app: App,
  rows: RowIndex,
  guideBySlug: ReadonlyMap<string, GuideDoc>,
  commit: string,
): string {
  const related = app.guide !== undefined ? guideBySlug.get(app.guide) : undefined;
  const relatedGuide = related
    ? `\n  <p class="related-guide"><a class="chip-link" href="../guides/${esc(related.slug)}.html">guide → ${esc(related.title)}</a></p>`
    : "";

  const total = countBindings(app);
  const customCount = countCustom(app);
  const legend =
    customCount === total
      ? "All binds on this page are custom - bound in this config."
      : customCount === 0
        ? "All binds on this page are stock defaults; none are customized."
        : "accent-bordered key chips = custom (this config) · plain chips = stock default";

  const header = `<div class="app-header">
  <h1><span class="app-icon" aria-hidden="true">${appIcon(app)}</span> ${esc(app.title)}</h1>
  <p class="tagline">${esc(app.tagline)}</p>
  <p class="app-desc">${esc(app.description)}</p>${relatedGuide}
  <p class="origin-legend">${legend}</p>
</div>`;

  const tocChips = app.groups
    .map(
      (g, i) =>
        `  <a class="toc-chip" href="#g-${i}">${esc(g.name)} <span class="chip-count">${g.bindings.length}</span></a>`,
    )
    .join("\n");

  const groups = app.groups
    .map(
      (g, i) => `<section class="kb-group" id="g-${i}">
  <h3>${esc(g.name)} <span class="group-count">${g.bindings.length}</span></h3>
${g.description !== undefined ? `  <p class="group-desc">${esc(g.description)}</p>\n` : ""}<table class="kb-table"><tbody>
${g.bindings.map((b, bi) => renderRow(b, rows.rowIds[i][bi], commit)).join("\n")}
  </tbody></table>
</section>`,
    )
    .join("\n\n");

  return `${header}

<div class="filter-bar">
  <input class="kb-filter" type="search" placeholder="Filter by key, action or command… (press /)" aria-label="Filter bindings">
  <span class="kb-counter">${total} ${total === 1 ? "binding" : "bindings"}</span>
</div>

<nav class="kb-toc" aria-label="Groups">
${tocChips}
</nav>

<div class="kb-keyboard"></div>

${groups}

<script type="application/json" id="app-data">${jsonForScript(app)}</script>`;
}

function renderGuideBody(doc: GuideDoc, html: string, appTitle: string | undefined): string {
  const toc =
    doc.toc.length === 0
      ? ""
      : `<nav class="toc">
  <p class="toc-title">On this page</p>
  <ul>
${doc.toc
  .map(
    (t) =>
      `    <li class="lvl${t.level}"><a href="#${t.slug}">${esc(t.text)}</a></li>`,
  )
  .join("\n")}
  </ul>
</nav>`;

  const metaBits = [`Updated ${esc(doc.updated)}`];
  if (doc.verified !== undefined)
    metaBits.push(
      `reviewed against <a href="${REPO_URL}/commit/${esc(doc.verified)}">nixos_config @ ${esc(doc.verified)}</a>`,
    );
  if (doc.app !== undefined && appTitle !== undefined)
    metaBits.push(`bindings: <a href="../apps/${esc(doc.app)}.html">${esc(appTitle)}</a>`);
  const meta = `<p class="guide-meta">${metaBits.join(" · ")}</p>`;
  const article = html.includes("</h1>") ? html.replace("</h1>", `</h1>\n${meta}`) : `${meta}\n${html}`;

  return `<div class="guide-shell">
  <article>
${article}
  </article>
${toc}
</div>`;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const dist = join(root, "dist");

  // 1. read + validate keybinds
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(join(root, "data/keybinds.json"), "utf8"));
  } catch (err) {
    fail(`cannot read data/keybinds.json: ${(err as Error).message}`);
  }
  const data = validateKeybinds(parsed);
  const commit = data.meta.sourceCommit;

  // 2. guides (needed by index + app "related guide" links) + cross-checks
  const guides = await loadGuides(root);
  const guideBySlug = new Map(guides.map((g) => [g.slug, g]));
  const appById = new Map(data.apps.map((a) => [a.id, a]));
  for (const app of data.apps)
    if (app.guide !== undefined && !guideBySlug.has(app.guide))
      fail(`apps[${app.id}].guide = "${app.guide}" but no guide has that slug`);
  for (const g of guides)
    if (g.app !== undefined && !appById.has(g.app))
      fail(`${g.file}: app: "${g.app}" is not an app id in data/keybinds.json`);

  // 3. row anchors + the key index the guide check resolves against
  const rowIndex = new Map(data.apps.map((a) => [a.id, indexRows(a)]));
  const keyIndex: KeyIndex = {
    apps: new Map(
      data.apps.map((a) => [a.id, { title: a.title, rows: rowIndex.get(a.id) as RowIndex }]),
    ),
  };

  console.log("system-docs renderer:");
  const problems: string[] = [];
  const linked = new Map<string, string>();
  let refCount = 0;
  for (const g of guides) {
    const before = problems.length;
    const html = linkKeyRefs(g, keyIndex, problems);
    refCount += (html.match(/class="kb-ref"/g) ?? []).length;
    linked.set(g.slug, html);
    if (problems.length === before) continue;
  }
  console.log(`  key check: ${refCount} chord references in guides resolve to app-page rows`);
  checkRepoPaths(guides, problems);
  if (problems.length > 0) {
    for (const p of problems) console.error(`  ✗ ${p}`);
    fail(`${problems.length} guide reference problem(s) - the manual must not drift from the config`);
  }

  await mkdir(join(dist, "apps"), { recursive: true });
  await mkdir(join(dist, "guides"), { recursive: true });
  await mkdir(join(dist, "assets"), { recursive: true });

  const genDate = data.meta.generatedAt.slice(0, 10);
  const footerLeft = `built from nixos_config @ <a href="${REPO_URL}/commit/${esc(commit)}">${esc(commit)}</a>`;
  const footerRight = `bindings as of ${esc(genDate)} · <a href="${REPO_URL}">krsmrk/nixos_config</a>`;
  const description = `The box manual: keybinding cheat sheets and usage guides for this NixOS system (${data.apps
    .map((a) => a.title)
    .join(", ")}).`;

  const pages: Array<{ file: string; html: string }> = [];

  // 4. index
  pages.push({
    file: "index.html",
    html: page({
      title: "Overview",
      rel: "",
      page: "index",
      description,
      body: renderIndexBody(data, guides),
      footerLeft,
      footerRight,
    }),
  });

  // 5. app pages
  for (const app of data.apps) {
    pages.push({
      file: `apps/${app.id}.html`,
      html: page({
        title: app.title,
        rel: "../",
        page: "app",
        app: app.id,
        description: `${app.title}: ${app.tagline}. ${app.description}`,
        body: renderAppBody(app, rowIndex.get(app.id) as RowIndex, guideBySlug, commit),
        footerLeft,
        footerRight,
      }),
    });
  }

  // 6. guide pages
  for (const doc of guides) {
    pages.push({
      file: `guides/${doc.slug}.html`,
      html: page({
        title: doc.title,
        rel: "../",
        page: "guide",
        description: doc.summary !== "" ? `${doc.title}: ${doc.summary}` : description,
        body: renderGuideBody(
          doc,
          linked.get(doc.slug) ?? doc.html,
          doc.app !== undefined ? appById.get(doc.app)?.title : undefined,
        ),
        footerLeft,
        footerRight,
      }),
    });
  }

  // 7. 404 - served by Pages at any missing URL, so it must not use relative paths
  pages.push({
    file: "404.html",
    html: page({
      title: "Page not found",
      rel: SITE_BASE,
      page: "404",
      description,
      body: `<div class="hero">
  <h1>404: page not found</h1>
  <p>Nothing lives at this URL. Head back to the <a href="${SITE_BASE}index.html">overview</a> or browse the <a href="${SITE_BASE}index.html#guides">guides</a>.</p>
</div>`,
      footerLeft,
      footerRight,
    }),
  });

  // write pages
  for (const p of pages) {
    await writeFile(join(dist, p.file), p.html);
  }

  // 8. search index for the landing page: [app, keys, label, command, group, rowId]
  const rows: Array<[string, string, string, string, string, string]> = [];
  for (const app of data.apps) {
    const ids = (rowIndex.get(app.id) as RowIndex).rowIds;
    app.groups.forEach((g, gi) =>
      g.bindings.forEach((b, bi) => rows.push([app.id, b.keys, b.label, b.command ?? "", g.name, ids[gi][bi]])),
    );
  }
  const searchIndex = {
    apps: Object.fromEntries(data.apps.map((a) => [a.id, a.title])),
    rows,
  };
  await writeFile(join(dist, "assets/bindings.json"), JSON.stringify(searchIndex));

  // 9. summary
  for (const p of pages) console.log(`  wrote dist/${p.file}`);
  console.log(`  wrote dist/assets/bindings.json (${rows.length} rows)`);
  console.log("");
  for (const app of data.apps) {
    console.log(`  ${app.id}: ${countBindings(app)} bindings in ${app.groups.length} group(s)`);
  }
  console.log(`\n✓ ${pages.length} pages written to dist/`);
}

await main();
