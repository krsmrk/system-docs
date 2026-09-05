// Shared HTML templates for system-docs - pure string builders, no I/O.
//
// `rel` is the path prefix from the current page to the site root:
// "" for index.html, "../" for apps/*.html and guides/*.html. Every asset
// and page href is emitted relative to that prefix because GitHub Pages
// serves the site under /system-docs/ - never use leading "/".

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
  /** App id - renders <body data-app="…"> on app pages. */
  app?: string;
  /** Verbatim extra markup appended at the end of <head>. */
  extraHead?: string;
  /** Inner markup for <main>. */
  body: string;
  /** Footer left slot - build passes pre-escaped text/HTML. */
  footerLeft: string;
  /** Footer right slot - build passes pre-escaped text/HTML. */
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
  <meta name="description" content="The box manual: keybinding cheat sheets and usage guides for this NixOS system (niri, waybar, fuzzel, ghostty, yazi, zathura, zsh).">
  <meta name="theme-color" content="#2e3440">
  <title>${esc(o.title)} · box manual</title>
  <link rel="stylesheet" href="${rel}assets/app.css">
  <link rel="icon" type="image/svg+xml" href="${rel}assets/favicon.svg">
  <script src="${rel}assets/app.js" defer></script>${extraHead}
</head>
<body data-page="${esc(o.page)}"${appAttr}>
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header" id="top">
    <div class="site-header-inner">
    <a class="site-title" href="${rel}index.html"><span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="2.5" width="19" height="19" rx="4"/><path d="M6.8 8.5l4 3.5-4 3.5"/><line x1="13" y1="15.5" x2="17.5" y2="15.5"/></svg></span> box manual</a>
    <nav aria-label="Site">
      <a href="${rel}index.html" data-nav="index">Overview</a>
      <a href="${rel}index.html#guides" data-nav="guides">Guides</a>
    </nav>
    <button data-theme-toggle type="button" aria-label="Toggle dark/light theme">☾</button>
    </div>
  </header>
  <main id="main">
${o.body}
  </main>
  <footer class="site-footer">
    <span>${o.footerLeft}</span>
    <span>${o.footerRight}</span>
    <a class="to-top" href="#top" aria-label="Back to top">↑ top</a>
  </footer>
</body>
</html>
`;
}