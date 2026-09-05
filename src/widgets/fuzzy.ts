// Subsequence fuzzy matcher. Returns a rank score (higher = better match),
// or null when `needle` is not a subsequence of `haystack`. Case-insensitive.
// Empty needle matches everything with score 0.

export function fuzzyScore(needle: string, haystack: string): number | null {
  const n = needle.trim().toLowerCase();
  if (!n) return 0;
  const h = haystack.toLowerCase();
  let score = 0;
  let run = 0;
  let ti = 0;
  let firstHit = -1;
  for (const ch of n) {
    const idx = h.indexOf(ch, ti);
    if (idx === -1) return null;
    if (firstHit === -1) firstHit = idx;
    if (idx === ti) {
      run += 1;
      score += 10 + run * 2; // contiguous run bonus
    } else {
      run = 0;
      score += 4;
    }
    // word-boundary bonus (start of string or after separator)
    if (idx === 0 || /[\s/+_:.-]/.test(h[idx - 1])) score += 6;
    ti = idx + 1;
  }
  score -= firstHit * 0.5; // earlier matches rank higher
  score -= (h.length - n.length) * 0.01; // shorter targets rank higher
  return score;
}
