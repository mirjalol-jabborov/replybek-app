// The agent's side of the link to Replybek CRM: read-only, since the CRM chooses which AI agent
// works with it, where and how far (CRM settings, General). Shown only when the workspace has the CRM.
import { useEffect, useState } from "react";
import { t, tk } from "../i18n.js";
import { Icon } from "../icons.jsx";
import { api } from "../api.js";

/** The CRM app: its own address when built with one, else crm.<domain> next to app.<domain>, else the local one. */
export const CRM_APP_URL = (
  import.meta.env.VITE_CRM_APP_URL || (/^app\./.test(window.location.hostname) ? window.location.origin.replace("//app.", "//crm.") : "http://localhost:5192")
).replace(/\/$/, "");

const MODULES = { booking: tk("Bookings"), store: tk("Orders") };
const LEVELS = { booking: { off: tk("off"), answer: tk("answers"), act: tk("books") }, store: { off: tk("off"), answer: tk("answers"), act: tk("takes orders") } };
const CHANNELS = { widget: tk("Website"), telegram: tk("Telegram") };

export function CrmLink({ base, agent, workspace }) {
  const hasCrm = (workspace.products || []).includes("crm");
  const [link, setLink] = useState(null);
  useEffect(() => {
    if (!hasCrm) return undefined;
    let live = true;
    const load = () => api(`${base}/agents/${agent.id}/crm`).then((r) => live && setLink(r), () => live && setLink(null));
    load();
    // The link is changed in the CRM: coming back to this tab shows it.
    const back = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", back);
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", back);
    };
  }, [base, agent.id, hasCrm]);
  if (!hasCrm || !link?.crm) return null;
  const modules = (link.modules || []).map((m) => `${t(MODULES[m.module])} (${t(LEVELS[m.module][m.level])})`).join(", ");
  const channels = (link.channels || []).map((c) => t(CHANNELS[c])).join(", ") || t("Playground only");
  return (
    <div className="cfg-sec">
      <h2 className="cfg-sec-title">{t("Replybek CRM")}</h2>
      <p className="helper">
        {link.connected ? t("Works with Replybek CRM: {modules} · {channels}", { modules: modules || t("every module off"), channels }) : t("Not connected to the CRM.")}{" "}
        <a className="link" href={`${CRM_APP_URL}/#/settings`} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          {link.connected ? t("Change in the CRM") : t("Connect in the CRM")}
          <Icon name="arrowRight" size={13} />
        </a>
      </p>
    </div>
  );
}
