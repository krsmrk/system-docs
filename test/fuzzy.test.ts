// Unit tests for src/widgets/fuzzy.ts - the matcher both the app-page filter
// and the landing-page lookup rank with. The quality gate is the behaviour
// that matters: short queries may be slightly scattered, 3+ char queries must
// be contiguous substrings, and the reported positions drive <mark>.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { fuzzyMatch } from "../src/widgets/fuzzy";

describe("fuzzyMatch basics", () => {
  test("empty or whitespace-only query matches everything with a zero hit", () => {
    assert.deepEqual(fuzzyMatch("", "anything"), { score: 0, span: 0, positions: [] });
    assert.deepEqual(fuzzyMatch("   ", "anything"), { score: 0, span: 0, positions: [] });
  });

  test("returns null when the needle is not a subsequence", () => {
    assert.equal(fuzzyMatch("xyz", "Mod+H Focus"), null);
    assert.equal(fuzzyMatch("q", "Mod+H"), null);
  });

  test("is case-insensitive and trims the query", () => {
    const hit = fuzzyMatch("  MOD  ", "mod+h");
    assert.notEqual(hit, null);
    assert.deepEqual(hit?.positions, [0, 1, 2]);
  });

  test("finds the exact contiguous substring", () => {
    const hit = fuzzyMatch("copy", "Copy mode (vi)");
    assert.notEqual(hit, null);
    assert.equal(hit?.span, 4);
    assert.deepEqual(hit?.positions, [0, 1, 2, 3]);
  });
});

describe("fuzzyMatch window selection", () => {
  test("slides past scattered early chars to the tightest window", () => {
    // "copy" would start at the 'c' of "ctrl+..." with a greedy leftmost
    // scan (span 15); the real substring is at index 11.
    const hit = fuzzyMatch("copy", "ctrl+shift+copy");
    assert.deepEqual(hit?.positions, [11, 12, 13, 14]);
    assert.equal(hit?.span, 4);
  });

  test("tightens the right edge as well as advancing the left", () => {
    // greedy forward would pick a@0 + b@4 (span 5); tightening moves the
    // left edge to the a@2 directly before the b.
    const hit = fuzzyMatch("ab", "a a b b");
    assert.equal(hit?.span, 3);
    assert.deepEqual(hit?.positions, [2, 4]);
  });
});

describe("fuzzyMatch quality gate", () => {
  test("3+ char queries are rejected unless contiguous", () => {
    assert.equal(fuzzyMatch("tsh", "ctrl+shift+h"), null);
    assert.equal(fuzzyMatch("pst", "palette stock"), null);
    // near-contiguous cross-word weave: 4 chars, span 5
    assert.equal(fuzzyMatch("pstk", "palette stock"), null);
  });

  test("3+ char contiguous hits still match", () => {
    assert.notEqual(fuzzyMatch("shift", "ctrl+shift+h"), null);
    assert.notEqual(fuzzyMatch("focus", "mod+h Focus column left focus-column-left Focus & movement"), null);
  });

  test("1-2 char queries get a small scattered budget (span <= 6)", () => {
    const tight = fuzzyMatch("ch", "ctrl+h");
    assert.notEqual(tight, null);
    assert.equal(tight?.span, 6);

    assert.equal(fuzzyMatch("ch", "cxxxxxxh"), null); // span 8
    assert.notEqual(fuzzyMatch("h", "ctrl+shift+h"), null); // single char always spans 1
  });
});

describe("fuzzyMatch scoring", () => {
  test("word-boundary starts score higher than mid-word starts", () => {
    const boundary = fuzzyMatch("copy", "copy mode");
    const midWord = fuzzyMatch("copy", "xcopy mode");
    assert.ok(boundary !== null && midWord !== null);
    assert.ok(boundary.score > midWord.score, `${boundary.score} > ${midWord.score}`);
  });

  test("earlier matches rank higher when both sit on a boundary", () => {
    const early = fuzzyMatch("mode", "mode aaaaaa");
    const late = fuzzyMatch("mode", "xx mode");
    assert.ok(early !== null && late !== null);
    assert.ok(early.score > late.score, `${early.score} > ${late.score}`);
  });

  test("shorter haystacks are slightly preferred", () => {
    const short = fuzzyMatch("copy", "copy");
    const long = fuzzyMatch("copy", "copy 12345678");
    assert.ok(short !== null && long !== null);
    assert.ok(short.score > long.score, `${short.score} > ${long.score}`);
  });

  test("contiguous hits outrank scattered ones of the same query", () => {
    const contiguous = fuzzyMatch("ch", "ch");
    const scattered = fuzzyMatch("ch", "c1h");
    assert.ok(contiguous !== null && scattered !== null);
    assert.ok(contiguous.score > scattered.score, `${contiguous.score} > ${scattered.score}`);
  });

  test("reported positions are ascending and inside the haystack", () => {
    const haystack = "mod+h Focus column left focus-column-left Focus & movement";
    const hit = fuzzyMatch("focus-column", haystack);
    assert.notEqual(hit, null);
    const positions = hit?.positions ?? [];
    assert.equal(positions.length, "focus-column".length);
    for (let i = 0; i < positions.length; i++) {
      assert.ok(positions[i] >= 0 && positions[i] < haystack.length);
      if (i > 0) assert.ok(positions[i] > positions[i - 1], "positions ascending");
      assert.equal(haystack[positions[i]].toLowerCase(), "focus-column"[i]);
    }
  });
});
