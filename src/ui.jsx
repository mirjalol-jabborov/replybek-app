// Shared UI: re-exports the component system plus formatting helpers.
import { t, locale } from "./i18n.js";
export { Dialog, Drawer, Confirm, Popover, Tooltip } from "./components/overlay.jsx";
export { Button, IconButton, Field, TextInput, Textarea, Switch, SwitchField, SegmentedControl, Tabs, tabPanel, StatusBadge, Avatar, Sim, Callout, EmptyState, PageHeader, Section, MetricsStrip, Table, ToastProvider, useToast } from "./components/controls.jsx";
export { Select, Combobox, ActionMenu } from "./components/menus.jsx";

export const fmt = (n) => Number(n || 0).toLocaleString(locale());
export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const ms = (x) => (typeof x === "number" ? x : new Date(x).getTime());
export function timeAgo(x) {
  const mins = Math.floor(Math.max(0, Date.now() - ms(x)) / 60000);
  if (mins < 1) return t("Just now");
  if (mins < 60) return t("{n}m ago", { n: mins });
  const h = Math.floor(mins / 60);
  if (h < 24) return t("{n}h ago", { n: h });
  const days = Math.floor(h / 24);
  if (days < 7) return t("{n}d ago", { n: days });
  return new Date(ms(x)).toLocaleDateString(locale(), { month: "short", day: "numeric" });
}
/** Compact age for dense lists: "now", "12m", "3h", "2d". */
export function shortAge(x) {
  const mins = Math.floor(Math.max(0, Date.now() - ms(x)) / 60000);
  if (mins < 1) return t("now");
  if (mins < 60) return t("{n}m", { n: mins });
  const h = Math.floor(mins / 60);
  if (h < 24) return t("{n}h", { n: h });
  return t("{n}d", { n: Math.floor(h / 24) });
}
export const clock = (x) => new Date(ms(x)).toLocaleTimeString(locale(), { hour: "numeric", minute: "2-digit" });
export const dateLong = (x) => new Date(ms(x)).toLocaleDateString(locale(), { month: "short", day: "numeric", year: "numeric" });
export const initialsOf = (name = "") =>
  name
    .split(/\s+/)
    .map((p) => p.match(/[\p{L}\p{N}]/u)?.[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

const TONES = ["t1", "t2", "t3", "t4", "t5", "t6"];
/** A stable avatar color for any id or name. */
export const toneOf = (key = "") => TONES[[...key].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7) % TONES.length];

export const TYPE_META = {
  website: { icon: "globe" },
  file: { icon: "file" },
  qa: { icon: "qa" },
};
/** Translated name of a source type. */
export const typeLabel = (type) => ({ website: t("Website"), file: t("File"), qa: t("Q&A") })[type];

export async function copyText(text, fallbackEl) {
  try {
    if (!navigator.clipboard) throw new Error("no clipboard");
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    if (fallbackEl) {
      const r = document.createRange();
      r.selectNodeContents(fallbackEl);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
    }
    return false;
  }
}

/** A light shape check for typed web addresses; the server decides what it can actually read. */
export function looksLikeUrl(v) {
  try {
    const u = new URL(/^https?:\/\//i.test(v.trim()) ? v.trim() : `https://${v.trim()}`);
    return u.hostname.includes(".") || u.hostname === "localhost";
  } catch {
    return false;
  }
}
export const capitalize = (s = "") => s.charAt(0).toUpperCase() + s.slice(1);
