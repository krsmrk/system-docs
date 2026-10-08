// End-to-end rendering tests for src/build.mts. Each fixture is a throwaway
// mini-repo (see test/helpers/fixtures.ts) built through the real renderer
// bundle; assertions read the emitted dist/ HTML. Covers the DOM contracts in
// SPEC.md and the escaping of data-derived strings.

import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { baseData, cleanupFixtures, guideFile, makeFixture, type Fixture } from "./helpers/fixtures";

const BASICS = guideFile(
  { title: "Basics", slug: "basics", summary: "How to move", order: 1, app: "niri", verified: "7483563" },
  "## Setup & use\n\nPress `Mod+H` then `Mod+L`.\n\n### Detail\n\nMore.\n\n### Detail\n\nAgain.",
);

describe("build rendering", () => {
  let fx: Fixture;

  before(async () => {
    fx = await makeFixture({ data: baseData(), guides: { "basics.md": BASICS } });
    const res = fx.run();
    assert.equal(res.status, 0, `build failed:\n${res.stderr}`);
  });

  after(cleanupFixtures);

  test("app page emits the documented DOM contract", async () => {
    const html = await fx.read("dist/apps/niri.html");
    assert.match(html, /<body data-page="app" data-app="niri">/);
    assert.match(html, /<input class="kb-filter" type="search" placeholder="Filter bindings \(\/\)" aria-label="Filter bindings">/);
    assert.match(html, /<div class="kb-keyboard"><\/div>/);

    // rows: id, data-keys, data-cmd (lowercased), custom class, source link
    assert.match(
      html,
      /<tr class="kb-row custom" id="k-mod-h" data-keys="Mod\+H" data-cmd="focus-column-left">/,
    );
    assert.match(html, /<tr class="kb-row" id="k-mod-l" data-keys="Mod\+L" data-cmd="focus-column-right">/);
    assert.match(
      html,
      /<td class="kb-keys"><kbd><span class="mod">Mod<\/span><span class="kb-plus">\+<\/span><span class="key">H<\/span><\/kbd><\/td>/,
    );
    assert.match(html, /<td class="kb-label">Focus column left<\/td>/);
    assert.match(html, /<td class="kb-command"><code>focus-column-left<\/code><\/td>/);
    assert.match(
      html,
      /<a href="https:\/\/github\.com\/krsmrk\/nixos_config\/blob\/abc1234\/modules\/home\/niri\.nix#L10" title="open in nixos_config @ abc1234">modules\/home\/niri\.nix:10<\/a>/,
    );

    // groups + jump chips
    assert.match(html, /<section class="kb-group" id="g-0">/);
    assert.match(html, /<h3>Focus <span class="group-count">2<\/span><\/h3>/);
    assert.match(html, /<p class="group-desc">Move the focus around\.<\/p>/);
    assert.match(html, /<a class="toc-chip" href="#g-0">Focus <span class="chip-count">2<\/span><\/a>/);

    // origin legend: one custom, one stock row
    assert.match(html, /<p class="origin-legend">Accent border: custom binding · plain: stock default<\/p>/);
    assert.match(html, /<span class="kb-counter">2 bindings<\/span>/);

    // the per-page filter data payload
    assert.match(html, /<script type="application\/json" id="app-data">/);
    assert.match(html, /"id":"niri"/);
  });

  test("guide page has heading anchors, a TOC, key-ref links and meta", async () => {
    const html = await fx.read("dist/guides/basics.html");
    assert.match(html, /<body data-page="guide">/);
    assert.match(html, /<h1>Basics<\/h1>/);
    assert.match(html, /<a class="kb-ref" href="\.\.\/apps\/niri\.html#k-mod-h"><code>Mod\+H<\/code><\/a>/);

    assert.match(html, /<h2 id="setup-use">Setup &amp; use<\/h2>/);
    assert.match(html, /<h3 id="detail">Detail<\/h3>/);
    assert.match(html, /<h3 id="detail-2">Detail<\/h3>/);
    assert.match(html, /<nav class="toc">/);
    assert.match(html, /<li class="lvl2"><a href="#setup-use">Setup &amp; use<\/a><\/li>/);
    assert.match(html, /<li class="lvl3"><a href="#detail">Detail<\/a><\/li>/);
    assert.match(html, /<li class="lvl3"><a href="#detail-2">Detail<\/a><\/li>/);

    assert.match(html, /<p class="guide-meta">Updated \d{4}-\d{2}-\d{2} · reviewed against <a href="https:\/\/github\.com\/krsmrk\/nixos_config\/commit\/7483563">nixos_config @ 7483563<\/a> · bindings: <a href="\.\.\/apps\/niri\.html">niri<\/a><\/p>/);
  });

  test("index page shows hero stats, app cards, guide list and the search box", async () => {
    const html = await fx.read("dist/index.html");
    assert.match(html, /<body data-page="index">/);
    assert.match(html, /<span class="stat"><strong>2<\/strong> bindings<\/span>/);
    assert.match(html, /<span class="stat"><strong>1<\/strong> apps<\/span>/);
    assert.match(html, /<span class="stat"><strong>1<\/strong> guides<\/span>/);
    assert.match(html, /<span class="stat dim">bindings as of 2026-01-02<\/span>/);

    assert.match(html, /<a class="app-card" href="apps\/niri\.html">/);
    assert.match(html, /<h3>niri<\/h3>/);
    assert.match(html, /<p class="tagline">scrollable tiling<\/p>/);
    assert.match(html, /<span class="count">2 bindings<\/span><span>1 custom · 1 stock<\/span>/);

    assert.match(html, /<a href="guides\/basics\.html">Basics <span class="g-summary">How to move<\/span><span class="g-date" title="last updated">\d{4}-\d{2}-\d{2}<\/span><\/a>/);
    assert.match(html, /<input class="kb-search" type="search" placeholder="Search bindings \(\/\)"/);
  });

  test("404 page uses the absolute Pages base and the footer pins the source commit", async () => {
    const html404 = await fx.read("dist/404.html");
    assert.match(html404, /<body data-page="404">/);
    assert.match(html404, /href="\/system-docs\/assets\/app\.css"/);
    assert.match(html404, /<a href="\/system-docs\/index\.html">overview<\/a>/);

    const html = await fx.read("dist/apps/niri.html");
    assert.match(html, /built from nixos_config @ <a href="https:\/\/github\.com\/krsmrk\/nixos_config\/commit\/abc1234">abc1234<\/a>/);
    assert.match(html, /bindings as of 2026-01-02 · <a href="https:\/\/github\.com\/krsmrk\/nixos_config">krsmrk\/nixos_config<\/a>/);
  });

  test("the compact search index keeps app titles and one row per binding", async () => {
    const raw = await fx.read("dist/assets/bindings.json");
    const index = JSON.parse(raw) as { apps: Record<string, string>; rows: string[][] };
    assert.deepEqual(index.apps, { niri: "niri" });
    assert.equal(index.rows.length, 2);
    assert.deepEqual(index.rows[0], ["niri", "Mod+H", "Focus column left", "focus-column-left", "Focus", "k-mod-h"]);
    assert.deepEqual(index.rows[1], ["niri", "Mod+L", "Focus column right", "focus-column-right", "Focus", "k-mod-l"]);
  });
});

