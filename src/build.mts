// Site renderer for system-docs. Reads data/keybinds.json and
// content/guides/*.md, then writes:
//   dist/index.html            — landing page (hero + app cards + guides)
//   dist/apps/<id>.html        — keybinding pages (DOM contract in SPEC.md)
//   dist/guides/<slug>.html    — markdown guides with TOC
//   dist/404.html              — Nord-styled not-found page
// Runs from the repo root (esbuild-bundled + spawned by scripts/build.mjs).

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import MarkdownIt from "markdown-it";
import { esc, kbdChips, page } from "./templates";

// ---------------------------------------------------------------------------
// data schema: data/keybinds.json
// ---------------------------------------------------------------------------

interface Binding {
  keys: string;
  label: string;
  command?: string;
  source?: string;
}

interface BindingGroup {
  name: string;
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
  slug: string;
  title: string;
  summary: string;
  order: number;
  /** Final article HTML (anchored headings, h1 injected when absent). */
  html: string;
  toc: TocEntry[];
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** Landing-page card order (SPEC "Build pipeline"); unknown ids sort last. */
const APP_ORDER = ["niri", "waybar", "fuzzel", "ghostty", "yazi", "zathura", "zsh"];

// Consistent inline-SVG icons (24px, stroke style, currentColor). The data
// schema's `icon` glyph remains the fallback for ids not listed here.
const S = (inner: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const APP_SVG: Record<string, string> = {
  niri: S('<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="9.5" y="4" width="5" height="16" rx="1"/><rect x="16" y="4" width="5" height="16" rx="1"/>'),
  waybar: S('<rect x="2.5" y="5.5" width="19" height="3.4" rx="1.7" fill="currentColor" stroke="none"/><rect x="2.5" y="12" width="5.5" height="2.6" rx="1.3" fill="currentColor" stroke="none" opacity="0.5"/><rect x="9.3" y="12" width="5.5" height="2.6" rx="1.3" fill="currentColor" stroke="none" opacity="0.5"/><rect x="16" y="12" width="5.5" height="2.6" rx="1.3" fill="currentColor" stroke="none" opacity="0.5"/>'),
  fuzzel: S('<circle cx="10" cy="10" r="6.5"/><line x1="14.8" y1="14.8" x2="20.6" y2="20.6" stroke-width="2.2"/>'),
  ghostty: S('<rect x="2.5" y="4" width="19" height="16" rx="2"/><path d="M7 9.5l3 2.5-3 2.5"/><line x1="12.5" y1="14.5" x2="17.5" y2="14.5"/>'),
  yazi: S('<path d="M3 6.5a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
  zathura: S('<path d="M6 3h8l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M13.5 3v5h5"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="16.5" x2="14" y2="16.5"/>'),
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

/** JSON for <script type="application/json"> — `<` and friends made html-safe. */
function jsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
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
        const { keys, label, command, source } = bnd;
        if (!isStr(label) || label.trim() === "")
          fail(`${bwhere}: every binding needs a non-empty "label"`);
        if (!isStr(keys))
          fail(`${bwhere}: every binding needs a "keys" string (empty allowed only when "command" is present) — label: "${label}"`);
        if (keys === "" && !(isStr(command) && command.trim() !== ""))
          fail(`${bwhere}: keys may be "" only when "command" is present — label: "${label}"`);
        if (command !== undefined && !isStr(command))
          fail(`${bwhere}: "command" must be a string`);
        if (source !== undefined && !isStr(source))
          fail(`${bwhere}: "source" must be a string`);
        return { keys, label, command, source };
      });
      return { name: grp.name, bindings };
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

  return { meta, apps };
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

async function loadGuides(root: string): Promise<GuideDoc[]> {
  const dir = join(root, "content/guides");
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".md")).sort();
  } catch {
    return []; // no content/guides dir yet — index shows the empty state
  }
  const docs: GuideDoc[] = [];
  for (const [i, file] of files.entries()) {
    const raw = await readFile(join(dir, file), "utf8");
    const fm = parseFrontMatter(raw);
    const fields = fm?.fields ?? {};
    const title = isStr(fields.title) && fields.title !== "" ? fields.title : basename(file, ".md");
    const slug = slugify(fields.slug ?? "") || slugify(basename(file, ".md"));
    const parsedOrder = Number(fields.order);
    const order = Number.isFinite(parsedOrder) ? parsedOrder : 1e9 + i;
    const summary = fields.summary ?? "";

    const anchored = injectHeadingAnchors(md.render(fm?.body ?? raw));
    const article = /<h1[\s>]/.test(anchored.html)
      ? anchored.html
      : `<h1>${esc(title)}</h1>\n${anchored.html}`;
    docs.push({ slug, title, summary, order, html: article, toc: anchored.toc });
  }
  docs.sort((a, b) => a.order - b.order);
  return docs;
}

