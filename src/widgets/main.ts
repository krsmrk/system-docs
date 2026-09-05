// Widget entry point — bundled by esbuild to dist/assets/app.js.
// Loaded with <script defer>, so DOM is ready. Auto-inits per page type.

import { initFilter } from "./filter";
import { initKeyboard } from "./keyboard";
import { initTheme } from "./theme";

initTheme();

if (document.body.dataset.page === "app") {
  initFilter();
  initKeyboard();
}
