import { getLang } from "./i18n.js";
// Replybek's own support chat (our AI agent), on app.replybek.uz only: local and test copies of the
// dashboard don't load it. It has no floating button here, where it would cover the Inbox's Send
// button: the top bar's chat button (with the unread count) and the Help dialog open it.
const KEY = "pk_dec326127ed396bb536b481f";
const API = "https://app.replybek.uz/api";

export function loadSupportChat() {
  if (window.location.hostname !== "app.replybek.uz") return;
  const s = document.createElement("script");
  s.src = `${API}/widget.js`;
  s.defer = true;
  s.dataset.key = KEY;
  s.dataset.api = API;
  s.dataset.launcher = "none";
  document.body.append(s);
}

/** True once the chat can be opened; `onReady` runs when it becomes so. */
export function supportChat(onReady) {
  if (window.Replybek) return true;
  if (onReady) window.addEventListener("replybek:ready", onReady, { once: true });
  return false;
}

export const openSupportChat = () => window.Replybek?.open();

/** Tells our team who's writing: the person, their workspace and plan. */
export function identifySupportChat(user, workspace) {
  const info = {
    user_id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar || undefined,
    company: workspace ? { id: workspace.id, name: workspace.name, plan: workspace.plan, website: workspace.website || undefined } : undefined,
    attributes: workspace
      ? { role: workspace.role, billing: workspace.billing?.access || "off", language: getLang(), workspaces: user.workspaceCount }
      : { language: getLang() },
  };
  // An older cached widget may not have identify() yet.
  const go = () => window.Replybek?.identify?.(info);
  if (!supportChat(go)) return;
  go();
}

/** Signing out: the chat forgets this person in this browser. */
export const resetSupportChat = () => window.Replybek?.reset?.();

/** Calls fn(count) whenever the number of unread support replies changes. Returns unsubscribe. */
export function onSupportUnread(fn) {
  const handler = (e) => fn(e.detail?.count || 0);
  window.addEventListener("replybek:unread", handler);
  return () => window.removeEventListener("replybek:unread", handler);
}
