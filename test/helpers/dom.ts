// Minimal fake DOM for exercising the keyboard widget (src/widgets/keyboard.ts)
// under `node --test`. It implements only the surface that initKeyboard()
// touches: element tree, classList, dataset, attributes, events, a tiny
// `.class[attr="value"]` selector matcher, and the geometry stubs the tooltip
// reads. Deliberately dependency-free - no jsdom in this repo.
//
// The fake deliberately *records* dispatched event types and scrollIntoView
// calls so tests can assert side effects without a real browser.

export type FakeListener = (event: FakeEvent) => void;

export interface FakeEvent {
  type: string;
  target: FakeElement;
  defaultPrevented: boolean;
  preventDefault(): void;
  [key: string]: unknown;
}

export class FakeClassList {
  private readonly owner: FakeElement;

  constructor(owner: FakeElement) {
    this.owner = owner;
  }

  add(...names: string[]): void {
    for (const n of names) this.owner.classSet.add(n);
  }

  remove(...names: string[]): void {
    for (const n of names) this.owner.classSet.delete(n);
  }

  contains(name: string): boolean {
    return this.owner.classSet.has(name);
  }

  toggle(name: string, force?: boolean): boolean {
    const next = force ?? !this.owner.classSet.has(name);
    if (next) this.owner.classSet.add(name);
    else this.owner.classSet.delete(name);
    return next;
  }
}

export class FakeElement {
  readonly tagName: string;
  children: FakeElement[] = [];
  parent: FakeElement | null = null;
  readonly attrs = new Map<string, string>();
  readonly dataset: Record<string, string> = {};
  readonly style: Record<string, string> = {};
  readonly listeners = new Map<string, FakeListener[]>();
  /** Event types passed to dispatchEvent(), in order (test observability). */
  readonly dispatched: string[] = [];
  classSet = new Set<string>();
  readonly classList: FakeClassList;
  type = "";
  title = "";
  value = "";
  hidden = false;
  offsetWidth = 0;
  offsetHeight = 0;
  scrollCalls = 0;
  private ownText = "";

  constructor(tagName: string) {
    this.tagName = tagName;
    this.classList = new FakeClassList(this);
  }

  get className(): string {
    return [...this.classSet].join(" ");
  }

  set className(value: string) {
    this.classSet = new Set(value.split(/\s+/).filter(Boolean));
  }

  get textContent(): string {
    return this.ownText + this.children.map((c) => c.textContent).join("");
  }

  set textContent(value: string) {
    this.ownText = value;
    this.children = [];
  }

  appendChild<T extends FakeElement>(child: T): T {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  replaceChildren(...nodes: FakeElement[]): void {
    this.children = [];
    for (const node of nodes) this.appendChild(node);
  }

  setAttribute(name: string, value: string): void {
    this.attrs.set(name, value);
    if (name === "class") this.className = value;
  }

  getAttribute(name: string): string | null {
    return this.attrs.get(name) ?? null;
  }

  addEventListener(type: string, listener: FakeListener): void {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  /** Fire listeners for `type`; `props` overrides fields like `target`. */
  dispatchEvent(type: string, props: Record<string, unknown> = {}): void {
    this.dispatched.push(type);
    const event: FakeEvent = {
      type,
      target: this,
      defaultPrevented: false,
      preventDefault(this: FakeEvent) {
        this.defaultPrevented = true;
      },
      ...props,
    };
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }

  closest(selector: string): FakeElement | null {
    let el: FakeElement | null = this;
    while (el !== null) {
      if (matches(el, selector)) return el;
      el = el.parent;
    }
    return null;
  }

  querySelector(selector: string): FakeElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector: string): FakeElement[] {
    return walk(this).filter((el) => matches(el, selector));
  }

  getBoundingClientRect(): { left: number; top: number; right: number; bottom: number; width: number; height: number } {
    return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
  }

  scrollIntoView(): void {
    this.scrollCalls++;
  }
}

/** Pre-order walk of a subtree (the root included). */
export function walk(root: FakeElement): FakeElement[] {
  const out: FakeElement[] = [];
  const visit = (el: FakeElement): void => {
    out.push(el);
    for (const child of el.children) visit(child);
  };
  visit(root);
  return out;
}

/**
 * Match the compound selectors the widget uses: `tag`, `.class`, `#id`,
 * `[attr]`, `[attr="value"]`, in any combination (no combinators).
 */
export function matches(el: FakeElement, selector: string): boolean {
  let rest = selector.trim();
  const tag = /^[a-zA-Z][\w-]*/.exec(rest);
  if (tag !== null) {
    if (el.tagName.toLowerCase() !== tag[0].toLowerCase()) return false;
    rest = rest.slice(tag[0].length);
  }
  while (rest.length > 0) {
    if (rest.startsWith(".")) {
      const m = /^\.([\w-]+)/.exec(rest);
      if (m === null || !el.classSet.has(m[1])) return false;
      rest = rest.slice(m[0].length);
    } else if (rest.startsWith("#")) {
      const m = /^#([\w-]+)/.exec(rest);
      if (m === null || el.attrs.get("id") !== m[1]) return false;
      rest = rest.slice(m[0].length);
    } else if (rest.startsWith("[")) {
      const end = rest.indexOf("]");
      if (end === -1) throw new Error(`unsupported selector: ${selector}`);
      const body = rest.slice(1, end);
      const eq = body.indexOf("=");
      if (eq === -1) {
        if (!el.attrs.has(body.trim())) return false;
      } else {
        const name = body.slice(0, eq).trim();
        let value = body.slice(eq + 1).trim();
        if (
          value.length >= 2 &&
          ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
        ) {
          value = value.slice(1, -1);
        }
        if ((el.attrs.get(name) ?? el.dataset[name]) !== value) return false;
      }
      rest = rest.slice(end + 1);
    } else {
      throw new Error(`unsupported selector: ${selector}`);
    }
  }
  return true;
}

export class FakeDocument {
  readonly body = new FakeElement("body");
  readonly documentElement = new FakeElement("html");

