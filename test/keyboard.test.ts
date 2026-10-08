// Tests for src/widgets/keyboard.ts - the ISO/DE keyboard visual on app
// pages. The data transform is the interesting part: bindings become
// (context, modifier-combo) layers, character-keyed apps move uppercase
// letters and shifted symbols onto the Shift layer, and non-keyboard
// pseudo-keys stay off the board.
//
// Runs against test/helpers/dom.ts, a dependency-free fake DOM.

import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { initKeyboard } from "../src/widgets/keyboard";
import {
  boardKeys,
  keyForToken,
  layerChips,
  selectedChip,
  setupKeyboard,
  type DomEnv,
  type FakeElement,
  type KeyboardSetup,
} from "./helpers/dom";

let activeEnv: DomEnv | null = null;

after(() => activeEnv?.restore());

interface Binding {
  keys: string;
  label?: string;
}

function app(groups: Array<{ name: string; bindings: Binding[] }>): unknown {
  return {
    groups: groups.map((g) => ({
      name: g.name,
      bindings: g.bindings.map((b) => ({ keys: b.keys, label: b.label ?? `do ${b.keys}` })),
    })),
  };
}

function render(data: unknown, opts: Parameters<typeof setupKeyboard>[1] = {}): KeyboardSetup {
  activeEnv?.restore();
  const setup = setupKeyboard(data, opts);
  activeEnv = setup.env;
  initKeyboard();
  return setup;
}

function layersOf(setup: KeyboardSetup): FakeElement {
  assert.ok(setup.host !== null, "host present");
  assert.ok(setup.host.children.length >= 2, "widget rendered layers + board");
  return setup.host.children[0];
}

function boardOf(setup: KeyboardSetup): FakeElement {
  return layersOf(setup).parent!.children[1];
}

function chip(layers: FakeElement, label: string): FakeElement {
  const found = layerChips(layers).find((c) => c.textContent.startsWith(`${label} `));
  assert.ok(found, `chip "${label}" present (have: ${layerChips(layers).map((c) => c.textContent).join(", ")})`);
  return found;
}

