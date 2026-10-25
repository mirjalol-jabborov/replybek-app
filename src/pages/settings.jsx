import { useEffect, useState } from "react";
import { t, tk } from "../i18n.js";
import { Icon } from "../icons.jsx";
import { api } from "../api.js";
import { useSession } from "../session.jsx";
import { useWorkspace } from "../workspace.jsx";
import { go } from "../hooks.js";
import { TIMEZONES, ACCENTS, PLANS } from "../constants.js";
import { Confirm, TextInput, Textarea, Combobox, SwitchField, Field, Tabs, tabPanel, Button, IconButton, Avatar, StatusBadge, Table, PageHeader, Section, Sim, Callout, EmptyState, fmt, pct, useToast, initialsOf, toneOf, dateLong, capitalize } from "../ui.jsx";
import { AgentSelect } from "./shared.jsx";
import { Snippet } from "./install.jsx";
import { WidgetPreview } from "./widgetPreview.jsx";

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function UnsavedBar({ onDiscard, onSave, saving }) {
  return (
    <div className="unsaved-bar" role="region" aria-label={t("Unsaved changes")}>
      <span className="ub-text">
        <span className="dirty-dot" />
        {t("You have unsaved changes")}
      </span>
      <Button size="sm" variant="ghost" onClick={onDiscard} disabled={saving}>
        {t("Discard")}
      </Button>
      <Button size="sm" variant="primary" onClick={onSave} loading={saving}>
        {t("Save changes")}
      </Button>
    </div>
  );
}