describe("build escaping", () => {
  let fx: Fixture;

  before(async () => {
    const data = baseData();
    const app = data.apps[0];
    app.title = "<b>bold</b>";
    app.tagline = `"quote" & <i>italic</i>`;
    app.description = "<script>alert(1)</script>";
    const groups = app.groups;
    groups[0].name = "<script>Group</script>";
    const bindings = groups[0].bindings;
    bindings[0].label = `<img src=x onerror="alert(1)">`;
    bindings[0].command = `</code><script>alert(2)</script>`;
    fx = await makeFixture({ data });
    const res = fx.run();
    assert.equal(res.status, 0, `build failed:\n${res.stderr}`);
  });

  after(cleanupFixtures);

  test("data-derived text is escaped everywhere it lands in HTML", async () => {
    const html = await fx.read("dist/apps/niri.html");
    assert.ok(!html.includes("<img src=x"), "raw label tag must not appear");
    assert.ok(!html.includes("<script>alert"), "raw injected script must not appear");
    assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
    assert.match(html, /&lt;\/code&gt;&lt;script&gt;alert\(2\)&lt;\/script&gt;/);
    assert.match(html, /<h3>&lt;script&gt;Group&lt;\/script&gt; <span class="group-count">/);
    assert.match(html, /<title>&lt;b&gt;bold&lt;\/b&gt; · box manual<\/title>/);
    assert.match(html, /<meta name="description" content="&lt;b&gt;bold&lt;\/b&gt;: &quot;quote&quot; &amp; &lt;i&gt;italic&lt;\/i&gt;\. &lt;script&gt;alert\(1\)&lt;\/script&gt;">/);

    // the JSON payload escapes < > & so it cannot break out of the script tag
    const payload = /<script type="application\/json" id="app-data">([\s\S]*?)<\/script>/.exec(html)?.[1] ?? "";
    assert.ok(payload.includes("\\u003cb\\u003ebold\\u003c/b\\u003e"), payload.slice(0, 200));
    assert.ok(!payload.includes("<b>"), "no raw tag inside the JSON script");
  });

  test("index cards escape the same values", async () => {
    const html = await fx.read("dist/index.html");
    assert.match(html, /<h3>&lt;b&gt;bold&lt;\/b&gt;<\/h3>/);
    assert.match(html, /<p class="tagline">&quot;quote&quot; &amp; &lt;i&gt;italic&lt;\/i&gt;<\/p>/);
    assert.ok(!html.includes("<b>bold</b>"));
  });
});

