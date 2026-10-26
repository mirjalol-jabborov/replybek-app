import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { api } from "./api.js";
import { isLive, onLive, onLiveStatus } from "./live.js";

/**
 * Loads `path` and keeps it fresh. `poll` (ms) refetches in the background while the tab is visible;
 * `pollWhile(data)` can stop polling once nothing is pending. `live` refetches on live updates
 * (live.js): `true` for any change, or `(event) => boolean`; while they flow, `poll` slows to a
 * 30 s fallback. Returns { data, error, loading, reload, setData }.
 */
export function useResource(path, { poll, pollWhile, live } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: Boolean(path) });
  const latest = useRef(path);
  latest.current = path;
  const reload = useCallback(async () => {
    if (!path) return;
    try {
      const data = await api(path);
      if (latest.current === path) setState({ data, error: null, loading: false });
      return data;
    } catch (error) {
      if (latest.current === path) setState((s) => ({ ...s, error, loading: false }));
    }
  }, [path]);
  useEffect(() => {
    setState((s) => ({ data: s.data && latest.current === path ? s.data : null, error: null, loading: Boolean(path) }));
    reload();
  }, [path]);
  const liveRef = useRef(live);
  liveRef.current = live;
  const listening = Boolean(live) && Boolean(path);
  useEffect(() => {
    if (!listening) return;
    return onLive((e) => {
      const want = liveRef.current;
      if (e.resync || want === true || (typeof want === "function" && want(e))) reload();
    });
  }, [listening, reload]);
  const liveUp = useSyncExternalStore(onLiveStatus, isLive);
  const every = listening && liveUp ? Math.max(poll || 0, 30000) : poll;
  const keepPolling = poll && (!pollWhile || (state.data && pollWhile(state.data)));
  useEffect(() => {
    if (!keepPolling) return;
    const t = setInterval(() => document.visibilityState === "visible" && reload(), every);
    return () => clearInterval(t);
  }, [keepPolling, every, reload]);
  const setData = (fn) => setState((s) => ({ ...s, data: typeof fn === "function" ? fn(s.data) : fn }));
  return { ...state, reload, setData };
}

/** Hash routes: #/inbox/<id> → { page: "inbox", id }. */
export function useRoute() {
  const parse = () => {
    const [page = "overview", id = null] = window.location.hash.replace(/^#\/?/, "").split("/");
    return { page, id };
  };
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => setRoute(parse());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}
export const go = (page, id) => {
  window.location.hash = `/${page}${id ? `/${id}` : ""}`;
};

/** Stored per browser: the last workspace and agent someone worked in. */
export function useStored(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const v = localStorage.getItem(key);
      return v === null ? initial : JSON.parse(v);
    } catch {
      return initial;
    }
  });
  const set = (v) => {
    setValue(v);
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {
      // Storage can be unavailable (private mode); the value still works for this visit.
    }
  };
  return [value, set];
}
