// Light / dark / system appearance, remembered per browser. The CSS reads data-theme on <html>;
// with no attribute it follows the system setting.
const KEY = "replybek.theme";

export function getTheme() {
  try {
    const t = localStorage.getItem(KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(theme) {
  if (theme === "light" || theme === "dark") document.documentElement.setAttribute("data-theme", theme);
  else document.documentElement.removeAttribute("data-theme");
}

export function setTheme(theme) {
  try {
    if (theme === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    // Storage unavailable: the choice still applies until the page reloads.
  }
  applyTheme(theme);
}