describe("keyboard widget bail-outs", () => {
  test("does nothing on non-app pages", () => {
    const setup = render(app([{ name: "Focus", bindings: [{ keys: "Mod+H" }] }]), { page: "guide" });
    assert.equal(setup.host?.children.length, 0);
  });

  test("does nothing when there is no .kb-keyboard mount point", () => {
    const setup = render(app([{ name: "Focus", bindings: [{ keys: "Mod+H" }] }]), { withHost: false });
    assert.equal(setup.host, null);
    assert.equal(setup.doc.querySelectorAll(".kb-layers").length, 0);
  });

  test("survives a prose-only page and bails before building a board", () => {
    const setup = render(app([{ name: "Notes", bindings: [{ keys: "" }] }]));
    assert.equal(setup.host?.children.length, 0);
  });

  test("warns and skips on malformed #app-data", () => {
    const setup = render(undefined, { rawAppData: "{not json" });
    assert.equal(setup.host?.children.length, 0);
    assert.equal(setup.env.warnings.length, 1);
    assert.match(setup.env.warnings[0], /malformed #app-data/);
  });

  test("skips pointer pseudo-keys (Mouse/Scroll) and keeps real binds", () => {
    const setup = render(
      app([
        {
          name: "Workspace dots",
          bindings: [{ keys: "Mouse Left Click" }, { keys: "Scroll Up" }, { keys: "Mouse Back" }, { keys: "Escape" }],
        },
      ]),
    );
    const layers = layersOf(setup);
    assert.equal(layerChips(layers).length, 1, "only the real key forms a layer");
    assert.equal(chip(layers, "no modifier").textContent, "no modifier 1");
    assert.ok(keyForToken(boardOf(setup), "Escape")?.classSet.has("active"));
  });

  // SPEC lists Wheel Up/Down and Forward/Back as pointer pseudo-keys ("the
  // keyboard widget skips them"), but isPointer() only checks Mouse*/Scroll*.
  test("Wheel/Forward/Back pseudo-keys stay off the keyboard too", () => {
    const setup = render(
      app([
        {
          name: "Mouse & nav",
          bindings: [{ keys: "Wheel Up" }, { keys: "Wheel Down" }, { keys: "Forward" }, { keys: "Back" }, { keys: "j" }],
        },
      ]),
    );
    const layers = layersOf(setup);
    assert.equal(layerChips(layers).length, 1);
    assert.equal(chip(layers, "no modifier").textContent, "no modifier 1");
    assert.ok(!keyForToken(boardOf(setup), "ArrowUp")?.classSet.has("bound"));
  });

  test("skips unmodified multi-step sequences but keeps modified prefixes", () => {
    const setup = render(
      app([
        {
          name: "Go to",
          bindings: [{ keys: "g h" }, { keys: "Space f f" }, { keys: "Ctrl+X b" }],
        },
      ]),
    );
    const layers = layersOf(setup);
    assert.equal(layers.querySelectorAll(".kb-layer-group").length, 0, "single context stays flat");
    assert.equal(layerChips(layers).length, 1);
    assert.match(layerChips(layers)[0].title, /plain \(after Ctrl\+X\) - 1 binding on this layer/);
  });
});

describe("keyboard layers", () => {
  test("single-context apps render a flat chip row and select Mod by default", () => {
    const setup = render(app([{ name: "Focus", bindings: [{ keys: "Mod+H" }, { keys: "Mod+L" }] }]));
    const layers = layersOf(setup);
    assert.equal(layers.querySelectorAll(".kb-layer-group").length, 0, "flat chip row");
    const chips = layerChips(layers);
    assert.equal(chips.length, 1);
    assert.equal(chips[0].textContent, "Mod 2");
    assert.equal(chips[0].getAttribute("aria-pressed"), "true");
    assert.equal(chips[0].title, "Mod - 2 bindings on this layer");

    const board = boardOf(setup);
    assert.ok(keyForToken(board, "h")?.classSet.has("active"));
    assert.ok(keyForToken(board, "l")?.classSet.has("active"));
    assert.ok(keyForToken(board, "Mod")?.classSet.has("held"), "Mod keycap held for the Mod layer");
  });

  test("a plain root context is labelled 'no modifier' only for single-context apps", () => {
    const setup = render(app([{ name: "Move", bindings: [{ keys: "Escape" }, { keys: "Mod+H" }] }]));
    const layers = layersOf(setup);
    assert.equal(chip(layers, "no modifier").textContent, "no modifier 1");
    assert.equal(chip(layers, "Mod").textContent, "Mod 1");
    assert.equal(selectedChip(layers)?.textContent, "Mod 1", "Mod layer wins the default");
  });

  test("multiple contexts are grouped under italic context labels, root first", () => {
    const setup = render(
      app([
        { name: "Root", bindings: [{ keys: "Escape" }] },
        { name: "Prefix", bindings: [{ keys: "Ctrl+Space c" }] },
        { name: "Copy mode (vi): move", bindings: [{ keys: "v" }] },
      ]),
    );
    const layers = layersOf(setup);
    const groups = layers.querySelectorAll(".kb-layer-group");
    assert.deepEqual(
      groups.map((g) => g.querySelector(".kb-layer-ctx")?.textContent),
      ["direct", "after Ctrl+Space", "copy mode"],
    );
    // in multi-context apps the unmodified layer is labelled "plain", not "no modifier"
    assert.deepEqual(
      layerChips(layers).map((c) => c.textContent),
      ["plain 1", "plain 1", "plain 1"],
    );
    const prefixChip = groups[1].querySelector(".kb-layer-chip") as FakeElement;
    assert.ok(prefixChip, "prefix context has a chip");
    assert.match(prefixChip.title, /plain \(after Ctrl\+Space\) - 1 binding on this layer/);
  });

  test("busiest plain context wins the default when no Mod layer exists", () => {
    const setup = render(
      app([
        {
          name: "Prefix",
          bindings: [{ keys: "Ctrl+Space a" }, { keys: "Ctrl+Space b" }, { keys: "Ctrl+Space c" }],
        },
        { name: "Copy mode (vi): move", bindings: [{ keys: "h" }, { keys: "j" }] },
      ]),
    );
    const layers = layersOf(setup);
    const selected = selectedChip(layers);
    assert.equal(selected?.textContent, "plain 3");
    assert.match(selected?.title ?? "", /plain \(after Ctrl\+Space\)/);
  });

  test("a pure-modifier binding renders a chip but no key highlight", () => {
    const setup = render(app([{ name: "Global", bindings: [{ keys: "Shift" }] }]));
    const layers = layersOf(setup);
    assert.equal(chip(layers, "Shift").textContent, "Shift 1");
    assert.equal(selectedChip(layers)?.textContent, "Shift 1");
    assert.equal(boardKeys(boardOf(setup)).filter((k) => k.classSet.has("active")).length, 0);
    assert.ok(keyForToken(boardOf(setup), "Shift")?.classSet.has("held"));
  });
});

describe("keyboard case handling", () => {
  test("character-keyed apps turn an uppercase letter into the Shift layer", () => {
    const setup = render(
      app([{ name: "Focus", bindings: [{ keys: "Alt+h" }, { keys: "J" }, { keys: "Ctrl+r" }] }]),
    );
    const layers = layersOf(setup);
    assert.deepEqual(
      layerChips(layers).map((c) => c.textContent),
      ["Ctrl 1", "Shift 1", "Alt 1"],
    );

    const board = boardOf(setup);
    // default is the first layer (no Mod, no plain): Alt
    assert.equal(selectedChip(layers)?.textContent, "Alt 1");
    assert.ok(keyForToken(board, "h")?.classSet.has("active"));
    assert.ok(keyForToken(board, "j")?.classSet.has("bound"));
    assert.ok(!keyForToken(board, "j")?.classSet.has("active"));

    // J is bound on the Shift layer: select Shift and the j key lights up
    chip(layers, "Shift").dispatchEvent("click");
    assert.equal(selectedChip(layers)?.textContent, "Shift 1");
    assert.ok(keyForToken(board, "j")?.classSet.has("active"));
    assert.ok(keyForToken(board, "Shift")?.classSet.has("held"));

    // Ctrl+R is caseless, so it must not gain Shift
    chip(layers, "Ctrl").dispatchEvent("click");
    assert.ok(keyForToken(board, "r")?.classSet.has("active"));
    assert.equal(layerChips(layers).length, 3, "no Ctrl+Shift layer");
  });

  test("niri/XKB-style uppercase letters are plain keys, not Shift", () => {
    const setup = render(app([{ name: "Focus", bindings: [{ keys: "Mod+H" }] }]));
    const layers = layersOf(setup);
    assert.equal(layerChips(layers).length, 1);
    assert.equal(chip(layers, "Mod").textContent, "Mod 1");
    assert.ok(keyForToken(boardOf(setup), "h")?.classSet.has("active"));
  });

  test("shifted symbols map to their German keycap plus Shift; AltGr-only chars drop", () => {
    const setup = render(
      app([{ name: "Yank", bindings: [{ keys: "j" }, { keys: `"` }, { keys: "_" }, { keys: ":" }, { keys: "{" }] }]),
    );
    const layers = layersOf(setup);
    assert.deepEqual(
      layerChips(layers).map((c) => c.textContent),
      ["no modifier 1", "Shift 3"],
    );

    chip(layers, "Shift").dispatchEvent("click");
    const board = boardOf(setup);
    assert.ok(keyForToken(board, "2")?.classSet.has("active"), '" is Shift+2 on DE');
    assert.ok(keyForToken(board, "-")?.classSet.has("active"), "_ is Shift+- on DE");
    assert.ok(keyForToken(board, ".")?.classSet.has("active"), ": is Shift+. on DE");
    assert.ok(!boardKeys(board).some((k) => k.dataset.ktoken === "{"), "AltGr-only symbol has no keycap");

    chip(layers, "no modifier").dispatchEvent("click");
    assert.ok(keyForToken(board, "j")?.classSet.has("active"));
  });
});

describe("keyboard interaction", () => {
  test("clicking an active key scrolls to and flashes its first row", () => {
    const setup = setupKeyboard(app([{ name: "Focus", bindings: [{ keys: "Mod+H" }] }]));
    activeEnv = setup.env;
    const row = setup.doc.createElement("tr");
    row.className = "kb-row";
    row.setAttribute("data-keys", "Mod+H");
    setup.doc.body.appendChild(row);
    initKeyboard();

    const board = boardOf(setup);
    board.dispatchEvent("click", { target: keyForToken(board, "h") });
    assert.equal(row.scrollCalls, 1);
    assert.ok(row.classSet.has("flash"));
  });

  test("clicking a key that is only bound on another layer does nothing", () => {
    const setup = setupKeyboard(app([{ name: "Focus", bindings: [{ keys: "Mod+H" }, { keys: "Alt+L" }] }]));
    activeEnv = setup.env;
    const row = setup.doc.createElement("tr");
    row.className = "kb-row";
    row.setAttribute("data-keys", "Alt+L");
    setup.doc.body.appendChild(row);
    initKeyboard();

    const board = boardOf(setup);
    assert.ok(keyForToken(board, "l")?.classSet.has("bound"));
    board.dispatchEvent("click", { target: keyForToken(board, "l") });
    assert.equal(row.scrollCalls, 0);
  });

  test("hover tooltip lists only the selected layer's chords and hides on leave", () => {
    const setup = render(
      app([
        {
          name: "Focus",
          bindings: [
            { keys: "Mod+H", label: "Focus left" },
            { keys: "Mod+Shift+H", label: "Swap left" },
          ],
        },
      ]),
    );
    const board = boardOf(setup);
    const tooltip = setup.doc.body.querySelector(".kb-tooltip") as FakeElement;
    assert.ok(tooltip, "tooltip element exists");

    board.dispatchEvent("mouseover", { target: keyForToken(board, "h") });
    assert.ok(!tooltip.classSet.has("hidden"));
    assert.match(tooltip.textContent, /Mod\+H/);
    assert.match(tooltip.textContent, /Focus left/);
    assert.ok(!tooltip.textContent.includes("Swap left"), "other layers stay out of the tooltip");

    board.dispatchEvent("mouseleave");
    assert.ok(tooltip.classSet.has("hidden"));
  });

  test("bound keys keep the persistent dot marker across layers", () => {
    const setup = render(
      app([{ name: "Focus", bindings: [{ keys: "Mod+H" }, { keys: "Alt+L" }] }]),
    );
    const board = boardOf(setup);
    assert.ok(keyForToken(board, "l")?.classSet.has("bound"), "L is bound on Alt while Mod is selected");
    assert.ok(!keyForToken(board, "l")?.classSet.has("active"));
  });
});