// ---------------------------------------------------------------------------
// page bodies
// ---------------------------------------------------------------------------

function renderIndexBody(data: KeybindsFile, guides: GuideDoc[]): string {
  const ranked = data.apps
    .map((app, i) => {
      const canonical = APP_ORDER.indexOf(app.id);
      return { app, rank: canonical === -1 ? APP_ORDER.length + i : canonical };
    })
    .sort((a, b) => a.rank - b.rank);

  const totalBindings = data.apps.reduce(
    (n, a) => n + a.groups.reduce((m, g) => m + g.bindings.length, 0),
    0,
  );

  const cards = ranked
    .map(({ app }) => {
      const total = app.groups.reduce((n, g) => n + g.bindings.length, 0);
      // keycap preview: first 3 bindings of the first group (usually custom)
      const preview = (app.groups[0]?.bindings ?? [])
        .slice(0, 3)
        .filter((b) => b.keys !== "")
        .map((b) => kbdChips(b.keys))
        .join("");
      const keysLine = preview !== "" ? `      <div class="card-keys" aria-hidden="true">${preview}</div>\n` : "";
      return `    <a class="app-card" href="apps/${esc(app.id)}.html">
      <span class="card-icon" aria-hidden="true">${appIcon(app)}</span>
      <h3>${esc(app.title)}</h3>
      <p class="tagline">${esc(app.tagline)}</p>
${keysLine}      <div class="card-meta"><span class="count">${total} ${total === 1 ? "binding" : "bindings"}</span><span>${app.groups.length} ${app.groups.length === 1 ? "group" : "groups"}</span></div>
    </a>`;
    })
    .join("\n");

  const guideItems =
    guides.length === 0
      ? "    <p>Guides coming soon.</p>"
      : guides
          .map(
            (g) =>
              `    <a href="guides/${esc(g.slug)}.html">${esc(g.title)} <span class="g-summary">${esc(g.summary)}</span></a>`,
          )
          .join("\n");

  const genDate = data.meta.generatedAt.slice(0, 10);
  return `<div class="hero">
  <h1>Every keybinding on box, searchable.</h1>
  <p class="hero-sub">Keybinding cheat sheets + usage guides for this NixOS system (${esc(data.meta.host)}) — generated from the live config, not typed by hand.</p>
  <p class="hero-stats">
    <span class="stat"><strong>${totalBindings}</strong> bindings</span>
    <span class="stat"><strong>${data.apps.length}</strong> apps</span>
    <span class="stat"><strong>${guides.length}</strong> guides</span>
    <span class="stat dim">generated ${esc(genDate)}</span>
  </p>
</div>

<div class="card-grid">
${cards}
</div>

<h2 id="guides">Guides</h2>
<div class="guide-list">
${guideItems}
</div>`;
}

