// Theme system: dark (default) or light. Persisted to localStorage under
// "pp.theme". The user toggle lives in Topbar; the boot effect lives in
// ThemeBoot. These helpers are split out so ThemeBoot stays a pure component
// module (Vite Fast Refresh requirement).

export function readTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  const saved = window.localStorage.getItem("pp.theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia?.("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

export function applyTheme(theme: "dark" | "light"): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
}
