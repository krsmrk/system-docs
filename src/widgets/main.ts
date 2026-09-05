// Widget entry point - bundled by esbuild to dist/assets/app.js.
// Loaded with <script defer>, so DOM is ready. Auto-inits per page type.

import { initFilter } from "./filter";
import { initKeyboard } from "./keyboard";
import { initTheme } from "./theme";

initTheme();

if (document.body.dataset.page === "app") {
  initFilter();
  initKeyboard();
}

// nav active state (aria-current): app pages live under "Overview"
const navKey = document.body.dataset.page === "guide" ? "guides" : "index";
for (const a of document.querySelectorAll<HTMLAnchorElement>(".site-header nav a")) {
  if (a.dataset.nav === navKey) a.setAttribute("aria-current", "page");
}

// footer back-to-top: a plain #top anchor is a silent no-op once the hash is
// already #top (second click scrolls nowhere) - always smooth-scroll instead.
document.querySelector(".site-footer .to-top")?.addEventListener("click", (e) => {
  e.preventDefault();
  window.scrollTo({ top: 0, behavior: "smooth" });
});
