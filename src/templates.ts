// Shared HTML page shell for system-docs - pure string builders, no I/O.
//
// `rel` is the path prefix from the current page to the site root:
// "" for index.html, "../" for apps/*.html and guides/*.html. Every asset
// and page href is emitted relative to that prefix because GitHub Pages
// serves the site under /system-docs/ - never use a leading "/". The one
// exception is 404.html, which Pages serves at ANY missing URL and therefore
// gets the absolute Pages base as its `rel`.

import { esc } from "./kbd";

export { esc, kbdChips, rowIdBase } from "./kbd";

export interface PageOptions {
  title: string;
  /** Path prefix from this page to the site root: "" or "../" (or the Pages base for 404). */
  rel: string;
  /** Value for <body data-page="…">: "index" | "app" | "guide" | "404". */
  page: string;
  /** App id - renders <body data-app="…"> on app pages. */
  app?: string;
  /** <meta name="description"> text. */
  description: string;
  /** Inner markup for <main>. */
  body: string;
  /** Footer left slot - build passes pre-escaped text/HTML. */
  footerLeft: string;
  /** Footer right slot - build passes pre-escaped text/HTML. */
  footerRight: string;
}

// Runs before the stylesheet loads so a light-theme reader never sees a dark
// frame: same resolution order as widgets/theme.ts (stored choice, else the
// OS preference, else dark). The attribute default below is the no-JS value.
const THEME_BOOTSTRAP =
  '<script>(function(){try{var t=localStorage.getItem("sd-theme");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";document.documentElement.setAttribute("data-theme",t)}catch(e){}})()</script>';

/** Full HTML page shell: shared header, main, footer. */
export function page(o: PageOptions): string {
  const appAttr = o.app !== undefined ? ` data-app="${esc(o.app)}"` : "";
  const rel = o.rel;
  return `<!doctype html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${esc(o.description)}">
  <meta name="theme-color" content="#2e3440">
  <title>${esc(o.title)} · box manual</title>
  ${THEME_BOOTSTRAP}
  <link rel="stylesheet" href="${rel}assets/app.css">
  <link rel="icon" type="image/svg+xml" href="${rel}assets/favicon.svg">
  <script src="${rel}assets/app.js" defer></script>
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
