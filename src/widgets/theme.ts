// Theme toggle - dark/light, persists to localStorage("sd-theme").
// Default: dark, unless the user prefers light. Sets data-theme on <html>.

const KEY = "sd-theme";
type Theme = "dark" | "light";

const MOON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
const SUN = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><line x1="12" y1="2" x2="12" y2="4.4"/><line x1="12" y1="19.6" x2="12" y2="22"/><line x1="4.2" y1="21.2" x2="5.9" y2="19.5"/><line x1="18.1" y1="4.5" x2="19.8" y2="2.8"/><line x1="2" y1="12" x2="4.4" y2="12"/><line x1="19.6" y1="12" x2="22" y2="12"/><line x1="4.2" y1="2.8" x2="5.9" y2="4.5"/><line x1="18.1" y1="19.5" x2="19.8" y2="21.2"/></svg>`;

function apply(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  for (const btn of document.querySelectorAll<HTMLButtonElement>("[data-theme-toggle]")) {
    btn.innerHTML = theme === "dark" ? MOON : SUN;
    btn.setAttribute("aria-label", `Switch to ${theme === "dark" ? "light" : "dark"} theme`);
    btn.title = `Theme: ${theme}`;
  }
}

export function initTheme(): void {
  const stored = localStorage.getItem(KEY);
  const initial: Theme =
    stored === "light" || stored === "dark"
      ? stored
      : matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark";
  apply(initial);
  document.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement | null)?.closest("[data-theme-toggle]");
    if (!btn) return;
    const next: Theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    localStorage.setItem(KEY, next);
    apply(next);
  });
}
