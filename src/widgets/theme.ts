// Theme toggle - dark/light, persists to localStorage("sd-theme").
// Default: dark, unless the user prefers light. Sets data-theme on <html>.

const KEY = "sd-theme";
type Theme = "dark" | "light";

function apply(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  for (const btn of document.querySelectorAll<HTMLButtonElement>("[data-theme-toggle]")) {
    btn.textContent = theme === "dark" ? "☾" : "☀";
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
