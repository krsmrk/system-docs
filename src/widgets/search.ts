// search.ts - cross-app key lookup on the landing page (body[data-page="index"]).
// The index is the browser start page, so the question it answers first is
// "what does this key do, and in which layer?". Data comes from
// assets/bindings.json (written by the build), fetched on first use.
//
// Two query modes:
//   - a chord ("Ctrl+R", "mod+shift+n", "Scroll Up"): exact key matches,
//     ordered by layer (keyd → niri → bar → tmux → zsh → the app) so the
//     reader sees who consumes the key first;
//   - anything else: ranked fuzzy search over keys + label + command + app.
// Results link to the app page row (#k-… anchors). "/" focuses, Esc clears,
// Enter opens the first result, ?q= round-trips so a lookup is shareable.

import { kbdChips, esc } from "../kbd";
import { fuzzyMatch } from "./fuzzy";

interface Row {
  app: string;
  keys: string;
  label: string;
  command: string;
  group: string;
  id: string;
  haystack: string;
}

interface Index {
  apps: Record<string, string>;
  rows: Row[];
}

/** Layer order for exact-chord lookups: the order in which layers see a key. */
const LAYER_ORDER = ["keyd", "niri", "waybar", "tmux", "zsh", "ghostty", "fuzzel", "qutebrowser", "yazi", "zathura"];
const MOD_ORDER = ["Mod", "Ctrl", "Alt", "Shift"];
const MOD_ALIASES: Record<string, string> = {
  mod: "Mod", super: "Mod", win: "Mod", logo: "Mod",
  ctrl: "Ctrl", control: "Ctrl",
  alt: "Alt", meta: "Alt",
  shift: "Shift",
};
const KEY_ALIASES: Record<string, string> = {
  "[": "BracketLeft", "]": "BracketRight", "-": "Minus", "=": "Equal",
  ",": "Comma", ".": "Period", ";": "Semicolon", "'": "Quote", "/": "Slash",
  "\\": "Backslash", "`": "Grave",
  esc: "Escape", enter: "Return", del: "Delete", ins: "Insert",
  pgup: "PageUp", pgdn: "PageDown", bksp: "Backspace",
};

/** Canonical chord for a query, or null when the query is not a chord. */
function asChord(query: string): string | null {
  const q = query.trim();
  if (/^(mouse|scroll|wheel) [a-z]+( [a-z]+)?$/i.test(q)) {
    return q
      .split(/\s+/)
      .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }
  if (!/^((mod|ctrl|alt|shift|super|meta|win|control)\+)+[^\s+]+(\s[^\s]+)*$/i.test(q)) return null;
  return q
    .split(/\s+/)
    .map((step) => {
      const parts = step.split("+").filter((p) => p !== "");
      const mods: string[] = [];
      let key = "";
      for (const p of parts) {
        const m = MOD_ALIASES[p.toLowerCase()];
        if (m) mods.push(m);
        else key = p;
      }
      if (key === "" && /\+[=+]$/.test(step)) key = step.slice(-1);
      mods.sort((a, b) => MOD_ORDER.indexOf(a) - MOD_ORDER.indexOf(b));
      const alias = KEY_ALIASES[key] ?? KEY_ALIASES[key.toLowerCase()];
      if (alias) key = alias;
      else if (key.length === 1) key = key.toUpperCase();
      else if (!/^xf86/i.test(key)) key = key[0].toUpperCase() + key.slice(1);
      return [...mods, key].join("+");
    })
    .join(" ");
}

