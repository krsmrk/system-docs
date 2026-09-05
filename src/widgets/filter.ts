// filter.ts — live fuzzy filtering for app pages (body[data-page="app"]).
// Wires input.kb-filter to the .kb-row tables, per SPEC.md
// ("DOM contracts" + "Widgets / 1. filter.ts"). Progressive enhancement:
// without JS everything stays visible; this code only adds behavior.
// Creates at most two nodes: .kb-counter and .kb-empty.

import { fuzzyScore } from "./fuzzy";

interface Row {
  el: HTMLTableRowElement;
  group: HTMLElement | null;
  haystack: string;
}

export function initFilter(): void {
  if (document.body.dataset.page !== "app") return;

  const input = document.querySelector<HTMLInputElement>("input.kb-filter");
  if (!input) return;

  // Precompute each row's haystack once (lowercased once here; fuzzyScore
  // lowercases its inputs internally as well): keys + label + command +
  // the name of the row's nearest enclosing group.
  const rows: Row[] = Array.from(
    document.querySelectorAll<HTMLTableRowElement>("tr.kb-row"),
  ).map((el) => {
    const keys = el.dataset.keys ?? "";
    const label =
      el.querySelector<HTMLTableCellElement>("td.kb-label")?.textContent?.trim() ?? "";
    const command =
      el.querySelector<HTMLTableCellElement>("td.kb-command")?.textContent?.trim() ?? "";
    const group = el.closest<HTMLElement>("section.kb-group");
    const groupName = group?.querySelector("h3")?.textContent?.trim() ?? "";
    return {
      el,
      group,
      haystack: `${keys} ${label} ${command} ${groupName}`.toLowerCase(),
    };
  });

  const groups = Array.from(document.querySelectorAll<HTMLElement>(".kb-group"));
  const rowsByGroup = new Map<HTMLElement, Row[]>();
  for (const row of rows) {
    if (!row.group) continue;
    const list = rowsByGroup.get(row.group);
    if (list) list.push(row);
    else rowsByGroup.set(row.group, [row]);
  }

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

  const applyFilter = (): void => {
    const query = input.value;
    const total = rows.length;
    let visible: number;

    if (query === "") {
      for (const row of rows) row.el.classList.remove("hidden");
      for (const group of groups) group.classList.remove("hidden");
      visible = total;
    } else {
      visible = 0;
      for (const row of rows) {
        if (fuzzyScore(query, row.haystack) === null) {
          row.el.classList.add("hidden");
        } else {
          row.el.classList.remove("hidden");
          visible += 1;
        }
      }
      for (const group of groups) {
        const list = rowsByGroup.get(group);
        const anyVisible =
          list !== undefined && list.some((r) => !r.el.classList.contains("hidden"));
        group.classList.toggle("hidden", !anyVisible);
      }
    }

    counter.textContent = query === "" ? `${total} bindings` : `${visible} of ${total}`;

    const showEmpty = visible === 0 && query !== "";
    if (showEmpty) empty.textContent = `No bindings match “${query}”.`;
    empty.hidden = !showEmpty;
  };

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