function renderRow(b: Binding): string {
  const sourceCell =
    b.source !== undefined
      ? `\n      <td class="kb-source" title="${esc(b.source)}">∴</td>`
      : "";
  const cmdAttr = b.command !== undefined ? ` data-cmd="${esc(b.command.toLowerCase())}"` : "";
  return `    <tr class="kb-row" data-keys="${esc(b.keys)}"${cmdAttr}>
      <td class="kb-keys">${kbdChips(b.keys)}</td>
      <td class="kb-label">${esc(b.label)}</td>
      <td class="kb-command">${b.command !== undefined ? `<code>${esc(b.command)}</code>` : ""}</td>${sourceCell}
    </tr>`;
}

function renderAppBody(app: App, guideBySlug: ReadonlyMap<string, GuideDoc>): string {
  const total = app.groups.reduce((n, g) => n + g.bindings.length, 0);
  const related = app.guide !== undefined ? guideBySlug.get(app.guide) : undefined;
  const relatedGuide = related
    ? `\n  <p class="related-guide"><a class="chip-link" href="../guides/${esc(related.slug)}.html">guide → ${esc(related.title)}</a></p>`
    : "";

  const header = `<div class="app-header">
  <h1><span class="app-icon" aria-hidden="true">${appIcon(app)}</span> ${esc(app.title)}</h1>
  <p class="tagline">${esc(app.tagline)}</p>
  <p class="app-desc">${esc(app.description)}</p>${relatedGuide}
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
  <table class="kb-table"><tbody>
${g.bindings.map(renderRow).join("\n")}
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

function renderGuideBody(doc: GuideDoc): string {
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

  return `<div class="guide-shell">
  <article>
${doc.html}
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

  // 4. guides (needed by index + app "related guide" links)
  const guides = await loadGuides(root);
  const guideBySlug = new Map(guides.map((g) => [g.slug, g]));

  await mkdir(join(dist, "apps"), { recursive: true });
  await mkdir(join(dist, "guides"), { recursive: true });

  const genDate = data.meta.generatedAt.slice(0, 10);
  const footerLeft = `built from nixos_config @ ${esc(data.meta.sourceCommit)}`;
  const footerRight = `generated ${esc(genDate)} · <a href="https://github.com/krsmrk/nixos_config">krsmrk/nixos_config</a>`;

  const pages: Array<{ file: string; html: string }> = [];

  // 2. index
  pages.push({
    file: "index.html",
    html: page({
      title: "Overview",
      rel: "",
      page: "index",
      body: renderIndexBody(data, guides),
      footerLeft,
      footerRight,
    }),
  });

  // 3. app pages
  for (const app of data.apps) {
    pages.push({
      file: `apps/${app.id}.html`,
      html: page({
        title: app.title,
        rel: "../",
        page: "app",
        app: app.id,
        body: renderAppBody(app, guideBySlug),
        footerLeft,
        footerRight,
      }),
    });
  }

  // 4. guide pages
  for (const doc of guides) {
    pages.push({
      file: `guides/${doc.slug}.html`,
      html: page({
        title: doc.title,
        rel: "../",
        page: "guide",
        body: renderGuideBody(doc),
        footerLeft,
        footerRight,
      }),
    });
  }

  // 6. 404
  pages.push({
    file: "404.html",
    html: page({
      title: "Page not found",
      rel: "",
      page: "404",
      body: `<div class="hero">
  <h1>404 — page not found</h1>
  <p>Nothing lives at this URL. Head back to the <a href="index.html">overview</a> or browse the <a href="index.html#guides">guides</a>.</p>
</div>`,
      footerLeft,
      footerRight,
    }),
  });

  // write pages
  for (const p of pages) {
    await writeFile(join(dist, p.file), p.html);
  }

  // 7. summary
  console.log("system-docs renderer:");
  for (const p of pages) console.log(`  wrote dist/${p.file}`);
  console.log("");
  for (const app of data.apps) {
    const total = app.groups.reduce((n, g) => n + g.bindings.length, 0);
    console.log(`  ${app.id}: ${total} bindings in ${app.groups.length} group(s)`);
  }
  console.log(`\n✓ ${pages.length} pages written to dist/`);
}

await main();