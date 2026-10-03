// Key-chip rendering shared by the build (templates.ts) and the browser
// widgets (search.ts) - pure string builders, no I/O.

const MODIFIER_TOKENS = new Set(["Mod", "Ctrl", "Alt", "Shift"]);

/** HTML-escape a string for safe use in text nodes and attributes. */
export function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Render one chord (e.g. "Mod+Shift+BracketLeft") as a single <kbd> whose
 * "+"-separated tokens become <span class="mod"> (Mod|Ctrl|Alt|Shift) or
 * <span class="key">, joined by <span class="kb-plus">+</span>.
 */
function kbdCombo(combo: string): string {
  const spans = combo
    .split("+")
    .filter((t) => t.length > 0)
    .map(
      (t) =>
        `<span class="${MODIFIER_TOKENS.has(t) ? "mod" : "key"}">${esc(t)}</span>`,
    )
    .join('<span class="kb-plus">+</span>');
  return `<kbd>${spans}</kbd>`;
}

/**
 * Render a `keys` string (e.g. "Mod+Shift+BracketLeft", "Ctrl+X b") as kbd
 * chips: steps are split on space, each step is one whole combo in a single
 * <kbd>, and multi-step sequences are separated by
 * `<span class="kb-seq"> </span>`. An empty `keys` (prose-only row) renders
 * nothing.
 */
export function kbdChips(keys: string): string {
  const steps = keys.split(" ").filter((s) => s.length > 0);
  return steps.map(kbdCombo).join('<span class="kb-seq"> </span>');
}

/**
 * Stable anchor id for a binding row: "k-" + the keys, lowercased, with
 * everything but [a-z0-9] turned into "-". Callers dedupe repeats per app
 * (qutebrowser binds the same keys in several modes) by appending "-2", "-3"….
 */
export function rowIdBase(keys: string): string {
  const slug = keys
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `k-${slug || "row"}`;
}
