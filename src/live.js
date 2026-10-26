import { apiUrl } from "./api.js";

/**
 * Live updates for the open workspace: one event stream (GET /w/:wid/stream) that says which
 * conversations changed. Screens subscribe through useResource's `live` option and fetch as usual;
 * their polls slow down to a fallback while the stream is up.
 */
const listeners = new Set();
const statusListeners = new Set();
let source = null;
let up = false;
let retry = null;

function setUp(value) {
  if (up === value) return;
  up = value;
  for (const fn of statusListeners) fn();
}
const tell = (event) => {
  for (const fn of listeners) fn(event);
};

/** Opens the stream for a workspace path (`/w/<id>`), replacing any other. */
export function connectLive(base) {
  disconnectLive();
  if (typeof EventSource === "undefined") return;
  const open = () => {
    const s = (source = new EventSource(apiUrl(`${base}/stream`), { withCredentials: true }));
    // "ready" comes once the server listens: catch up on anything that changed meanwhile.
    s.addEventListener("ready", () => {
      setUp(true);
      tell({ resync: true });
    });
    s.onmessage = (e) => {
      try {
        tell(JSON.parse(e.data));
      } catch {
        // not ours
      }
    };
    s.onerror = () => {
      setUp(false);
      // The browser retries by itself unless the server refused (signed out, removed): then try slowly.
      if (s.readyState === EventSource.CLOSED && source === s) {
        source = null;
        retry = setTimeout(open, 15000);
      }
    };
  };
  open();
}

export function disconnectLive() {
  clearTimeout(retry);
  if (source) source.close();
  source = null;
  setUp(false);
}

/** Calls fn({ c: [conversation ids] } or { resync: true }) for each change. Returns unsubscribe. */
export function onLive(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const isLive = () => up;
export function onLiveStatus(fn) {
  statusListeners.add(fn);
  return () => statusListeners.delete(fn);
}
