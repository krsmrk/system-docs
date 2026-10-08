// Unit tests for src/templates.ts - the shared page shell. The important
// contract here is escaping: every value coming from data (titles,
// descriptions, app ids) must be HTML-escaped before it lands in an
// attribute or text node, while `body`/footer slots are pre-escaped HTML and
// must pass through (the build owns their escaping).

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { esc, kbdChips, page, rowIdBase } from "../src/templates";
import * as kbd from "../src/kbd";

function opts(overrides: Partial<Parameters<typeof page>[0]> = {}) {
  return {
    title: "Overview",
    rel: "",
    page: "index",
    description: "The box manual.",
    body: "<h1>hello</h1>",
    footerLeft: "left slot",
    footerRight: "right slot",
    ...overrides,
  };
}

describe("templates re-exports", () => {
  test("re-exports the kbd helpers the build uses (single implementation)", () => {
    assert.equal(esc, kbd.esc);
    assert.equal(kbdChips, kbd.kbdChips);
    assert.equal(rowIdBase, kbd.rowIdBase);
  });
});

describe("page", () => {
  test("emits the shared shell: doctype, theme, header, nav, main, footer, to-top", () => {
    const html = page(opts());
    assert.match(html, /^<!doctype html>\n<html lang="en" data-theme="dark">/);
    assert.match(html, /<meta charset="utf-8">/);
    assert.match(html, /<meta name="theme-color" content="#2e3440">/);
    assert.match(html, /<body data-page="index">/);
    assert.match(html, /<a class="skip-link" href="#main">Skip to content<\/a>/);
    assert.match(html, /<header class="site-header" id="top">/);
    assert.match(html, /href="index.html" data-nav="index">Overview<\/a>/);
    assert.match(html, /href="index.html#guides" data-nav="guides">Guides<\/a>/);
    assert.match(html, /data-theme-toggle/);
    assert.match(html, /<main id="main">\n<h1>hello<\/h1>\n  <\/main>/);
    assert.match(html, /<span>left slot<\/span>/);
    assert.match(html, /<span>right slot<\/span>/);
    assert.match(html, /<a class="to-top" href="#top" aria-label="Back to top">↑ top<\/a>/);
    assert.match(html, /<title>Overview · box manual<\/title>/);
  });

  test("prepends rel to every asset/page reference and never uses a root path", () => {
    const html = page(opts({ rel: "../", page: "app", app: "niri" }));
    assert.match(html, /href="\.\.\/assets\/app\.css"/);
    assert.match(html, /href="\.\.\/assets\/favicon\.svg"/);
    assert.match(html, /src="\.\.\/assets\/app\.js" defer/);
    assert.match(html, /<a class="site-title" href="\.\.\/index\.html">/);
    assert.match(html, /href="\.\.\/index\.html" data-nav="index"/);
    assert.ok(!/href="\/assets/.test(html), "no root-absolute asset path");
  });

  test("404 pages use the absolute Pages base because Pages serves them anywhere", () => {
    const html = page(opts({ rel: "/system-docs/", page: "404", title: "Page not found" }));
    assert.match(html, /href="\/system-docs\/assets\/app\.css"/);
    assert.match(html, /src="\/system-docs\/assets\/app\.js"/);
    assert.match(html, /href="\/system-docs\/index\.html"/);
  });

  test("escapes title, description, page name and app id", () => {
    const html = page(
      opts({
        title: `<script>alert("t")</script>`,
        description: `"desc" & <b>bold</b>`,
        page: `app" onload="x`,
        app: `nir"i<`,
      }),
    );
    assert.ok(!html.includes("<script>alert"), "title must not inject a tag");
    assert.match(html, /<title>&lt;script&gt;alert\(&quot;t&quot;\)&lt;\/script&gt; · box manual<\/title>/);
    assert.match(html, /<meta name="description" content="&quot;desc&quot; &amp; &lt;b&gt;bold&lt;\/b&gt;">/);
    assert.match(html, /<body data-page="app&quot; onload=&quot;x" data-app="nir&quot;i&lt;">/);
  });

  test("omits data-app when no app is given", () => {
    assert.match(page(opts()), /<body data-page="index">/);
    assert.ok(!page(opts()).includes('data-app="'));
  });

  test("passes pre-escaped body and footer slots through verbatim", () => {
    const html = page(opts({ body: `<p class="x">a &amp; b</p>`, footerLeft: `<a href="#">x</a>` }));
    assert.match(html, /<p class="x">a &amp; b<\/p>/);
    assert.match(html, /<span><a href="#">x<\/a><\/span>/);
  });

  test("theme bootstrap runs before the stylesheet and resolves stored/OS theme", () => {
    const html = page(opts());
    const bootstrap = html.indexOf("localStorage.getItem(\"sd-theme\")");
    const stylesheet = html.indexOf("assets/app.css");
    assert.ok(bootstrap !== -1, "inline bootstrap present");
    assert.ok(bootstrap < stylesheet, "bootstrap must precede the stylesheet");
    assert.match(html, /matchMedia\("\(prefers-color-scheme: light\)"\)/);
  });
});