describe("row anchors", () => {
  let fx: Fixture;

  before(async () => {
    const data = baseData();
    const app = data.apps[0];
    app.groups = [
      { name: "First", bindings: [{ keys: "Mod+H", label: "first" }] },
      { name: "Second", bindings: [{ keys: "Mod+H", label: "second" }, { keys: "Mod+H", label: "third" }] },
    ];
    fx = await makeFixture({
      data,
      guides: {
        "refs.md": guideFile({ title: "Refs", slug: "refs", summary: "s", order: 1, app: "niri" }, "`Mod+H`"),
      },
    });
    const res = fx.run();
    assert.equal(res.status, 0, `build failed:\n${res.stderr}`);
  });

  after(cleanupFixtures);

  test("repeated keys get -2/-3 ids and the guide links the first occurrence", async () => {
    const app = await fx.read("dist/apps/niri.html");
    assert.match(app, /id="k-mod-h"/);
    assert.match(app, /id="k-mod-h-2"/);
    assert.match(app, /id="k-mod-h-3"/);
    assert.equal((app.match(/id="k-mod-h"/g) ?? []).length, 1);

    const guide = await fx.read("dist/guides/refs.html");
    assert.match(guide, /href="\.\.\/apps\/niri\.html#k-mod-h"/);
    assert.ok(!guide.includes("#k-mod-h-2"), "the first occurrence wins the guide link");
  });
});

describe("source rendering", () => {
  let fx: Fixture;

  before(async () => {
    const data = baseData();
    const app = data.apps[0];
    const bindings = app.groups[0].bindings;
    bindings[0].source = "config.kdl:158";
    bindings[1].source = "README.md";
    bindings.push({ keys: "Mod+K", label: "third", command: "third", source: "scripts/extract.mjs" });
    fx = await makeFixture({ data });
    const res = fx.run();
    assert.equal(res.status, 0, `build failed:\n${res.stderr}`);
  });

  after(cleanupFixtures);

  test("repo paths become GitHub blob links; generated files get a title hint", async () => {
    const html = await fx.read("dist/apps/niri.html");
    assert.match(
      html,
      /<span title="~\/\.config\/niri\/config\.kdl - generated from modules\/home\/niri\.nix">config\.kdl:158<\/span>/,
    );
    // repo-root files are not one of the linked prefixes: plain span, file as hint
    assert.match(html, /<span title="README\.md">README\.md<\/span>/);
    // a scripts/ path becomes a blob link, without #L when there is no line number
    assert.match(
      html,
      /<a href="https:\/\/github\.com\/krsmrk\/nixos_config\/blob\/abc1234\/scripts\/extract\.mjs" title="open in nixos_config @ abc1234">scripts\/extract\.mjs<\/a>/,
    );
  });
});
