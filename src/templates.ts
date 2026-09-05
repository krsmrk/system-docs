// Shared HTML templates for system-docs — pure string builders, no I/O.
//
// `rel` is the path prefix from the current page to the site root:
// "" for index.html, "../" for apps/*.html and guides/*.html. Every asset
// and page href is emitted relative to that prefix because GitHub Pages
// serves the site under /system-docs/ — never use leading "/".

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
 * Render a `keys` string (e.g. "Mod+Shift+BracketLeft", "Ctrl+X B") as kbd
 * chips: steps are split on space, each step is one whole combo in a single
 * <kbd>, and multi-step sequences are separated by
 * `<span class="kb-seq"> </span>`. An empty `keys` (prose-only row) renders
 * nothing.
 */
export function kbdChips(keys: string): string {
  const steps = keys.split(" ").filter((s) => s.length > 0);
  return steps.map(kbdCombo).join('<span class="kb-seq"> </span>');
}

export interface PageOptions {
  title: string;
  /** Path prefix from this page to the site root: "" or "../". */
  rel: string;
  /** Value for <body data-page="…">: "index" | "app" | "guide" | "404". */
  page: string;
  /** App id — renders <body data-app="…"> on app pages. */
  app?: string;
  /** Verbatim extra markup appended at the end of <head>. */
  extraHead?: string;
  /** Inner markup for <main>. */
  body: string;
  /** Footer left slot — build passes pre-escaped text/HTML. */
  footerLeft: string;
  /** Footer right slot — build passes pre-escaped text/HTML. */
  footerRight: string;
}

/** Full HTML page shell: shared header, main, footer. */
export function page(o: PageOptions): string {
  const appAttr = o.app !== undefined ? ` data-app="${esc(o.app)}"` : "";
  const extraHead = o.extraHead !== undefined ? `\n  ${o.extraHead}` : "";
  const rel = o.rel;
  return `<!doctype html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(o.title)} · system-docs</title>
  <link rel="stylesheet" href="${rel}assets/app.css">
  <link rel="icon" type="image/svg+xml" href="${rel}assets/favicon.svg">
  <script src="${rel}assets/app.js" defer></script>${extraHead}
</head>
<body data-page="${esc(o.page)}"${appAttr}>
  <header class="site-header">
    <a class="site-title" href="${rel}index.html">system-docs <span class="dim">— box</span></a>
    <nav>
      <a href="${rel}index.html">Overview</a>
      <a href="${rel}index.html#guides">Guides</a>
    </nav>
    <button data-theme-toggle type="button" aria-label="Toggle dark/light theme">☾</button>
  </header>
  <main>
${o.body}
  </main>
  <footer class="site-footer">
    <span>${o.footerLeft}</span>
    <span>${o.footerRight}</span>
  </footer>
</body>
</html>
`;
}