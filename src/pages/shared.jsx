import { useWorkspace } from "../workspace.jsx";
import { api } from "../api.js";
import { t } from "../i18n.js";
import { Select, SegmentedControl, Avatar, initialsOf, toneOf } from "../ui.jsx";

/** Agent picker grouped by status. `allowAll` adds an "All agents" choice for workspace-level filters. */
export function AgentSelect({ value, onChange, allowAll, id, size = "md", prefix, width = 240, label }) {
  const { agents, activeAgent, setActiveAgent } = useWorkspace();
  const options = [
    ...(allowAll ? [{ value: "all", label: t("All agents"), icon: "layers", description: t("{count} agents in this workspace", { count: agents.length }) }] : []),
    ...agents.map((a) => ({
      value: a.id,
      label: a.name,
      group: allowAll ? undefined : a.status === "active" ? t("Published") : t("Drafts"),
      description: `${a.status === "active" ? t("Published") : t("Draft")} · ${t("{count} sources", { count: a.source_count ?? 0 })}`,
      lead: <Avatar initials={initialsOf(a.name)} tone={toneOf(a.id)} src={a.widget?.logo || undefined} size="xs" square />,
    })),
  ];
  return (
    <Select
      id={id}
      label={label}
      aria-label={label ? undefined : t("Agent")}
      value={value !== undefined ? value : activeAgent?.id}
      onChange={onChange || setActiveAgent}
      options={options}
      size={size}
      prefix={label ? undefined : prefix === undefined ? t("Agent") : prefix}
      width={width}
      menuMinWidth={260}
      placeholder={t("No agents yet")}
      disabled={!agents.length}
    />
  );
}

export function RangeControl({ value, onChange }) {
  return (
    <SegmentedControl
      label={t("Date range")}
      value={value}
      onChange={onChange}
      options={[7, 30, 90].map((d) => ({ value: d, label: t("{days} days", { days: d }), ariaLabel: t("Last {days} days", { days: d }) }))}
    />
  );
}

/** Loading and error states shared by pages. */
export function Loading({ label = t("Loading…") }) {
  return (
    <div className="empty" role="status">
      <span className="spin" style={{ width: 18, height: 18, border: "2px solid var(--border-strong)", borderTopColor: "var(--accent)", borderRadius: "50%", display: "inline-block" }} />
      <div className="empty-body">{label}</div>
    </div>
  );
}

/**
 * Back from Polar's checkout: asks the API to check with Polar itself rather than waiting for the
 * webhook, which can be late and, on a server Polar cannot reach, never arrives at all. Reloads
 * the workspace after every attempt, so the dashboard unlocks the moment the subscription is found.
 */
export async function claimCheckout(base, reload, tries = 5) {
  for (let attempt = 0; attempt < tries; attempt++) {
    const found = await api(`${base}/billing/sync`, { method: "POST" }).then((r) => Boolean(r?.status), () => false);
    await reload();
    if (found) return true;
    await new Promise((done) => setTimeout(done, 2000));
  }
  return false;
}
