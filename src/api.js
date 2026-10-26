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
/** A full API address, for links the browser follows itself (e.g. "Continue with Google"). */
export const apiUrl = (path) => BASE + path;
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => (onUnauthorized = fn);
// Billing said no (free test messages used, trial not started, subscription ended): the dashboard shows
// one "start your trial" prompt for every such refusal, wherever it came from.
let onPaymentRequired = () => {};
export const setPaymentRequiredHandler = (fn) => (onPaymentRequired = fn);
export const needsTrial = (e) => e?.status === 402 && ["trial_required", "subscription_ended"].includes(e.body?.code);

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
    if (res.status === 402 && ["trial_required", "subscription_ended"].includes(data?.code)) onPaymentRequired(data);
    const first = data?.issues?.[0];
    const msg = limitMessage(data) || trialMessage(data) || (data?.message === "Invalid request" && first ? `${first.path?.join(".") || "Input"}: ${first.message}` : data?.message);
    throw new ApiError(res.status, msg || t("Request failed ({status}).", { status: res.status }), data);
  }
  return data;
}

/** Plan-limit refusals carry a code, so they read in the dashboard's language. */
export function limitMessage(data) {
  const count = Number(data?.limit || 0).toLocaleString();
  if (data?.code === "limit_agents") {
    return Number(data.limit) === 1 ? t("Your plan includes 1 agent. Upgrade the plan to add another.") : t("Your plan includes {count} agents. Upgrade the plan or delete an agent first.", { count });
  }
  if (data?.code === "limit_sources") return t("Your plan includes {count} knowledge sources. Upgrade the plan or remove a source first.", { count });
  if (data?.code === "limit_messages") return t("You've used all {count} AI messages in your plan this month. Upgrade the plan to keep your agents answering.", { count });
  return null;
}

/** The dashboard's own wording (in the user's language) for a billing refusal; null for anything else. */
export function trialMessage(data) {
  if (data?.code === "subscription_ended") return data.reason === "read_only" ? t("Your subscription has ended. Choose a plan to make changes.") : t("Your subscription has ended. Choose a plan to keep using AI features.");
  if (data?.code !== "trial_required") return null;
  if (data.reason === "preview_used") return t("You've used the free test messages. Start your 7-day free trial to keep testing.");
  if (data.reason === "read_only") return t("Start your 7-day free trial to make changes.");
  return t("Start your 7-day free trial to put your agent live.");
}
