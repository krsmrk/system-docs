// filter.ts - live RANKED fuzzy filtering for app pages (body[data-page="app"]).
// Wires input.kb-filter to the .kb-row tables, per SPEC.md
// ("DOM contracts" + "Widgets / 1. filter.ts"). Progressive enhancement:
// without JS everything stays visible; this code only adds behavior.
// Creates at most two nodes: .kb-counter and .kb-empty.
//
// Matching is quality-gated in fuzzy.ts (scattered subsequence garbage is
// rejected). Visible rows are reordered best-match-first within each group
// and groups are ordered by their best row; clearing restores the original
// document order. Label and command cells get <mark> highlights.
// "?q=" URL round-trip, "/" focuses, Escape clears.

import { fuzzyMatch, type FuzzyHit } from "./fuzzy";

// Small curated synonym table: expands the query so "sound" finds
// audio/volume rows, "wifi" finds wi-fi/network rows, etc.
const SYNONYMS: Record<string, string[]> = {
  sound: ["audio", "volume", "vol"],
  wifi: ["wi-fi", "network", "wlan"],
  shot: ["screenshot", "capture"],
  screenshot: ["capture"],
  files: ["file"],
  browser: ["firefox"],
  launcher: ["fuzzel", "dmenu"],
  terminal: ["ghostty"],
  music: ["playerctl", "player"],
  video: ["playerctl"],
};

/** Query variants: the raw query plus one-variant-per-synonym-token. */
function queryVariants(query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const variants = [q];
  for (const [key, alts] of Object.entries(SYNONYMS)) {
    for (const alt of alts) {
      if (q === key) variants.push(alt);
      else if (q.split(/\s+/).includes(key)) variants.push(q.replace(key, alt));
    }
  }
  return variants;
}

interface TextCell {
  el: HTMLElement;
  text: string;
  originalHTML: string;
}

interface Row {
  el: HTMLTableRowElement;
  group: HTMLElement | null;
  haystack: string;
  label: TextCell | null;
  command: TextCell | null;
}

/** Wrap matched character ranges of plain text in <mark> spans. */
function highlight(text: string, positions: number[]): string {
  const at = new Set(positions);
  let out = "";
  let inMark = false;
  for (let i = 0; i < text.length; i++) {
    const hit = at.has(i);
    if (hit && !inMark) {
      out += "<mark>";
      inMark = true;
    } else if (!hit && inMark) {
      out += "</mark>";
      inMark = false;
    }
    out += text[i].replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
  }
  if (inMark) out += "</mark>";
  return out;
}

function setCellHighlight(cell: TextCell | null, query: string): void {
  if (!cell) return;
  if (query === "") {
    cell.el.innerHTML = cell.originalHTML;
    return;
  }
  const hit = fuzzyMatch(query, cell.text);
  cell.el.innerHTML = hit === null ? cell.originalHTML : highlight(cell.text, hit.positions);
}

