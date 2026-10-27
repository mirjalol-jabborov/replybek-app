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

/** Names the signed-in person in the chat, so our team sees who they're talking to. */
export function identifySupportChat(user) {
  // An older cached widget may not have identify() yet.
  const go = () => window.Replybek?.identify?.({ name: user.name, email: user.email });
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