export function initSearch(): void {
  if (document.body.dataset.page !== "index") return;
  const input = document.querySelector<HTMLInputElement>("input.kb-search");
  const list = document.querySelector<HTMLElement>(".sr-list");
  if (!input || !list) return;
  const counter = document.querySelector<HTMLElement>(".site-search .kb-counter");

  let index: Index | null = null;
  let loading: Promise<Index> | null = null;
  const load = (): Promise<Index> => {
    if (index) return Promise.resolve(index);
    loading ??= fetch("assets/bindings.json")
      .then((r) => {
        if (!r.ok) throw new Error(`bindings.json: HTTP ${r.status}`);
        return r.json() as Promise<{ apps: Record<string, string>; rows: string[][] }>;
      })
      .then((raw) => {
        index = {
          apps: raw.apps,
          rows: raw.rows.map(([app, keys, label, command, group, id]) => ({
            app,
            keys,
            label,
            command,
            group,
            id,
            haystack: `${keys} ${label} ${command} ${raw.apps[app] ?? app} ${group}`.toLowerCase(),
          })),
        };
        return index;
      });
    return loading;
  };

  const syncUrl = (query: string): void => {
    try {
      const url = new URL(window.location.href);
      if (query === "") url.searchParams.delete("q");
      else url.searchParams.set("q", query);
      window.history.replaceState(null, "", url);
    } catch {
      /* file:// - ignore */
    }
  };

  const layerRank = (app: string): number => {
    const i = LAYER_ORDER.indexOf(app);
    return i === -1 ? LAYER_ORDER.length : i;
  };

  const renderRows = (rows: Row[], apps: Record<string, string>): string =>
    rows
      .map(
        (r) =>
          `<a class="sr" href="apps/${esc(r.app)}.html#${esc(r.id)}"><span class="sr-app">${esc(apps[r.app] ?? r.app)}</span><span class="sr-keys">${kbdChips(r.keys)}</span><span class="sr-label">${esc(r.label)}${r.command ? `<code>${esc(r.command)}</code>` : ""}</span></a>`,
      )
      .join("");

  const MAX = 60;
  let seq = 0;
  const render = async (): Promise<void> => {
    const query = input.value;
    syncUrl(query);
    if (query.trim() === "") {
      list.hidden = true;
      list.innerHTML = "";
      if (counter) counter.textContent = "";
      return;
    }
    const mine = ++seq;
    let idx: Index;
    try {
      idx = await load();
    } catch (err) {
      list.hidden = false;
      list.innerHTML = `<p class="sr-empty">Search index unavailable (${esc(String(err))}).</p>`;
      return;
    }
    if (mine !== seq) return; // a newer keystroke superseded this one

    const chord = asChord(query);
    let rows: Row[] = [];
    let note = "";
    if (chord !== null) {
      const lower = chord.toLowerCase();
      rows = idx.rows
        .filter((r) => r.keys.toLowerCase() === lower)
        .sort((a, b) => layerRank(a.app) - layerRank(b.app));
      if (rows.length > 0) note = `<p class="sr-note">${esc(chord)} by layer, in the order they see the key:</p>`;
    }
    if (rows.length === 0) {
      const q = query.trim().toLowerCase();
      rows = idx.rows
        .map((r) => ({ r, hit: fuzzyMatch(q, r.haystack) }))
        .filter((x): x is { r: Row; hit: NonNullable<ReturnType<typeof fuzzyMatch>> } => x.hit !== null)
        .sort((a, b) => b.hit.score - a.hit.score)
        .map((x) => x.r);
    }
    const total = rows.length;
    const shown = rows.slice(0, MAX);
    list.hidden = false;
    list.innerHTML =
      total === 0
        ? `<p class="sr-empty">No binding matches “${esc(query)}”.</p>`
        : `${note}${renderRows(shown, idx.apps)}${total > MAX ? `<p class="sr-note">${total - MAX} more - narrow the query.</p>` : ""}`;
    if (counter)
      counter.textContent = total === 0 ? "" : `${total} ${total === 1 ? "binding" : "bindings"}${total > MAX ? ` (${MAX} shown)` : ""}`;
  };

  try {
    const initial = new URLSearchParams(window.location.search).get("q");
    if (initial !== null) input.value = initial;
  } catch {
    /* ignore */
  }
  input.addEventListener("input", () => void render());
  input.addEventListener("focus", () => void load().catch(() => undefined));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const first = list.querySelector<HTMLAnchorElement>("a.sr");
      if (first) {
        e.preventDefault();
        window.location.href = first.href;
      }
    }
    if (e.key === "Escape") {
      input.value = "";
      void render();
      input.blur();
    }
  });
  document.addEventListener("keydown", (e) => {
    const t = e.target;
    const inField =
      t instanceof HTMLInputElement ||
      t instanceof HTMLTextAreaElement ||
      t instanceof HTMLSelectElement ||
      (t instanceof HTMLElement && t.isContentEditable);
    if (e.key === "/" && !inField && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
      e.preventDefault();
      input.focus();
      input.select();
    }
  });
  if (input.value !== "") void render();
}
