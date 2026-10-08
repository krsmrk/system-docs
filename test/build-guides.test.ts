// End-to-end tests for the build's honesty checks (SPEC "Guide reference
// checks"): chord references in guides must resolve to a bind, `verified:`
// must be a commit hash, app<->guide links must exist, and nixos_config paths
// must exist when a checkout is available.

import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { baseData, cleanupFixtures, guideFile, makeFixture, type RunResult } from "./helpers/fixtures";

after(cleanupFixtures);

function expectFailure(res: RunResult, match: RegExp): void {
  assert.equal(res.status, 1, `expected a failing build, got:\n${res.stdout}\n${res.stderr}`);
  assert.match(res.stderr, match);
}

describe("guide chord references", () => {
  test("normalizes spellings, links unique hits and skips shorthand", async () => {
    const data = baseData();
    const groups = data.apps[0].groups;
    groups[0].bindings = [
      { keys: "Mod+H", label: "left" },
      { keys: "Mod+BracketLeft", label: "previous" },
    ];
    data.apps.push({
      id: "zsh",
      title: "zsh",
      tagline: "shell",
      description: "The shell.",
      icon: "$",
      groups: [{ name: "History", bindings: [{ keys: "Alt+c", label: "fzf cd" }] }],
    });
    const guide = guideFile(
      { title: "Refs", slug: "refs", summary: "s", order: 1, app: "niri" },
      "`Mod+[` jumps back. `Alt+C` opens the picker. `Mod+H/L` is shorthand.",
    );
    const fx = await makeFixture({ data, guides: { "refs.md": guide } });
    const res = fx.run();
    assert.equal(res.status, 0, res.stderr);

    const html = await fx.read("dist/guides/refs.html");
    // "Mod+[" normalizes to the stored XKB name BracketLeft
    assert.match(html, /href="\.\.\/apps\/niri\.html#k-mod-bracketleft"><code>Mod\+\[<\/code>/);
    // "Alt+C" falls back to the case-exact "Alt+c" stored by the character-keyed app
    assert.match(html, /href="\.\.\/apps\/zsh\.html#k-alt-c"><code>Alt\+C<\/code>/);
    // shorthand is never a chord
    assert.ok(!html.includes("k-mod-h-l"));
    assert.equal((html.match(/class="kb-ref"/g) ?? []).length, 2);
  });

  test("an unbound chord fails the build", async () => {
    const fx = await makeFixture({
      data: baseData(),
      guides: { "unknown.md": guideFile({ title: "Unknown", slug: "unknown", order: 1 }, "Press `Ctrl+Q`.") },
    });
    expectFailure(fx.run(), /content\/guides\/unknown\.md: `Ctrl\+Q` is not a bind in any app/);
  });

  test("ignore-keys exempts a chord the data has no bind for", async () => {
    const fx = await makeFixture({
      data: baseData(),
      guides: {
        "ignored.md": guideFile(
          { title: "Ignored", slug: "ignored", order: 1, "ignore-keys": "Ctrl+Q" },
          "Press `Ctrl+Q` (firmware).",
        ),
      },
    });
    const res = fx.run();
    assert.equal(res.status, 0, res.stderr);
    const html = await fx.read("dist/guides/ignored.html");
    assert.ok(!html.includes("kb-ref"), "exempt chords are not linked");
  });

  test("pseudo-keys resolve and shorthand/multi-char chord lookalikes are skipped", async () => {
    const data = baseData();
    data.apps.push({
      id: "waybar",
      title: "waybar",
      tagline: "bar",
      description: "The bar.",
      icon: "+",
      groups: [{ name: "Dots", bindings: [{ keys: "Scroll Up", label: "previous workspace" }] }],
    });
    const fx = await makeFixture({
      data,
      guides: { "pseudo.md": guideFile({ title: "Pseudo", slug: "pseudo", order: 1 }, "`Scroll Up`, `Mod+H/L`, `Mod+1…9`.") },
    });
    const res = fx.run();
    assert.equal(res.status, 0, res.stderr);
    const html = await fx.read("dist/guides/pseudo.html");
    assert.match(html, /href="\.\.\/apps\/waybar\.html#k-scroll-up"><code>Scroll Up<\/code>/);
    assert.equal((html.match(/class="kb-ref"/g) ?? []).length, 1);
  });

  test("a chord bound in several apps is valid but not linked (ambiguous)", async () => {
    const data = baseData();
    data.apps[0].groups[0].bindings.push({ keys: "Ctrl+Space", label: "prefix" });
    data.apps.push({
      id: "zsh",
      title: "zsh",
      tagline: "shell",
      description: "The shell.",
      icon: "$",
      groups: [{ name: "Editor", bindings: [{ keys: "Ctrl+Space", label: "menu" }] }],
    });
    const fx = await makeFixture({
      data,
      guides: { "amb.md": guideFile({ title: "Amb", slug: "amb", order: 1 }, "`Ctrl+Space` is shared.") },
    });
    const res = fx.run();
    assert.equal(res.status, 0, res.stderr);
    const html = await fx.read("dist/guides/amb.html");
    assert.ok(!html.includes("kb-ref"), "ambiguous chord stays unlinked");
  });
});

describe("guide front matter", () => {
  test("verified must be a nixos_config commit hash", async () => {
    const fx = await makeFixture({
      data: baseData(),
      guides: { "bad.md": guideFile({ title: "Bad", slug: "bad", order: 1, verified: "v1.2.3" }, "Text.") },
    });
    expectFailure(fx.run(), /content\/guides\/bad\.md: "verified" must be a nixos_config commit hash, got "v1\.2\.3"/);
  });

  test("missing front matter falls back to the filename; quotes are stripped", async () => {
    const fx = await makeFixture({
      data: baseData(),
      guides: {
        "plain.md": "# Plain heading\n\nText.",
        "quoted.md": `---\ntitle: "Quoted title"\nslug: quoted\nsummary: 'One line'\n---\n\nBody.`,
      },
    });
    const res = fx.run();
    assert.equal(res.status, 0, res.stderr);

    const plain = await fx.read("dist/guides/plain.html");
    assert.match(plain, /<h1>Plain heading<\/h1>/, "markdown h1 is used when present");
    assert.ok(!plain.includes("reviewed against"), "no verified commit");

    const quoted = await fx.read("dist/guides/quoted.html");
    assert.match(quoted, /<h1>Quoted title<\/h1>/);

    const index = await fx.read("dist/index.html");
    assert.match(index, /href="guides\/plain\.html">plain /, "filename is the fallback title");
    assert.match(index, /<span class="g-summary">One line<\/span>/);
  });
});

describe("guide cross-references", () => {
  test("an app pointing at a missing guide slug fails", async () => {
    const data = baseData();
    data.apps[0].guide = "ghost";
    const fx = await makeFixture({ data, guides: {} });
    expectFailure(fx.run(), /apps\[niri\]\.guide = "ghost" but no guide has that slug/);
  });

  test("a guide pointing at an unknown app id fails", async () => {
    const fx = await makeFixture({
      data: baseData(),
      guides: { "x.md": guideFile({ title: "X", slug: "x", order: 1, app: "nope" }, "Text.") },
    });
    expectFailure(fx.run(), /content\/guides\/x\.md: app: "nope" is not an app id in data\/keybinds\.json/);
  });

  test("duplicate guide slugs fail", async () => {
    const fx = await makeFixture({
      data: baseData(),
      guides: {
        "a.md": guideFile({ title: "A", slug: "dup", order: 1 }, "A."),
        "b.md": guideFile({ title: "B", slug: "dup", order: 2 }, "B."),
      },
    });
    expectFailure(fx.run(), /duplicate guide slug "dup"/);
  });
});

describe("nixos_config path check", () => {
  test("existing paths pass and missing paths fail with the path named", async () => {
    const fx = await makeFixture({
      data: baseData(),
      guides: { "paths.md": guideFile({ title: "Paths", slug: "paths", order: 1 }, "See `modules/home/niri.nix`.") },
      nixosConfig: { "modules/home/niri.nix": "# niri\n" },
    });
    const ok = fx.run();
    assert.equal(ok.status, 0, ok.stderr);
    assert.match(ok.stdout, /path check: 1 nixos_config paths verified/);

    await fx.writeGuide("more.md", guideFile({ title: "More", slug: "more", order: 2 }, "See `modules/home/missing.nix`."));
    expectFailure(fx.run(), /content\/guides\/more\.md: path `modules\/home\/missing\.nix` does not exist/);
  });

  test("without a checkout the path check is skipped with a notice", async () => {
    const fx = await makeFixture({
      data: baseData(),
      guides: { "paths.md": guideFile({ title: "Paths", slug: "paths", order: 1 }, "See `modules/home/niri.nix`.") },
    });
    const res = fx.run();
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /no nixos_config checkout at .* - path check skipped/);
  });
});