export function initFilter(): void {
  if (document.body.dataset.page !== "app") return;

  const input = document.querySelector<HTMLInputElement>("input.kb-filter");
  if (!input) return;

  // Precompute each row's haystack once: keys + label + command + group name.
  const textCell = (sel: string, from: HTMLTableRowElement): TextCell | null => {
    const el = from.querySelector<HTMLElement>(sel);
    if (!el) return null;
    return { el, text: el.textContent?.trim() ?? "", originalHTML: el.innerHTML };
  };

  const rows: Row[] = Array.from(
    document.querySelectorAll<HTMLTableRowElement>("tr.kb-row"),
  ).map((el) => {
    const keys = el.dataset.keys ?? "";
    const label = textCell("td.kb-label", el);
    const commandCode = textCell("td.kb-command code", el);
    const group = el.closest<HTMLElement>("section.kb-group");
    const groupName = group?.querySelector("h3")?.textContent?.trim() ?? "";
    return {
      el,
      group,
      label,
      // highlight targets the inner <code>, not the td wrapper
      command: commandCode,
      haystack: `${keys} ${label?.text ?? ""} ${commandCode?.text ?? ""} ${groupName}`.toLowerCase(),
    };
  });

  const groups = Array.from(document.querySelectorAll<HTMLElement>(".kb-group"));
  const groupContainer = groups[0]?.parentElement ?? null;
  const groupsOriginal = [...groups];

  const rowsByGroup = new Map<HTMLElement, Row[]>();
  for (const row of rows) {
    if (!row.group) continue;
    const list = rowsByGroup.get(row.group);
    if (list) list.push(row);
    else rowsByGroup.set(row.group, [row]);
  }

  // jump-TOC chips: dim the ones whose group has no visible matches
  const tocChips = Array.from(document.querySelectorAll<HTMLAnchorElement>(".toc-chip"));

  // Counter: created once, right after the input.
  const ensureCounter = (): HTMLElement => {
    const existing = document.querySelector<HTMLElement>(".kb-counter");
    if (existing) return existing;
    const el = document.createElement("span");
    el.className = "kb-counter";
    el.setAttribute("aria-live", "polite");
    input.after(el);
    return el;
  };
  const counter = ensureCounter();

  // Empty state: created once, after the LAST .kb-group.
  const ensureEmpty = (): HTMLElement => {
    const existing = document.querySelector<HTMLElement>(".kb-empty");
    if (existing) return existing;
    const el = document.createElement("div");
    el.className = "kb-empty";
    el.hidden = true;
    const lastGroup = groups[groups.length - 1];
    if (lastGroup) lastGroup.after(el);
    else input.after(el); // degenerate page without groups
    return el;
  };
  const empty = ensureEmpty();

  const bindingsWord = (n: number): string => `${n} ${n === 1 ? "binding" : "bindings"}`;

  // ?q= round-trip: shareable filtered views.
  const syncUrl = (query: string): void => {
    try {
      const url = new URL(window.location.href);
      if (query === "") url.searchParams.delete("q");
      else url.searchParams.set("q", query);
      window.history.replaceState(null, "", url);
    } catch {
      /* file:// or odd environments - ignore */
    }
  };

  const restoreOrder = (): void => {
    for (const [group, list] of rowsByGroup) {
      const tbody = group.querySelector("tbody");
      if (tbody) for (const row of list) tbody.appendChild(row.el);
      group.classList.remove("hidden");
    }
    if (groupContainer) for (const g of groupsOriginal) groupContainer.appendChild(g);
    for (const chip of tocChips) chip.classList.remove("dimmed");
  };

  const applyFilter = (): void => {
    const query = input.value;
    const total = rows.length;

    if (query === "") {
      restoreOrder();
      for (const row of rows) {
        row.el.classList.remove("hidden");
        setCellHighlight(row.label, "");
        setCellHighlight(row.command, "");
      }
      counter.textContent = bindingsWord(total);
      empty.hidden = true;
      syncUrl("");
      return;
    }

    // match + score every row (best score over raw + synonym variants)
    const queries = queryVariants(query);
    const scored = new Map<Row, FuzzyHit>();
    for (const row of rows) {
      let best: FuzzyHit | null = null;
      for (const q of queries) {
        const hit = fuzzyMatch(q, row.haystack);
        if (hit !== null && (best === null || hit.score > best.score)) best = hit;
      }
      if (best === null) {
        row.el.classList.add("hidden");
      } else {
        scored.set(row, best);
        row.el.classList.remove("hidden");
        setCellHighlight(row.label, query);
        setCellHighlight(row.command, query);
      }
    }

    // order rows best-first inside each group; hidden rows after them
    const groupBest = new Map<HTMLElement, number>();
    for (const [group, list] of rowsByGroup) {
      const tbody = group.querySelector("tbody");
      if (!tbody) continue;
      const visible = list.filter((r) => scored.has(r));
      const hidden = list.filter((r) => !scored.has(r));
      visible.sort((a, b) => (scored.get(b)?.score ?? 0) - (scored.get(a)?.score ?? 0));
      for (const r of visible) tbody.appendChild(r.el);
      for (const r of hidden) tbody.appendChild(r.el);
      const best = visible.length === 0 ? -1 : (scored.get(visible[0])?.score ?? -1);
      groupBest.set(group, best);
      group.classList.toggle("hidden", best === -1);
    }

    // order groups by their best row
    if (groupContainer) {
      const visibleGroups = groupsOriginal
        .filter((g) => (groupBest.get(g) ?? -1) >= 0)
        .sort((a, b) => (groupBest.get(b) ?? 0) - (groupBest.get(a) ?? 0));
      const hiddenGroups = groupsOriginal.filter((g) => (groupBest.get(g) ?? -1) < 0);
      for (const g of [...visibleGroups, ...hiddenGroups]) groupContainer.appendChild(g);
    }

    // dim jump chips for groups without matches
    for (const chip of tocChips) {
      const id = chip.hash.slice(1);
      const target = document.getElementById(id);
      chip.classList.toggle("dimmed", target !== null && target.classList.contains("hidden"));
    }

    const visible = scored.size;
    counter.textContent = `${bindingsWord(visible)} of ${total}`;
    const showEmpty = visible === 0;
    if (showEmpty) empty.textContent = `No bindings match “${query}”.`;
    empty.hidden = !showEmpty;
    syncUrl(query);
  };

  // Honor an incoming ?q= before the initial paint pass.
  try {
    const initial = new URLSearchParams(window.location.search).get("q");
    if (initial !== null) input.value = initial;
  } catch {
    /* ignore */
  }

  input.addEventListener("input", () => applyFilter());
  applyFilter(); // initial state (also covers restored input values on bfcache)

  document.addEventListener("keydown", (e) => {
    const target = e.target;
    const inField =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      (target instanceof HTMLElement && target.isContentEditable);
    const hasMods = e.ctrlKey || e.metaKey || e.altKey || e.shiftKey;

    if (e.key === "/" && !inField && !hasMods) {
      e.preventDefault();
      input.focus();
      input.select();
      return;
    }
    if (e.key === "Escape" && target === input) {
      input.value = "";
      applyFilter();
      input.blur();
    }
  });
}
