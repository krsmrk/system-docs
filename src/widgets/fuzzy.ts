// Subsequence fuzzy matcher with a scattered-garbage cutoff.
//
// Matching searches the TIGHTEST window (not the leftmost one): naive
// leftmost-greedy would start "copy" at the 'c' in "ctrl+shift+c" and reject
// the real substring match 12 chars later. We slide the start forward until
// the minimal-span window is found, then gate on span so queries like "test"
// only match genuinely tight hits instead of chars scattered across the
// keys+label+command+group haystack.
//
// Score model (higher = better):
//   queryLen / span * 100   (density)
//   +140 contiguous substring, +60 word-boundary start
//   - firstPos * 0.5 (earlier rank higher), - (hay-len) * 0.02

export interface FuzzyHit {
  score: number;
  /** last - first matched index + 1 */
  span: number;
  /** matched char indexes in the haystack */
  positions: number[];
}

/** Find the minimal-span subsequence window of n inside h (from offset >= startAt). */
function bestWindow(n: string, h: string, startAt: number): FuzzyHit | null {
  const qlen = n.length;
  if (qlen === 0) return { score: 0, span: 0, positions: [] };
  let best: FuzzyHit | null = null;
  let start = startAt;
  for (;;) {
    // forward: earliest end position for a window starting at >= start
    const fwd: number[] = [];
    let ti = start;
    let ok = true;
    for (const ch of n) {
      const idx = h.indexOf(ch, ti);
      if (idx === -1) {
        ok = false;
        break;
      }
      fwd.push(idx);
      ti = idx + 1;
    }
    if (!ok) break;
    // backward: tighten the right edge
    const tight: number[] = new Array<number>(qlen);
    let bound = fwd[qlen - 1];
    tight[qlen - 1] = bound;
    for (let i = qlen - 2; i >= 0; i--) {
      bound = h.lastIndexOf(n[i], bound - 1);
      tight[i] = bound;
    }
    const span = tight[qlen - 1] - tight[0] + 1;
    if (best === null || span < best.span) best = { score: 0, span, positions: tight };
    if (span === qlen) break; // earliest contiguous hit — optimal
    start = tight[0] + 1;
  }
  return best;
}

export function fuzzyMatch(needle: string, haystack: string): FuzzyHit | null {
  const n = needle.trim().toLowerCase();
  const h = haystack.toLowerCase();
  if (!n) return { score: 0, span: 0, positions: [] };

  const hit = bestWindow(n, h, 0);
  if (hit === null) return null;

  // gate: 1-2 char queries get a small fuzzy budget; queries of 3+ chars
  // must be contiguous substrings — near-contiguous cross-word weaves
  // ("palette stock") are garbage for real-world queries.
  if (n.length >= 3 ? hit.span !== n.length : hit.span > 6) return null;

  const first = hit.positions[0];
  let score = (n.length / hit.span) * 100;
  if (hit.span === n.length) score += 140; // contiguous substring
  if (first === 0 || /[\s/+_:.-]/.test(h[first - 1])) score += 60; // word boundary
  score -= first * 0.5; // earlier first
  score -= (h.length - n.length) * 0.02; // shorter targets slightly preferred
  return { ...hit, score };
}

/** Compat wrapper (SPEC signature): rank score or null. */
export function fuzzyScore(needle: string, haystack: string): number | null {
  return fuzzyMatch(needle, haystack)?.score ?? null;
}
