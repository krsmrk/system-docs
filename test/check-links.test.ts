// Tests for scripts/check-links.mjs, run against a hand-written dist/ tree.
// The checker is a CI gate: it must catch broken links, missing anchors and
// root-absolute paths (which escape the /system-docs/ Pages base), while
// letting the one deliberately absolute page (404.html) through.

import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { cleanupFixtures, makeLinksFixture } from "./helpers/fixtures";

after(cleanupFixtures);

const CLEAN_INDEX = `<!doctype html>
<html><body>
<a href="apps/niri.html#k-mod-h">row</a>
<a href="#local">local</a>
<img src="assets/x.svg">
<script src="assets/app.js"></script>
<h2 id="local">Local</h2>
</body></html>`;

const CLEAN_FILES = {
  "index.html": CLEAN_INDEX,
  "apps/niri.html": `<div id="k-mod-h"></div>`,
  "assets/x.svg": "<svg/>",
  "assets/app.js": "",
};

describe("check-links", () => {
  test("passes when every relative href/src and fragment resolves", async () => {
    const fx = await makeLinksFixture(CLEAN_FILES);
    const res = fx.run();
    assert.equal(res.status, 0, res.stdout);
    assert.match(res.stdout, /check-links: 4 links in 2 pages, 0 problem\(s\)/);
  });

  test("reports a broken relative link", async () => {
    const fx = await makeLinksFixture({ "index.html": `<a href="missing.html">x</a>` });
    const res = fx.run();
    assert.equal(res.status, 1);
    assert.match(res.stdout, /index\.html: broken link missing\.html/);
    assert.match(res.stdout, /1 problem\(s\)/);
  });

  test("checks same-page fragments", async () => {
    const fx = await makeLinksFixture({ "index.html": `<a href="#nope">a</a>` });
    const res = fx.run();
    assert.equal(res.status, 1);
    assert.match(res.stdout, /index\.html: missing anchor #nope/);
    assert.match(res.stdout, /1 problem\(s\)/);
  });

  // The checker strips the fragment before resolving a relative URL
  // (url.split("#")[0]) and then looks for a "#" in the already-stripped
  // target, so fragments on other pages are never validated.
  test("cross-page fragments are checked too", async () => {
    const fx = await makeLinksFixture({
      "index.html": `<a href="apps/niri.html#gone">b</a>`,
      "apps/niri.html": `<div id="present"></div>`,
    });
    const res = fx.run();
    assert.equal(res.status, 1);
    assert.match(res.stdout, /index\.html: missing anchor apps\/niri\.html#gone/);
  });

  test("a fragment on a missing html file is a broken link, not a missing anchor", async () => {
    const fx = await makeLinksFixture({ "index.html": `<a href="nope.html#x">x</a>` });
    const res = fx.run();
    assert.equal(res.status, 1);
    assert.match(res.stdout, /broken link nope\.html#x/);
  });

  test("rejects root-absolute paths on ordinary pages", async () => {
    const fx = await makeLinksFixture({
      ...CLEAN_FILES,
      "index.html": `<a href="/apps/niri.html">x</a>`,
    });
    const res = fx.run();
    assert.equal(res.status, 1);
    assert.match(res.stdout, /index\.html: root-absolute path \/apps\/niri\.html/);
  });

  test("even the Pages base is rejected on non-404 pages", async () => {
    const fx = await makeLinksFixture({
      ...CLEAN_FILES,
      "index.html": `<a href="/system-docs/apps/niri.html">x</a>`,
    });
    const res = fx.run();
    assert.equal(res.status, 1);
    assert.match(res.stdout, /index\.html: root-absolute path \/system-docs\/apps\/niri\.html/);
  });

  test("allows root-absolute Pages-base paths on 404.html only", async () => {
    const fx = await makeLinksFixture({
      ...CLEAN_FILES,
      "404.html": `<a href="/system-docs/index.html">home</a>`,
    });
    const res = fx.run();
    assert.equal(res.status, 0, res.stdout);
    assert.match(res.stdout, /0 problem\(s\)/);
  });

  test("rejects a 404.html path outside the Pages base", async () => {
    const fx = await makeLinksFixture({
      ...CLEAN_FILES,
      "404.html": `<a href="/elsewhere/x.html">home</a>`,
    });
    const res = fx.run();
    assert.equal(res.status, 1);
    assert.match(res.stdout, /404\.html: root-absolute path \/elsewhere\/x\.html/);
  });

  test("ignores external, mailto and data URLs", async () => {
    const fx = await makeLinksFixture({
      "index.html": `<a href="https://example.com/x">a</a><a href="mailto:x@y">b</a><img src="data:image/png;base64,AAAA">`,
    });
    const res = fx.run();
    assert.equal(res.status, 0, res.stdout);
    assert.match(res.stdout, /0 links in 1 pages, 0 problem\(s\)/);
  });

  test("checks src attributes as well as hrefs", async () => {
    const fx = await makeLinksFixture({
      "index.html": `<img src="assets/missing.svg"><script src="assets/app.js"></script>`,
    });
    const res = fx.run();
    assert.equal(res.status, 1);
    assert.match(res.stdout, /broken link assets\/missing\.svg/);
    assert.match(res.stdout, /broken link assets\/app\.js/);
    assert.match(res.stdout, /2 problem\(s\)/);
  });

  test("does not require anchors on non-HTML targets", async () => {
    const fx = await makeLinksFixture({
      "index.html": `<a href="assets/style.css#nope">x</a>`,
      "assets/style.css": "body {}",
    });
    const res = fx.run();
    assert.equal(res.status, 0, res.stdout);
  });
});