function WorkspaceTab({ onDirty }) {
  const { base, workspace, summary, isAdmin } = useWorkspace();
  const { refresh } = useSession();
  const toast = useToast();
  const initial = { name: workspace.name || "", website: workspace.website || "", timezone: workspace.timezone || "UTC" };
  const [draft, setDraft] = useState(initial);
  const [err, setErr] = useState({});
  const [saving, setSaving] = useState(false);
  const dirty = !same(draft, initial);
  useEffect(() => onDirty(dirty), [dirty]);
  useEffect(() => () => onDirty(false), []);
  const save = async () => {
    const e = {};
    if (!draft.name.trim()) e.name = t("Business name can't be empty.");
    if (draft.website.trim() && !/^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(draft.website.trim().replace(/^https?:\/\//, ""))) e.website = t("Enter a domain, like example.com.");
    setErr(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      await api(base, { method: "PATCH", body: { name: draft.name.trim(), website: draft.website.trim().replace(/^https?:\/\//, ""), timezone: draft.timezone } });
      await Promise.all([summary.reload(), refresh()]);
      toast(t("Workspace settings saved"));
    } catch (ex) {
      toast(ex.message, { tone: "error" });
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="field-rows">
      <div className="form-head">
        <div>
          <h2 className="section-title">{t("Workspace")}</h2>
          <p className="section-desc">{t("Basic details about your business.")}</p>
        </div>
      </div>
      {!isAdmin && <Callout>{t("Only workspace admins can change these settings.")}</Callout>}
      <TextInput layout="row" id="ws-name" label={t("Business name")} hint={t("The widget shows it by default.")} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} error={err.name} disabled={!isAdmin} maxLength={120} />
      <TextInput layout="row" id="ws-site" label={t("Website")} prefix="https://" placeholder="example.com" value={draft.website} onChange={(e) => setDraft({ ...draft, website: e.target.value })} error={err.website} disabled={!isAdmin} maxLength={200} />
      <Combobox
        layout="row"
        id="ws-tz"
        label={t("Time zone")}
        hint={t("Analytics count days in this time zone.")}
        value={draft.timezone}
        onChange={(v) => setDraft({ ...draft, timezone: v })}
        searchPlaceholder={t("Search time zones")}
        disabled={!isAdmin}
        options={[...(TIMEZONES.some(([v]) => v === "UTC") ? [] : [["UTC", "Coordinated Universal Time", "UTC+0"]]), ...TIMEZONES].map(([v, name, off]) => ({ value: v, label: `${name} (${off})`, description: v, keywords: v }))}
      />
      {dirty && <UnsavedBar onDiscard={() => setDraft(initial)} onSave={save} saving={saving} />}
    </div>
  );
}

function TeamTab() {
  const { members, workspace, user } = useWorkspace();
  const limits = workspace.limits;
  return (
    <div>
      <div className="form-head">
        <div>
          <h2 className="section-title">{t("Team")}</h2>
          <p className="section-desc">{limits ? t("{used} of {total} seats used on the {plan} plan.", { used: members.length, total: limits.seats, plan: capitalize(workspace.plan) }) : " "}</p>
        </div>
      </div>
      <Table
        caption={t("Team members")}
        rowKey={(m) => m.id}
        rows={members}
        columns={[
          {
            key: "who",
            header: t("Member"),
            render: (m) => (
              <div className="cell-main">
                <Avatar initials={initialsOf(m.name)} tone={toneOf(m.id)} />
                <div className="cell-text">
                  <div className="cell-title truncate">
                    {m.name} {m.id === user.id && <span className="muted">{t("(you)")}</span>}
                  </div>
                  <div className="cell-sub truncate">{m.email}</div>
                </div>
              </div>
            ),
          },
          { key: "role", header: t("Role"), shrink: true, render: (m) => <span className="sec">{t(capitalize(m.role))}</span> },
          { key: "since", header: t("Joined"), shrink: true, hideSm: true, render: (m) => <span className="sec">{dateLong(m.created_at)}</span> },
        ]}
      />
      <p className="helper" style={{ marginTop: 10 }}>
        {t("Inviting teammates by email isn't available yet. Each person can create an account, and an owner can add them once invitations ship.")}
      </p>
    </div>
  );
}

function WidgetTab({ onDirty }) {
  const { base, agents, activeAgent, setActiveAgent, workspace, reloadAgents, isAdmin, openDialog } = useWorkspace();
  const toast = useToast();
  const agent = activeAgent;
  const base0 = agent ? { accent: agent.widget?.accent || "#1f3d36", display_name: agent.widget?.display_name || "", branding: agent.widget?.branding !== false, welcome: agent.welcome, origins: agent.allowed_origins || [] } : null;
  const [draft, setDraft] = useState(base0);
  const [origin, setOrigin] = useState("");
  const [originErr, setOriginErr] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(base0), [agent?.id, agent?.updated_at]);
  const dirty = draft && base0 && !same(draft, base0);
  useEffect(() => onDirty(Boolean(dirty)), [dirty]);
  useEffect(() => () => onDirty(false), []);
  if (!agent || !draft) {
    return (
      <div className="box">
        <EmptyState icon="bot" title={t("Create an agent first")} action={<Button size="sm" variant="primary" onClick={() => openDialog("createAgent")}>{t("Create agent")}</Button>}>
          {t("Each agent has its own widget.")}
        </EmptyState>
      </div>
    );
  }
  const canHide = workspace.plan !== "starter";
  const validHex = /^#[0-9a-f]{6}$/i.test(draft.accent);
  const addOrigin = () => {
    let o = origin.trim();
    if (!o) return;
    if (!/^https?:\/\//.test(o)) o = `https://${o}`;
    try {
      const u = new URL(o);
      o = u.origin;
    } catch {
      return setOriginErr(t("Enter a website address, like https://example.com."));
    }
    if (draft.origins.includes(o)) return setOriginErr(t("That website is already on the list."));
    setDraft({ ...draft, origins: [...draft.origins, o] });
    setOrigin("");
    setOriginErr("");
  };
  const save = async () => {
    if (!validHex || !draft.welcome.trim()) return;
    setSaving(true);
    try {
      await api(`${base}/agents/${agent.id}`, {
        method: "PATCH",
        body: { welcome: draft.welcome.trim(), allowed_origins: draft.origins, widget: { accent: draft.accent, display_name: draft.display_name.trim(), branding: canHide ? draft.branding : true } },
      });
      await reloadAgents();
      toast(t("Widget settings saved"), { sub: t("Visitors see the changes the next time the widget loads.") });
    } catch (e) {
      toast(e.message, { tone: "error" });
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="stack" style={{ gap: 28 }}>
      <div className="form-head" style={{ marginBottom: 0 }}>
        <div>
          <h2 className="section-title">{t("Widget")}</h2>
          <p className="section-desc">{t("Each agent has its own chat widget. Changes apply the next time the widget loads.")}</p>
        </div>
        <AgentSelect id="wg-agent" value={agent.id} onChange={setActiveAgent} />
      </div>
      {agent.status !== "active" && (
        <Callout tone="warn" action={<Button size="sm" onClick={() => go("playground")}>{t("Open Playground")}</Button>}>
          {t("{name} is a draft, so its widget isn't answering visitors yet. Publish it from the Playground or the Agents page.", { name: agent.name })}
        </Callout>
      )}
      <div className="widget-layout">
        <div className="field-rows">
          <Field layout="row" id="wg-hex" label={t("Accent color")} hint={t("Header, launcher and visitor messages. Pick a dark shade so white text stays readable.")} error={validHex ? null : t("Use a 6-digit hex color, like #1f3d36.")}>
            <div className="swatches" role="radiogroup" aria-label={t("Preset colors")}>
              {ACCENTS.map((c) => (
                <button type="button" key={c} className="swatch" role="radio" aria-checked={draft.accent.toLowerCase() === c} aria-label={c} style={{ background: c }} onClick={() => setDraft({ ...draft, accent: c })} disabled={!isAdmin} />
              ))}
            </div>
            <div style={{ width: 132 }}>
              <TextInput id="wg-hex" aria-label={t("Custom hex color")} size="sm" className="mono" value={draft.accent} onChange={(e) => setDraft({ ...draft, accent: e.target.value })} aria-invalid={!validHex || undefined} disabled={!isAdmin} />
            </div>
          </Field>
          <TextInput layout="row" id="wg-name" label={t("Display name")} hint={t("Shown at the top of the chat. Leave empty to use “{name}”.", { name: workspace.name })} placeholder={workspace.name} value={draft.display_name} onChange={(e) => setDraft({ ...draft, display_name: e.target.value })} disabled={!isAdmin} maxLength={80} />
          <Textarea layout="row" id="wg-welcome" label={t("Welcome message")} hint={t("The same setting as {name}'s welcome message in the Playground.", { name: agent.name })} rows={3} value={draft.welcome} onChange={(e) => setDraft({ ...draft, welcome: e.target.value })} error={draft.welcome.trim() ? null : t("Add a welcome message.")} disabled={!isAdmin} maxLength={500} />
          <SwitchField layout="row" id="wg-brand" label={t("Show “Powered by Replybek”")} hint={canHide ? t("Appears in the widget footer.") : t("Upgrade to Growth to remove branding.")} checked={canHide ? draft.branding : true} disabled={!canHide || !isAdmin} onChange={(v) => setDraft({ ...draft, branding: v })} />
          <Field layout="row" id="wg-origin" label={t("Allowed websites")} hint={t("Only these sites can load the widget. Leave empty to allow any site.")} error={originErr}>
            {draft.origins.length > 0 && (
              <div className="file-list">
                {draft.origins.map((o) => (
                  <div key={o}>
                    <Icon name="globe" size={14} className="muted" />
                    <span className="truncate mono" style={{ flex: 1 }}>
                      {o}
                    </span>
                    {isAdmin && <IconButton icon="x" size="sm" label={t("Remove {name}", { name: o })} tooltip={false} onClick={() => setDraft({ ...draft, origins: draft.origins.filter((x) => x !== o) })} />}
                  </div>
                ))}
              </div>
            )}
            {isAdmin && (
              <div className="row">
                <TextInput
                  id="wg-origin"
                  aria-label={t("Website to allow")}
                  placeholder="https://example.com"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addOrigin();
                    }
                  }}
                />
                <Button onClick={addOrigin} disabled={!origin.trim()}>
                  {t("Add")}
                </Button>
              </div>
            )}
          </Field>
          {dirty && isAdmin && <UnsavedBar onDiscard={() => setDraft(base0)} onSave={save} saving={saving} />}
        </div>
        <div className="stack" style={{ gap: 8 }}>
          <span className="eyebrow">{t("Preview")}</span>
          <WidgetPreview accent={validHex ? draft.accent : base0.accent} title={draft.display_name.trim() || workspace.name} agentName={agent.name} welcome={draft.welcome} branding={canHide ? draft.branding : true} handoff={agent.handoff} />
        </div>
      </div>
      <Section title={t("Install")} description={t("Paste this before the closing </body> tag on your site.")}>
        <Snippet agent={agent} />
      </Section>
    </div>
  );
}

function BillingTab() {
  const { base, workspace, summary, role } = useWorkspace();
  const toast = useToast();
  const [switching, setSwitching] = useState(null);
  const usage = workspace.usage;
  const limits = workspace.limits;
  if (!usage || !limits) return null;
  const meters = [
    { label: t("AI messages this month"), used: usage.messages, limit: limits.messages },
    { label: t("Agents"), used: usage.agents, limit: limits.agents },
    { label: t("Team seats"), used: usage.seats, limit: limits.seats },
    { label: t("Knowledge sources"), used: usage.sources, limit: limits.sources },
  ];
  const order = PLANS.map((p) => p.id);
  const current = PLANS.find((p) => p.id === workspace.plan);
  return (
    <div className="stack" style={{ gap: 32 }}>
      <Callout tone="info">{t("Billing isn't connected yet. Prices are placeholders, and switching plans only changes your workspace limits. No payment is taken.")}</Callout>
      <Section
        title={
          <span className="row" style={{ gap: 8 }}>
            {t("{plan} plan", { plan: current.name })} <Sim>{t("Placeholder pricing")}</Sim>
          </span>
        }
        description={t("${price} per month", { price: current.price })}
      >
        <div className="usage-grid">
          {meters.map((u) => {
            const p = pct(u.used, u.limit);
            return (
              <div className="usage" key={u.label}>
                <div className="u-top">
                  <span className="label">{u.label}</span>
                  <span className="num sec">
                    {fmt(u.used)} / {fmt(u.limit)}
                  </span>
                </div>
                <div className={"progress" + (p >= 90 ? " warn" : "")} role="progressbar" aria-label={u.label} aria-valuenow={u.used} aria-valuemin={0} aria-valuemax={u.limit}>
                  <span style={{ width: Math.min(100, p) + "%" }} />
                </div>
                <span className="helper">{p >= 90 ? t("{pct}% used · close to the limit", { pct: p }) : t("{pct}% used", { pct: p })}</span>
              </div>
            );
          })}
        </div>
      </Section>
      <Section title={t("Plans")} description={role === "owner" ? t("Switching is simulated until billing is connected.") : t("Only the workspace owner can change the plan.")}>
        <div className="plans">
          {PLANS.map((p) => {
            const isCurrent = p.id === workspace.plan;
            const up = order.indexOf(p.id) > order.indexOf(workspace.plan);
            return (
              <div className={"plan" + (p.id === "growth" ? " featured" : "")} key={p.id}>
                <div className="plan-name">
                  {p.name}
                  {p.id === "growth" && <span className="badge blue">{t("Most popular")}</span>}
                  {isCurrent && <span className="badge outline">{t("Current plan")}</span>}
                </div>
                <div className="plan-price">
                  ${p.price}
                  <small> {t("/ month")}</small>
                </div>
                <ul>
                  {p.features.map((x) => (
                    <li key={x}>
                      <Icon name="check" size={14} />
                      {t(x)}
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <Button disabled>{t("Current plan")}</Button>
                ) : (
                  <Button variant={up ? "primary" : "secondary"} disabled={role !== "owner"} onClick={() => setSwitching(p)}>
                    {up ? t("Upgrade to {plan}", { plan: p.name }) : t("Switch to {plan}", { plan: p.name })}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </Section>
      {switching && (
        <Confirm
          title={t("Switch to {plan}?", { plan: switching.name })}
          body={t("Billing isn't connected, so nothing is charged. Your workspace limits change to the {plan} plan's right away.", { plan: switching.name })}
          confirmLabel={t("Switch to {plan}", { plan: switching.name })}
          onClose={() => setSwitching(null)}
          onConfirm={async () => {
            try {
              await api(`${base}/plan`, { method: "PATCH", body: { plan: switching.id } });
              await summary.reload();
              toast(t("Plan changed to {plan}", { plan: switching.name }), { sub: t("Simulated: no payment was taken.") });
            } catch (e) {
              toast(e.message, { tone: "error", duration: 8000 });
            }
          }}
        />
      )}
    </div>
  );
}

const TABS = [
  { value: "workspace", label: tk("Workspace"), icon: "building" },
  { value: "team", label: tk("Team"), icon: "users" },
  { value: "widget", label: tk("Widget"), icon: "droplet" },
  { value: "billing", label: tk("Plan & billing"), icon: "card" },
];

export function Settings({ id }) {
  const { workspace } = useWorkspace();
  const tab = TABS.some((x) => x.value === id) ? id : "workspace";
  const [dirty, setDirty] = useState({});
  const mark = (key) => (d) => setDirty((x) => (x[key] === d ? x : { ...x, [key]: d }));
  return (
    <>
      <PageHeader title={t("Settings")} description={`${workspace.name} · ${t("workspace, team, widget and plan")}`} />
      <div className="page-body">
        <div className="page-inner">
          <div className="settings">
            <div className="settings-nav">
              <Tabs vertical idBase="st" label={t("Settings sections")} value={tab} onChange={(v) => go("settings", v)} tabs={TABS.map((x) => ({ ...x, label: t(x.label), dirty: dirty[x.value] }))} />
            </div>
            <div className="settings-panel" {...tabPanel("st", tab)}>
              {tab === "workspace" && <WorkspaceTab onDirty={mark("workspace")} />}
              {tab === "team" && <TeamTab />}
              {tab === "widget" && <WidgetTab onDirty={mark("widget")} />}
              {tab === "billing" && <BillingTab />}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
