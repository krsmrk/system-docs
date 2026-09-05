// Keyboard widget — ISO/DE layout with modifier layers, tooltips, click-to-row.
// Contract: SPEC.md "DOM contracts" + "Widgets / 2. keyboard.ts".

export function initKeyboard(): void {
  const page = document.body.dataset.page;
  if (page !== "app") return;

  const host = document.querySelector<HTMLDivElement>(".kb-keyboard");
  if (!host) return;

  // ---- parse app data --------------------------------------------------
  let groups: { name: string; bindings: { keys: string; label: string }[] }[] = [];
  try {
    const raw = document.getElementById("app-data")?.textContent ?? "";
    const app = JSON.parse(raw) as {
      groups?: { name?: string; bindings?: { keys?: string; label?: string }[] }[];
    };
    groups = (app.groups ?? []).map((g) => ({
      name: g.name ?? "",
      bindings: (g.bindings ?? []).map((b) => ({ keys: b.keys ?? "", label: b.label ?? "" })),
    }));
  } catch (e) {
    console.warn("keyboard: malformed #app-data, skipping keyboard widget", e);
    return;
  }

  const MOD_ORDER = ["Mod", "Ctrl", "Alt", "Shift"];
  const MOD_SET = new Set(MOD_ORDER);
  const isPointer = (first: string) => first.startsWith("Mouse") || first.startsWith("Scroll");

  interface Chord {
    keys: string; // raw string, matches .kb-row[data-keys]
    mods: string; // canonical combo, e.g. "Mod+Shift" or "none"
    target: string; // token of the non-modifier key ("" if chord is mods only)
    label: string;
  }

  const chords: Chord[] = [];
  for (const g of groups)
    for (const b of g.bindings) {
      const keys = b.keys.trim();
      if (!keys || /\s/.test(keys)) continue; // sequences / empty → skip
      const tokens = keys.split("+").map((t) => t.trim()).filter(Boolean);
      if (tokens.length === 0 || isPointer(tokens[0])) continue; // pointer pseudo-keys
      const mods = tokens.slice(0, -1);
      const last = tokens[tokens.length - 1];
      let modTokens: string[];
      let target: string;
      if (MOD_SET.has(last)) {
        modTokens = tokens; // pure modifier chord, no target key
        target = "";
      } else {
        modTokens = mods;
        target = last;
      }
      const canon = MOD_ORDER.filter((m) => modTokens.includes(m)).join("+") || "none";
      chords.push({ keys, mods: canon, target, label: b.label });
    }
  if (chords.length === 0) return;

  // ---- geometry --------------------------------------------------------
  interface KeyDef {
    label: string;
    token: string;
    units: number;
    spacer?: boolean;
    sub?: string;
  }

  const fnRow: KeyDef[] = [
    { label: "Esc", token: "Escape", units: 1 },
    { label: "", token: "", units: 0.5, spacer: true },
    ...["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12"].map(
      (l): KeyDef => ({ label: l, token: l, units: 1 }),
    ),
    { label: "Print", token: "Print", units: 1 },
    { label: "Scroll", token: "Scroll", units: 1 },
    { label: "Pause", token: "Pause", units: 1 },
  ];

  const numRow: KeyDef[] = [
    ...["²", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "ß", "´"].map(
      (l): KeyDef => ({ label: l, token: l, units: 1 }),
    ),
    { label: "⌫", token: "Backspace", units: 2, sub: "Backspace" },
  ];

  const qRow: KeyDef[] = [
    { label: "⇥", token: "Tab", units: 1.5, sub: "Tab" },
    ...["q", "w", "e", "r", "t", "z", "u", "i", "o", "p", "ü", "+"].map(
      (l): KeyDef => ({ label: l, token: l, units: 1 }),
    ),
    { label: "⏎", token: "Return", units: 1.5, sub: "Enter" },
  ];

  const homeRow: KeyDef[] = [
    { label: "⇪", token: "CapsLock", units: 1.75, sub: "Caps" },
    ...["a", "s", "d", "f", "g", "h", "j", "k", "l", "ö", "ä", "#"].map(
      (l): KeyDef => ({ label: l, token: l, units: 1 }),
    ),
    { label: "⏎", token: "Return", units: 1.25, sub: "Enter" },
  ];

  const shiftRow: KeyDef[] = [
    { label: "⇧", token: "Shift", units: 1.25, sub: "Shift" },
    ...["<", "y", "x", "c", "v", "b", "n", "m", ",", ".", "-"].map(
      (l): KeyDef => ({ label: l, token: l, units: 1 }),
    ),
    { label: "⇧", token: "Shift", units: 2.75, sub: "Shift" },
  ];

  const bottomRow: KeyDef[] = [
    { label: "Ctrl", token: "Ctrl", units: 1.25 },
    { label: "Super", token: "Mod", units: 1.25, sub: "Mod" },
    { label: "Alt", token: "Alt", units: 1.25 },
    { label: "", token: "Space", units: 6.5 },
    { label: "AltGr", token: "AltGr", units: 1.25 },
    { label: "Fn", token: "Fn", units: 1 },
    { label: "Menu", token: "Menu", units: 1.25 },
    { label: "Ctrl", token: "Ctrl", units: 1.25 },
  ];

  const clusterRows: KeyDef[][] = [
    [
      { label: "Insert", token: "Insert", units: 1 },
      { label: "Home", token: "Home", units: 1 },
      { label: "PageUp", token: "PageUp", units: 1 },
    ],
    [
      { label: "Delete", token: "Delete", units: 1 },
      { label: "End", token: "End", units: 1 },
      { label: "PageDown", token: "PageDown", units: 1 },
    ],
    [
      { label: "", token: "", units: 1, spacer: true },
      { label: "↑", token: "ArrowUp", units: 1 },
      { label: "", token: "", units: 1, spacer: true },
    ],
    [
      { label: "←", token: "ArrowLeft", units: 1 },
      { label: "↓", token: "ArrowDown", units: 1 },
      { label: "→", token: "ArrowRight", units: 1 },
    ],
  ];

  // ---- build DOM -------------------------------------------------------
  const keyEls = new Map<string, HTMLButtonElement>(); // token -> el (first match wins)
  const keyElsAll = new Map<string, HTMLButtonElement[]>(); // token -> all (both Enters, Shifts, Ctrls)

  function makeKey(def: KeyDef): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "kb-key" + (def.spacer ? " spacer" : "");
    btn.style.flex = String(def.units);
    if (def.token) {
      btn.dataset.ktoken = def.token;
      if (!def.spacer) {
        if (!keyEls.has(def.token)) keyEls.set(def.token, btn);
        const list = keyElsAll.get(def.token) ?? [];
        list.push(btn);
        keyElsAll.set(def.token, list);
      }
    }
    if (def.label) btn.textContent = def.label;
    if (def.sub) {
      const s = document.createElement("span");
      s.className = "sub";
      s.textContent = def.sub;
      btn.appendChild(s);
    }
    return btn;
  }

  function makeRow(defs: KeyDef[]): HTMLDivElement {
    const row = document.createElement("div");
    row.className = "kb-krow";
    for (const d of defs) row.appendChild(makeKey(d));
    return row;
  }

  const layers = document.createElement("div");
  layers.className = "kb-layers";
  host.appendChild(layers);

  const board = document.createElement("div");
  board.className = "kb-board";
  host.appendChild(board);

  board.appendChild(makeRow(fnRow));

  const mainFlex = document.createElement("div");
  mainFlex.className = "kb-krow";

  const block = document.createElement("div");
  block.style.display = "flex";
  block.style.flexDirection = "column";
  block.style.gap = "0.3rem";
  block.style.flex = "15";
  for (const r of [numRow, qRow, homeRow, shiftRow, bottomRow]) block.appendChild(makeRow(r));

  const cluster = document.createElement("div");
  cluster.style.display = "flex";
  cluster.style.flexDirection = "column";
  cluster.style.gap = "0.3rem";
  cluster.style.flex = "3";
  for (const r of clusterRows) cluster.appendChild(makeRow(r));

  mainFlex.appendChild(block);
  mainFlex.appendChild(cluster);
  board.appendChild(mainFlex);

  // ---- layers ----------------------------------------------------------
  const combos = new Set<string>();
  for (const c of chords) combos.add(c.mods);
  const PRIORITY = ["none", "Mod", "Mod+Shift", "Mod+Ctrl", "Ctrl", "Shift", "Ctrl+Alt"];
  const comboList = [...combos].sort((a, b) => {
    const ia = PRIORITY.indexOf(a);
    const ib = PRIORITY.indexOf(b);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    return a < b ? -1 : a > b ? 1 : 0;
  });

  let selected = comboList.includes("Mod") ? "Mod" : "none";

  const chips = new Map<string, HTMLButtonElement>();
  for (const combo of comboList) {
    const n = chords.filter((c) => c.mods === combo).length;
    const label = combo === "none" ? "no modifier" : combo;
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "kb-layer-chip";
    const labelSpan = document.createElement("span");
    labelSpan.textContent = label;
    chip.appendChild(labelSpan);
    const countSpan = document.createElement("span");
    countSpan.className = "count";
    countSpan.textContent = ` ${n}`;
    chip.appendChild(countSpan);
    chip.title = `${label} — ${n} ${n === 1 ? "binding" : "bindings"} on this layer`;
    chip.setAttribute("aria-pressed", combo === selected ? "true" : "false");
    chip.addEventListener("click", () => {
      selected = combo;
      for (const [c, el] of chips) el.setAttribute("aria-pressed", c === selected ? "true" : "false");
      applyLayer();
      hideTooltip();
    });
    chips.set(combo, chip);
    layers.appendChild(chip);
  }

  // ---- highlighting ----------------------------------------------------
  // token -> chords targeting it (any layer)
  const tokenChords = new Map<string, Chord[]>();
  for (const c of chords) {
    if (!c.target) continue;
    const list = tokenChords.get(c.target) ?? [];
    list.push(c);
    tokenChords.set(c.target, list);
  }

  const NAMED_TOKENS: Record<string, string[]> = {
    Return: ["Return"],
    Escape: ["Escape"],
    Space: ["Space"],
    Tab: ["Tab"],
    Backspace: ["Backspace"],
    Delete: ["Delete"],
    Insert: ["Insert"],
    Home: ["Home"],
    End: ["End"],
    PageUp: ["PageUp"],
    PageDown: ["PageDown"],
    Left: ["ArrowLeft"],
    ArrowLeft: ["ArrowLeft"],
    Right: ["ArrowRight"],
    ArrowRight: ["ArrowRight"],
    Up: ["ArrowUp"],
    ArrowUp: ["ArrowUp"],
    Down: ["ArrowDown"],
    ArrowDown: ["ArrowDown"],
    Print: ["Print"],
    BracketLeft: ["ü"],
    BracketRight: ["+"],
    Minus: ["-"],
    Comma: [","],
    Period: ["."],
    Backslash: ["#"],
    Semicolon: ["ö"],
    Quote: ["ä"],
  };

  function keysForToken(token: string): HTMLButtonElement[] {
    const named = NAMED_TOKENS[token];
    if (named) return named.flatMap((t) => keyElsAll.get(t) ?? []);
    if (token.length === 1) {
      const el = [...keyEls.entries()].find(([t]) => t.toLowerCase() === token.toLowerCase())?.[1];
      return el ? [el] : [];
    }
    return [];
  }

  // Reverse lookup: physical key token (data-ktoken, e.g. "ü" / "ArrowLeft" / "h")
  // → binding token (e.g. "BracketLeft" / "Left" / "H"). tokenChords is keyed by
  // binding token, so tooltip/click must translate; letters differ in case.
  const KEY_TO_BINDING = new Map<string, string>();
  for (const [bt, physicals] of Object.entries(NAMED_TOKENS))
    for (const p of physicals) KEY_TO_BINDING.set(p, bt);

  function chordsForKey(btn: HTMLButtonElement): Chord[] {
    const kt = btn.dataset.ktoken ?? "";
    const cand = KEY_TO_BINDING.get(kt) ?? kt;
    const direct = tokenChords.get(cand);
    if (direct) return direct;
    const lower = cand.toLowerCase();
    for (const [tok, list] of tokenChords) if (tok.toLowerCase() === lower) return list;
    return [];
  }

  function applyLayer(): void {
    for (const btn of keyEls.values()) {
      btn.classList.remove("bound", "active");
    }
    for (const [token, list] of tokenChords) {
      const els = keysForToken(token);
      if (els.length === 0) continue;
      const inLayer = list.some((c) => c.mods === selected);
      for (const el of els) {
        el.classList.add("bound");
        if (inLayer) el.classList.add("active");
      }
    }
  }
  applyLayer();

  // ---- tooltip ---------------------------------------------------------
  const tooltip = document.createElement("div");
  tooltip.className = "kb-tooltip hidden";
  document.body.appendChild(tooltip);

  function hideTooltip(): void {
    tooltip.classList.add("hidden");
    tooltip.replaceChildren();
  }

  function showTooltip(btn: HTMLButtonElement): void {
    const list = chordsForKey(btn).filter((c) => c.mods === selected);
    if (list.length === 0) return;
    tooltip.replaceChildren();
    const kline = document.createElement("span");
    kline.className = "t-keys";
    kline.textContent = list[0].keys;
    tooltip.appendChild(kline);
    for (const c of list) {
      const line = document.createElement("div");
      line.textContent = c.label;
      tooltip.appendChild(line);
    }
    tooltip.classList.remove("hidden");
    const rect = btn.getBoundingClientRect();
    const tw = tooltip.offsetWidth;
    const th = tooltip.offsetHeight;
    let left = rect.left + rect.width / 2 - tw / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
    const below = rect.top < 140;
    const top = below ? rect.bottom + 8 : rect.top - th - 8;
    tooltip.style.left = `${Math.round(left)}px`;
    tooltip.style.top = `${Math.round(Math.max(8, top))}px`;
  }

  board.addEventListener("mouseover", (ev) => {
    const btn = (ev.target as Element | null)?.closest?.(".kb-key");
    if (!(btn instanceof HTMLButtonElement)) return;
    if (btn.classList.contains("active") || btn.classList.contains("bound")) showTooltip(btn);
    else hideTooltip();
  });
  board.addEventListener("mouseleave", hideTooltip);
  window.addEventListener("scroll", hideTooltip, { capture: true, passive: true });

  // ---- click → scroll to row -------------------------------------------
  board.addEventListener("click", (ev) => {
    const btn = (ev.target as Element | null)?.closest?.(".kb-key");
    if (!(btn instanceof HTMLButtonElement) || !btn.classList.contains("active")) return;
    const list = chordsForKey(btn).filter((c) => c.mods === selected);
    let row: Element | null = null;
    for (const c of list) {
      row = document.querySelector(`.kb-row[data-keys="${CSS.escape(c.keys)}"]`);
      if (row) break;
    }
    if (!row) {
      // Row may be hidden by the filter — clear it so the row reappears.
      const filter = document.querySelector<HTMLInputElement>(".kb-filter");
      if (filter && filter.value !== "") {
        filter.value = "";
        filter.dispatchEvent(new Event("input", { bubbles: true }));
      }
      for (const c of list) {
        row = document.querySelector(`.kb-row[data-keys="${CSS.escape(c.keys)}"]`);
        if (row) break;
      }
    }
    if (!row) return;
    row.scrollIntoView({ block: "center" });
    row.classList.add("flash");
    row.addEventListener("animationend", () => row!.classList.remove("flash"), { once: true });
    hideTooltip();
  });
}