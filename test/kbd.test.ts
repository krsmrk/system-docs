// Unit tests for src/kbd.ts - the string builders every kbd chip on the site
// goes through (build templates + the landing-page search widget).

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { esc, kbdChips, rowIdBase } from "../src/kbd";

describe("esc", () => {
  test("escapes all five HTML metacharacters", () => {
    assert.equal(esc(`&<>"'`), "&amp;&lt;&gt;&quot;&#39;");
  });

  test("escapes ampersands first, so entities are not double-decoded", () => {
    // If '&' were replaced after the others, the '&' of '&lt;' would be
    // escaped again; if before, the input's '&' is safely literal.
    assert.equal(esc("&lt;"), "&amp;lt;");
    assert.equal(esc("<b>&</b>"), "&lt;b&gt;&amp;&lt;/b&gt;");
  });

  test("leaves ordinary key text untouched", () => {
    assert.equal(esc("Mod+Shift+BracketLeft"), "Mod+Shift+BracketLeft");
  });

  test("escapes single quotes (used inside single-quoted attributes)", () => {
    assert.equal(esc("don't"), "don&#39;t");
  });
});

describe("kbdChips", () => {
  test("renders one modifier/key combo as a single kbd with kb-plus separators", () => {
    assert.equal(
      kbdChips("Mod+Shift+BracketLeft"),
      '<kbd><span class="mod">Mod</span><span class="kb-plus">+</span>' +
        '<span class="mod">Shift</span><span class="kb-plus">+</span>' +
        '<span class="key">BracketLeft</span></kbd>',
    );
  });

  test("renders a two-step sequence as two kbds joined by a kb-seq separator", () => {
    assert.equal(
      kbdChips("Ctrl+X b"),
      '<kbd><span class="mod">Ctrl</span><span class="kb-plus">+</span><span class="key">X</span></kbd>' +
        '<span class="kb-seq"> </span>' +
        '<kbd><span class="key">b</span></kbd>',
    );
  });

  test("renders nothing for the empty keys of a prose-only row", () => {
    assert.equal(kbdChips(""), "");
  });

  test("collapses repeated, leading and trailing spaces between steps", () => {
    const html = kbdChips("  Mod+H   Mod+K ");
    assert.equal((html.match(/<kbd>/g) ?? []).length, 2);
    assert.ok(!html.startsWith('<span class="kb-seq">'));
  });

  test("only Mod/Ctrl/Alt/Shift are modifier spans; other tokens are keys", () => {
    assert.match(kbdChips("Super+Q"), /<span class="key">Super<\/span><span class="kb-plus">\+<\/span><span class="key">Q<\/span>/);
    assert.match(kbdChips("Ctrl+Alt+Escape"), /<span class="mod">Ctrl<\/span>.*<span class="mod">Alt<\/span>.*<span class="key">Escape<\/span>/);
  });

  test("escapes tokens so binding data cannot inject markup", () => {
    const html = kbdChips(`Mod+<img src=x onerror="alert(1)">`);
    assert.ok(!html.includes("<img"), "raw tag must not survive");
    assert.match(html, /&lt;img/);
    assert.match(html, /&quot;alert\(1\)&quot;/);
  });

  test("renders a multi-step sequence with per-step escaping", () => {
    const html = kbdChips("Ctrl+X &");
    assert.equal((html.match(/<kbd>/g) ?? []).length, 2);
    assert.match(html, /<span class="key">&amp;<\/span>/);
  });

  // The plus key itself is a real binding: qutebrowser "Zoom in" (keys "+")
  // and zathura "Zoom in" store the literal "+" token. kbdCombo splits on
  // "+", so the key disappears and the row renders an empty <kbd>.
  test("a literal plus key renders as a visible key chip", () => {
    assert.match(kbdChips("+"), /<span class="key">\+<\/span>/);
    assert.match(kbdChips("Ctrl++"), /<span class="mod">Ctrl<\/span>.*<span class="key">\+<\/span>/);
  });
});

describe("rowIdBase", () => {
  test("slugifies a simple chord", () => {
    assert.equal(rowIdBase("Mod+H"), "k-mod-h");
  });

  test("keeps sequence steps separated by a dash", () => {
    assert.equal(rowIdBase("Ctrl+X b"), "k-ctrl-x-b");
  });

  test("lowercases and collapses punctuation runs", () => {
    assert.equal(rowIdBase("Mod+Shift+BracketLeft"), "k-mod-shift-bracketleft");
    assert.equal(rowIdBase("Mouse Left Click"), "k-mouse-left-click");
    assert.equal(rowIdBase("yy"), "k-yy");
  });

  test("drops leading/trailing separators (qutebrowser ';b' -> k-b)", () => {
    assert.equal(rowIdBase(";b"), "k-b");
    assert.equal(rowIdBase(":q"), "k-q");
  });

  test("falls back to k-row when nothing alphanumeric remains", () => {
    assert.equal(rowIdBase(""), "k-row");
    assert.equal(rowIdBase("  "), "k-row");
    assert.equal(rowIdBase("ü"), "k-row");
    assert.equal(rowIdBase("+"), "k-row");
  });

  test("is case-insensitive so Mod+h and Mod+H collide and get deduped", () => {
    assert.equal(rowIdBase("Mod+h"), rowIdBase("Mod+H"));
  });
});