  createElement(tagName: string): FakeElement {
    return new FakeElement(tagName);
  }

  getElementById(id: string): FakeElement | null {
    return walk(this.body).find((el) => el.attrs.get("id") === id) ?? null;
  }

  querySelector(selector: string): FakeElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector: string): FakeElement[] {
    return walk(this.body).filter((el) => matches(el, selector));
  }
}

interface SavedGlobals {
  document: unknown;
  window: unknown;
  CSS: unknown;
  HTMLButtonElement: unknown;
  Event: unknown;
  consoleWarn: typeof console.warn;
}

export interface DomEnv {
  doc: FakeDocument;
  /** Capture console.warn calls made by the widget under test. */
  readonly warnings: string[];
  restore(): void;
}

/** Install the fake globals; always call restore() when the test is done. */
export function installDom(): DomEnv {
  const g = globalThis as Record<string, unknown>;
  const saved: SavedGlobals = {
    document: g.document,
    window: g.window,
    CSS: g.CSS,
    HTMLButtonElement: g.HTMLButtonElement,
    Event: g.Event,
    consoleWarn: console.warn,
  };
  const doc = new FakeDocument();
  const warnings: string[] = [];
  g.document = doc;
  g.window = { innerWidth: 1200, innerHeight: 800, addEventListener() {}, scrollTo() {} };
  g.CSS = { escape: (s: string) => s };
  g.HTMLButtonElement = FakeElement;
  g.Event = class FakeEventCtor {
    type: string;
    constructor(type: string) {
      this.type = type;
    }
  };
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map(String).join(" "));
  };
  return {
    doc,
    warnings,
    restore() {
      const restore = (key: keyof SavedGlobals, value: unknown): void => {
        const target = globalThis as Record<string, unknown>;
        if (value === undefined) delete target[key];
        else target[key] = value;
      };
      restore("document", saved.document);
      restore("window", saved.window);
      restore("CSS", saved.CSS);
      restore("HTMLButtonElement", saved.HTMLButtonElement);
      restore("Event", saved.Event);
      console.warn = saved.consoleWarn;
    },
  };
}

export interface KeyboardSetup {
  env: DomEnv;
  doc: FakeDocument;
  host: FakeElement | null;
}

/**
 * Install a DOM shaped like an app page: body[data-page=app], an optional
 * `.kb-keyboard` host and a `#app-data` script. The widget is *not* started -
 * tests call initKeyboard() themselves so they can also cover the bail-outs.
 */
export function setupKeyboard(
  appData: unknown,
  opts: { page?: string; withHost?: boolean; rawAppData?: string } = {},
): KeyboardSetup {
  const env = installDom();
  const { doc } = env;
  doc.body.dataset.page = opts.page ?? "app";
  let host: FakeElement | null = null;
  if (opts.withHost !== false) {
    host = doc.createElement("div");
    host.className = "kb-keyboard";
    doc.body.appendChild(host);
  }
  const data = doc.createElement("script");
  data.setAttribute("id", "app-data");
  data.textContent = opts.rawAppData ?? JSON.stringify(appData);
  doc.body.appendChild(data);
  return { env, doc, host };
}

/** All `.kb-key` buttons on a rendered board, in document order. */
export function boardKeys(board: FakeElement): FakeElement[] {
  return board.querySelectorAll(".kb-key");
}

/** Keycap button whose `data-ktoken` equals token (case-insensitive), if any. */
export function keyForToken(board: FakeElement, token: string): FakeElement | null {
  return (
    boardKeys(board).find((el) => (el.dataset.ktoken ?? "").toLowerCase() === token.toLowerCase()) ?? null
  );
}

/** All layer chips anywhere under `.kb-layers`. */
export function layerChips(layers: FakeElement): FakeElement[] {
  return layers.querySelectorAll(".kb-layer-chip");
}

/** The chip with `aria-pressed="true"`, or null. */
export function selectedChip(layers: FakeElement): FakeElement | null {
  return layerChips(layers).find((c) => c.getAttribute("aria-pressed") === "true") ?? null;
}
