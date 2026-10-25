import { getLang, t } from "./i18n.js";

/** Calls the Replybek API through /api. Throws ApiError with the server's plain-language message. */
export class ApiError extends Error {
  constructor(status, message, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

const BASE = import.meta.env.VITE_API_BASE || "/api";
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => (onUnauthorized = fn);

export async function api(path, { method = "GET", body, form } = {}) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      credentials: "same-origin",
      headers: { "Accept-Language": getLang(), ...(body ? { "Content-Type": "application/json" } : {}) },
      body: form || (body ? JSON.stringify(body) : undefined),
    });
  } catch {
    throw new ApiError(0, t("Can't reach the Replybek server. Check your connection and try again."));
  }
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith("/auth/")) onUnauthorized();
    const first = data?.issues?.[0];
    const msg = data?.message === "Invalid request" && first ? `${first.path?.join(".") || "Input"}: ${first.message}` : data?.message;
    throw new ApiError(res.status, msg || t("Request failed ({status}).", { status: res.status }), data);
  }
  return data;
}
