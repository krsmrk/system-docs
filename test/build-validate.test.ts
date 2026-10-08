// Validation tests for data/keybinds.json (src/build.mts validateKeybinds).
// Each case mutates the base fixture so exactly one rule is violated and
// asserts the build exits 1 with the rule named in stderr.

import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { baseData, cleanupFixtures, makeFixture, type Fixture } from "./helpers/fixtures";

after(cleanupFixtures);

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyData = any;
function clone(): AnyData {
  return baseData() as AnyData;
}

const CASES: Array<[name: string, make: () => unknown, match: RegExp]> = [
  ["root is not an object", () => [], /root must be an object/],
  ["meta is not an object", () => { const d = clone(); d.meta = "x"; return d; }, /"meta" must be an object/],
  ["meta field is missing", () => { const d = clone(); delete d.meta.host; return d; }, /meta\.host must be a string/],
  ["apps is not an array", () => { const d = clone(); d.apps = {}; return d; }, /"apps" must be an array/],
  ["app is missing a title", () => { const d = clone(); d.apps[0].title = ""; return d; }, /missing or empty "title"/],
  ["app id is not kebab-case", () => { const d = clone(); d.apps[0].id = "Niri"; return d; }, /id "Niri" must be kebab-case/],
  ["app id is duplicated", () => { const d = clone(); d.apps.push(structuredClone(d.apps[0])); return d; }, /duplicate app id "niri"/],
  ["app guide is not a string", () => { const d = clone(); d.apps[0].guide = 42; return d; }, /"guide" must be a string/],
  ["groups is not an array", () => { const d = clone(); d.apps[0].groups = null; return d; }, /"groups" must be an array/],
  ["group is missing a name", () => { const d = clone(); d.apps[0].groups[0].name = ""; return d; }, /missing or empty "name"/],
  ["group description is not a string", () => { const d = clone(); d.apps[0].groups[0].description = 7; return d; }, /"description" must be a string/],
  ["bindings is not an array", () => { const d = clone(); d.apps[0].groups[0].bindings = {}; return d; }, /"bindings" must be an array/],
  ["binding is missing a label", () => { const d = clone(); d.apps[0].groups[0].bindings[0].label = " "; return d; }, /needs a non-empty "label"/],
  ["binding keys is not a string", () => { const d = clone(); d.apps[0].groups[0].bindings[0].keys = 42; return d; }, /needs a "keys" string/],
  ["empty keys without a command", () => { const d = clone(); delete d.apps[0].groups[0].bindings[0].command; d.apps[0].groups[0].bindings[0].keys = ""; return d; }, /keys may be "" only when "command" is present/],
  ["binding command is not a string", () => { const d = clone(); d.apps[0].groups[0].bindings[0].command = 7; return d; }, /"command" must be a string/],
  ["binding source is not a string", () => { const d = clone(); d.apps[0].groups[0].bindings[0].source = 7; return d; }, /"source" must be a string/],
  ["binding custom is not a boolean", () => { const d = clone(); d.apps[0].groups[0].bindings[0].custom = "yes"; return d; }, /"custom" must be a boolean/],
];

describe("keybinds validation", () => {
  let fx: Fixture;

  before(async () => {
    fx = await makeFixture();
  });

  for (const [name, make, match] of CASES) {
    test(`rejects when ${name}`, async () => {
      await fx.writeData(make());
      const res = fx.run();
      assert.equal(res.status, 1, `expected failure, got:\n${res.stdout}\n${res.stderr}`);
      assert.match(res.stderr, match);
    });
  }

  test("accepts a prose-only row (empty keys) when a command is present", async () => {
    const d = clone();
    d.apps[0].groups[0].bindings.push({
      keys: "",
      label: "Overload tap timeout",
      command: "overload_tap_timeout = 200",
    });
    await fx.writeData(d);
    const res = fx.run();
    assert.equal(res.status, 0, res.stderr);

    const html = await fx.read("dist/apps/niri.html");
    assert.match(html, /<tr class="kb-row" id="k-row" data-keys="" data-cmd="overload_tap_timeout = 200">/);
    assert.match(html, /<td class="kb-keys"><\/td>/);
  });
});
