import { questionsFor } from "../suggestions.js";
import { useEffect, useState } from "react";
import { t, tk } from "../i18n.js";
import { Icon } from "../icons.jsx";
import { api } from "../api.js";
import { useSession } from "../session.jsx";
import { useWorkspace } from "../workspace.jsx";
import { go, useResource } from "../hooks.js";
import { TIMEZONES, ACCENTS, PLANS } from "../constants.js";
import {
  Confirm,
  Dialog,
  Select,
  ActionMenu,
  TextInput,
  Textarea,
  Combobox,
  SwitchField,
  Field,
  Tabs,
  tabPanel,
  Button,
  IconButton,
  Avatar,
  StatusBadge,
  Table,
  PageHeader,
  Section,
  Sim,
  Callout,
  EmptyState,
  fmt,
  pct,
  useToast,
  initialsOf,
  toneOf,
  dateLong,
  capitalize,
} from "../ui.jsx";
import { AgentSelect } from "./shared.jsx";
import { Snippet } from "./install.jsx";
import { WidgetPreview, LogoPicker } from "./widgetPreview.jsx";

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
  const { base, workspace, summary, isAdmin, locked } = useWorkspace();
  const { refresh } = useSession();
  const toast = useToast();
  const initial = {
    name: workspace.name || "",
    website: workspace.website || "",
    timezone: workspace.timezone || "UTC",
  };
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
      await api(base, {
        method: "PATCH",
        body: {
          name: draft.name.trim(),
          website: draft.website.trim().replace(/^https?:\/\//, ""),
          timezone: draft.timezone,
        },
      });
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
      {!isAdmin && !locked && <Callout>{t("Only workspace admins can change these settings.")}</Callout>}
      <TextInput
        layout="row"
        id="ws-name"
        label={t("Business name")}
        hint={t("The widget shows it by default.")}
        value={draft.name}
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        error={err.name}
        disabled={!isAdmin}
        maxLength={120}
      />
      <TextInput
        layout="row"
        id="ws-site"
        label={t("Website")}
        prefix="https://"
        placeholder="example.com"
        value={draft.website}
        onChange={(e) => setDraft({ ...draft, website: e.target.value })}
        error={err.website}
        disabled={!isAdmin}
        maxLength={200}
      />
      <Combobox
        layout="row"
        id="ws-tz"
        label={t("Time zone")}
        hint={t("Analytics count days in this time zone.")}
        value={draft.timezone}
        onChange={(v) => setDraft({ ...draft, timezone: v })}
        searchPlaceholder={t("Search time zones")}
        disabled={!isAdmin}
        options={[...(TIMEZONES.some(([v]) => v === "UTC") ? [] : [["UTC", "Coordinated Universal Time", "UTC+0"]]), ...TIMEZONES].map(([v, name, off]) => ({
          value: v,
          label: `${name} (${off})`,
          description: v,
          keywords: v,
        }))}
      />
      {dirty && <UnsavedBar onDiscard={() => setDraft(initial)} onSave={save} saving={saving} />}
    </div>
  );
}

const roleLabel = (role) => ({ owner: t("Owner"), admin: t("Admin"), agent: t("Agent") })[role] || capitalize(role);
const ROLE_OPTIONS = () => [
  { value: "agent", label: t("Agent"), description: t("Answers conversations in the inbox.") },
  { value: "admin", label: t("Admin"), description: t("Also manages agents, knowledge, settings and the team.") },
];

function InviteDialog({ onClose, onSent }) {
  const { base } = useWorkspace();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("agent");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(null);
  const [copied, setCopied] = useState(false);
  const submit = async (e) => {
    e && e.preventDefault();
    const address = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) return setError(t("Enter a valid email address."));
    setBusy(true);
    setError("");
    try {
      const r = await api(`${base}/invites`, { method: "POST", body: { email: address, role } });
      setSent(r);
      onSent();
    } catch (err) {
      setError(err.status === 409 ? t("{email} is already on the team.", { email: address }) : err.status === 402 ? t("All {seats} seats on your plan are taken. Upgrade the plan or remove a teammate first.", { seats: err.body?.seats ?? "" }) : err.message);
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(sent.link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  if (sent)
    return (
      <Dialog
        title={t("Invitation sent")}
        description={sent.emailed ? t("{email} got an email with a link to join. It works for 7 days.", { email: sent.email }) : t("Email isn't set up on this server yet, so send {email} this link yourself. It works for 7 days.", { email: sent.email })}
        onClose={onClose}
        size="sm"
        footer={
          <Button variant="primary" onClick={onClose}>
            {t("Done")}
          </Button>
        }
      >
        <Field id="inv-link" label={t("Invitation link")} hint={t("Anyone with this link can join as {email}. Share it only with them.", { email: sent.email })}>
          <div className="row" style={{ gap: 8 }}>
            <input id="inv-link" className="input" readOnly value={sent.link} onFocus={(e) => e.target.select()} />
            <Button icon={copied ? "check" : "copy"} onClick={copy}>
              {copied ? t("Copied") : t("Copy")}
            </Button>
          </div>
        </Field>
      </Dialog>
    );
  return (
    <Dialog
      title={t("Invite a teammate")}
      description={t("They get an email with a link to join this workspace.")}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>{t("Cancel")}</Button>
          <Button variant="primary" loading={busy} onClick={submit}>
            {t("Send invitation")}
          </Button>
        </>
      }
    >
      <form className="stack" onSubmit={submit} noValidate>
        <TextInput id="inv-email" label={t("Email")} type="email" autoComplete="off" placeholder="name@company.uz" value={email} onChange={(e) => setEmail(e.target.value)} error={error} data-autofocus />
        <Select id="inv-role" label={t("Role")} value={role} onChange={setRole} options={ROLE_OPTIONS()} />
      </form>
    </Dialog>
  );
}

function TeamTab() {
  const { base, members, reloadMembers, workspace, user, isAdmin, summary } = useWorkspace();
  const toast = useToast();
  const invites = useResource(isAdmin ? `${base}/invites` : null);
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState(null);
  const limits = workspace.limits;
  const waiting = (invites.data || []).filter((i) => !i.expired).length;
  const full = limits ? members.length + waiting >= limits.seats : false;
  const fail = (e) => toast(e.message, { tone: "error" });
  const refresh = () => {
    reloadMembers();
    invites.reload();
    summary.reload();
  };
  const changeRole = (m, role) =>
    api(`${base}/members/${m.id}`, { method: "PATCH", body: { role } })
      .then(() => {
        reloadMembers();
        toast(t("{name} is now {role}.", { name: m.name, role: roleLabel(role) }));
      })
      .catch(fail);
  const remove = (m) =>
    api(`${base}/members/${m.id}`, { method: "DELETE" })
      .then(() => {
        refresh();
        toast(t("{name} was removed from the team.", { name: m.name }));
      })
      .catch(fail);
  const resend = (i) =>
    api(`${base}/invites/${i.id}/resend`, { method: "POST" })
      .then(() => {
        invites.reload();
        toast(t("Invitation sent again to {email}.", { email: i.email }));
      })
      .catch(fail);
  const revoke = (i) =>
    api(`${base}/invites/${i.id}`, { method: "DELETE" })
      .then(() => {
        refresh();
        toast(t("Invitation to {email} cancelled.", { email: i.email }));
      })
      .catch(fail);
  const editable = (m) => isAdmin && m.role !== "owner" && m.id !== user.id;

  return (
    <div>
      <div className="form-head">
        <div>
          <h2 className="section-title">{t("Team")}</h2>
          <p className="section-desc">
            {limits
              ? t("{used} of {total} seats used on the {plan} plan.", {
                  used: members.length + waiting,
                  total: limits.seats,
                  plan: capitalize(workspace.plan),
                })
              : " "}
          </p>
        </div>
        {isAdmin && (
          <Button variant="primary" icon="userPlus" onClick={() => setInviting(true)} disabled={full} title={full ? t("All seats are taken. Upgrade the plan to add more.") : undefined}>
            {t("Invite teammate")}
          </Button>
        )}
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
                <Avatar initials={initialsOf(m.name)} tone={toneOf(m.id)} src={m.avatar || undefined} cover />
                <div className="cell-text">
                  <div className="cell-title truncate">
                    {m.name} {m.id === user.id && <span className="muted">{t("(you)")}</span>}
                  </div>
                  <div className="cell-sub truncate">{m.email}</div>
                </div>
              </div>
            ),
          },
          {
            key: "role",
            header: t("Role"),
            shrink: true,
            render: (m) =>
              editable(m) ? (
                <Select aria-label={t("Role of {name}", { name: m.name })} size="sm" value={m.role} onChange={(role) => role !== m.role && changeRole(m, role)} options={ROLE_OPTIONS()} menuMinWidth={260} />
              ) : (
                <span className="sec">{roleLabel(m.role)}</span>
              ),
          },
          {
            key: "since",
            header: t("Joined"),
            shrink: true,
            hideSm: true,
            render: (m) => <span className="sec">{dateLong(m.created_at)}</span>,
          },
          ...(isAdmin
            ? [
                {
                  key: "actions",
                  header: <span className="sr-only">{t("Actions")}</span>,
                  shrink: true,
                  render: (m) =>
                    editable(m) ? (
                      <ActionMenu
                        label={t("Actions for {name}", { name: m.name })}
                        items={[{ label: t("Remove from team"), icon: "trash", danger: true, onSelect: () => setRemoving(m) }]}
                        trigger={(p) => <IconButton icon="more" size="sm" label={t("Actions for {name}", { name: m.name })} {...p} />}
                      />
                    ) : null,
                },
              ]
            : []),
        ]}
      />
      {isAdmin && invites.data?.length > 0 && (
        <>
          <h3 className="section-title" style={{ margin: "28px 0 10px" }}>
            {t("Invitations")}
          </h3>
          <Table
            caption={t("Invitations")}
            rowKey={(i) => i.id}
            rows={invites.data}
            columns={[
              {
                key: "email",
                header: t("Email"),
                render: (i) => (
                  <div className="cell-main">
                    <Avatar initials={initialsOf(i.email)} tone={toneOf(i.id)} />
                    <div className="cell-text">
                      <div className="cell-title truncate">{i.email}</div>
                      <div className="cell-sub truncate">{i.expired ? t("Expired") : t("Waiting · expires {date}", { date: dateLong(i.expires_at) })}</div>
                    </div>
                  </div>
                ),
              },
              { key: "role", header: t("Role"), shrink: true, render: (i) => <span className="sec">{roleLabel(i.role)}</span> },
              {
                key: "actions",
                header: <span className="sr-only">{t("Actions")}</span>,
                shrink: true,
                render: (i) => (
                  <div className="row" style={{ gap: 4 }}>
                    <Button size="sm" onClick={() => resend(i)}>
                      {t("Resend")}
                    </Button>
                    <IconButton icon="x" size="sm" label={t("Cancel invitation to {email}", { email: i.email })} onClick={() => revoke(i)} />
                  </div>
                ),
              },
            ]}
          />
        </>
      )}
      {inviting && <InviteDialog onClose={() => setInviting(false)} onSent={refresh} />}
      {removing && (
        <Confirm
          title={t("Remove {name}?", { name: removing.name })}
          body={t("They lose access to this workspace. Conversations they were handling go back to the queue.")}
          confirmLabel={t("Remove")}
          danger
          onConfirm={() => remove(removing)}
          onClose={() => setRemoving(null)}
        />
      )}
    </div>
  );
}

function WidgetTab({ onDirty, standalone = false }) {
  const { base, agents, activeAgent, setActiveAgent, workspace, reloadAgents, isAdmin, openDialog } = useWorkspace();
  const toast = useToast();
  const agent = activeAgent;
  const base0 = agent
    ? {
        accent: agent.widget?.accent || "#111215",
        display_name: agent.widget?.display_name || "",
        logo: agent.widget?.logo || "",
        branding: agent.widget?.branding !== false,
        welcome: agent.welcome,
        origins: agent.allowed_origins || [],
      }
    : null;
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
        <EmptyState
          icon="bot"
          title={t("Create an agent first")}
          action={
            <Button size="sm" variant="primary" onClick={() => openDialog("createAgent")}>
              {t("Create agent")}
            </Button>
          }
        >
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
        body: {
          welcome: draft.welcome.trim(),
          allowed_origins: draft.origins,
          widget: {
            accent: draft.accent,
            display_name: draft.display_name.trim(),
            logo: draft.logo,
            branding: canHide ? draft.branding : true,
          },
        },
      });
      await reloadAgents();
      toast(t("Widget settings saved"), {
        sub: t("Visitors see the changes the next time the widget loads."),
      });
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
        {!standalone && <AgentSelect id="wg-agent" value={agent.id} onChange={setActiveAgent} />}
      </div>
      {agent.status !== "active" && (
        <Callout
          tone="warn"
          action={
            <Button size="sm" onClick={() => go("playground")}>
              {t("Open Playground")}
            </Button>
          }
        >
          {t("{name} is a draft, so its widget isn't answering visitors yet. Publish it from the Playground or the Agents page.", { name: agent.name })}
        </Callout>
      )}
      <div className="widget-layout">
        <div className="field-rows">
          <Field
            layout="row"
            id="wg-hex"
            label={t("Accent color")}
            hint={t("Header, launcher and visitor messages. Pick a dark shade so white text stays readable.")}
            error={validHex ? null : t("Use a 6-digit hex color, like #1f3d36.")}
          >
            <div className="swatches" role="radiogroup" aria-label={t("Preset colors")}>
              {ACCENTS.map((c) => (
                <button
                  type="button"
                  key={c}
                  className="swatch"
                  role="radio"
                  aria-checked={draft.accent.toLowerCase() === c}
                  aria-label={c}
                  style={{ background: c }}
                  onClick={() => setDraft({ ...draft, accent: c })}
                  disabled={!isAdmin}
                />
              ))}
            </div>
            <div style={{ width: 132 }}>
              <TextInput
                id="wg-hex"
                aria-label={t("Custom hex color")}
                size="sm"
                className="mono"
                value={draft.accent}
                onChange={(e) => setDraft({ ...draft, accent: e.target.value })}
                aria-invalid={!validHex || undefined}
                disabled={!isAdmin}
              />
            </div>
          </Field>
          <Field layout="row" id="wg-logo" label={t("Logo")} hint={t("Shown in the chat header. Square images look best; up to 200 KB.")}>
            <LogoPicker id="wg-logo" value={draft.logo} name={draft.display_name.trim() || workspace.name} onChange={(logo) => setDraft({ ...draft, logo })} onError={(m) => toast(m, { tone: "error" })} disabled={!isAdmin} />
          </Field>
          <TextInput
            layout="row"
            id="wg-name"
            label={t("Display name")}
            hint={t("Shown at the top of the chat. Leave empty to use “{name}”.", { name: workspace.name })}
            placeholder={workspace.name}
            value={draft.display_name}
            onChange={(e) => setDraft({ ...draft, display_name: e.target.value })}
            disabled={!isAdmin}
            maxLength={80}
          />
          <Textarea
            layout="row"
            id="wg-welcome"
            label={t("Welcome message")}
            hint={t("The same setting as {name}'s welcome message in the Playground.", { name: agent.name })}
            rows={3}
            value={draft.welcome}
            onChange={(e) => setDraft({ ...draft, welcome: e.target.value })}
            error={draft.welcome.trim() ? null : t("Add a welcome message.")}
            disabled={!isAdmin}
            maxLength={500}
          />
          <SwitchField
            layout="row"
            id="wg-brand"
            label={t("Show “Powered by Replybek”")}
            hint={canHide ? t("Appears in the widget footer.") : t("Upgrade to Growth to remove branding.")}
            checked={canHide ? draft.branding : true}
            disabled={!canHide || !isAdmin}
            onChange={(v) => setDraft({ ...draft, branding: v })}
          />
          <Field layout="row" id="wg-origin" label={t("Allowed websites")} hint={t("Only these sites can load the widget. Leave empty to allow any site.")} error={originErr}>
            {draft.origins.length > 0 && (
              <div className="file-list">
                {draft.origins.map((o) => (
                  <div key={o}>
                    <Icon name="globe" size={14} className="muted" />
                    <span className="truncate mono" style={{ flex: 1 }}>
                      {o}
                    </span>
                    {isAdmin && (
                      <IconButton
                        icon="x"
                        size="sm"
                        label={t("Remove {name}", { name: o })}
                        tooltip={false}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            origins: draft.origins.filter((x) => x !== o),
                          })
                        }
                      />
                    )}
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
          <WidgetPreview
            accent={validHex ? draft.accent : base0.accent}
            title={draft.display_name.trim() || workspace.name}
            logo={draft.logo}
            agentName={agent.name}
            welcome={draft.welcome}
            branding={canHide ? draft.branding : true}
            handoff={agent.handoff}
            suggestions={questionsFor(agent, document.documentElement.lang || "en")}
          />
        </div>
      </div>
      <Section title={t("Install")} description={t("Paste this before the closing </body> tag on your site.")}>
        <Snippet agent={agent} />
      </Section>
    </div>
  );
}

// Polar subscription statuses, shown on the billing tab. "canceling" is an active one set to end at period end.
const BILLING_STATUS = {
  active: { label: tk("Active"), tone: "green" },
  trialing: { label: tk("Free trial"), tone: "blue" },
  past_due: { label: tk("Payment overdue"), tone: "amber" },
  canceling: { label: tk("Ends at period end"), tone: "amber" },
  canceled: { label: tk("Cancelled"), tone: "red" },
  unpaid: { label: tk("Payment overdue"), tone: "red" },
  incomplete_expired: { label: tk("Expired"), tone: "red" },
  paused: { label: tk("Ended"), tone: "red" },
};

function BillingTab() {
  const { base, workspace, summary, role } = useWorkspace();
  const toast = useToast();
  const [switching, setSwitching] = useState(null);
  const billing = workspace.billing || {};
  const polar = billing.provider === "polar";
  const [opening, setOpening] = useState(false);
  // Back from Polar checkout (?checkout=done): the webhook usually lands within seconds, so check a few times.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("checkout") !== "done") return;
    window.history.replaceState(null, "", window.location.pathname + window.location.hash);
    toast(t("Checkout complete"), { sub: t("Your plan updates as soon as Polar confirms it.") });
    let n = 0;
    const timer = setInterval(() => (++n >= 5 ? clearInterval(timer) : summary.reload()), 2000);
    return () => clearInterval(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const usage = workspace.usage;
  const limits = workspace.limits;
  if (!usage || !limits) return null;
  const meters = [
    {
      label: t("AI messages this month"),
      used: usage.messages,
      limit: limits.messages,
    },
    { label: t("Agents"), used: usage.agents, limit: limits.agents },
    { label: t("Team seats"), used: usage.seats, limit: limits.seats },
    {
      label: t("Knowledge sources"),
      used: usage.sources,
      limit: limits.sources,
    },
  ];
  const order = PLANS.map((p) => p.id);
  const current = PLANS.find((p) => p.id === workspace.plan);
  const status = BILLING_STATUS[billing.status === "active" && billing.cancel_at_period_end ? "canceling" : billing.status] || null;
  // With Polar, the current plan only counts once its trial or subscription is running; until then every plan is a checkout.
  const paid = !polar || billing.access === "paid" || billing.access === "trial";
  const fresh = polar && billing.access === "none";
  const badge = status || (fresh ? { label: tk("Trial not started"), tone: "" } : null);
  const trialing = polar && billing.access === "trial";
  return (
    <div className="stack" style={{ gap: 32 }}>
      {!polar && <Callout tone="info">{t("Billing isn't connected yet. Prices are placeholders, and switching plans only changes your workspace limits. No payment is taken.")}</Callout>}
      {polar && billing.status === "past_due" && <Callout tone="warn">{t("The last payment didn't go through. Update your card on Polar to keep your plan.")}</Callout>}
      {fresh && <Callout tone="info">{t("Start your 7-day free trial to put your agent live on your website. You'll add a card on Polar; nothing is charged for 7 days, and you can cancel any time before then.")}</Callout>}
      {polar && billing.access === "ended" && (
        <Callout tone="bad">
          {t("Your subscription has ended.")} {t("Your agents pass new chats to your team instead of answering, until you choose a plan.")}
        </Callout>
      )}
      <Section
        title={
          <span className="row" style={{ gap: 8 }}>
            {t("{plan} plan", { plan: current.name })}
            {polar ? badge && <span className={"badge " + badge.tone}>{t(badge.label)}</span> : <Sim>{t("Placeholder pricing")}</Sim>}
          </span>
        }
        description={
          trialing && billing.renews_at
            ? billing.cancel_at_period_end
              ? t("Free trial ends {date}. No payment will be taken.", { date: dateLong(billing.renews_at) })
              : t("Free trial until {date} · then ${price} per month", { date: dateLong(billing.renews_at), price: current.price })
            : polar && billing.renews_at && paid
              ? `${t("${price} per month", { price: current.price })} · ${billing.cancel_at_period_end ? t("ends {date}", { date: dateLong(billing.renews_at) }) : t("renews {date}", { date: dateLong(billing.renews_at) })}`
              : t("${price} per month", { price: current.price })
        }
      >
        {polar && billing.can_manage && (
          <div className="row" style={{ marginBottom: 16 }}>
            <Button
              variant="secondary"
              disabled={opening}
              onClick={async () => {
                setOpening(true);
                try {
                  const { url } = await api(`${base}/billing/portal`, { method: "POST" });
                  window.location.assign(url);
                } catch (e) {
                  toast(e.message, { tone: "error", duration: 8000 });
                  setOpening(false);
                }
              }}
            >
              {t("Manage billing on Polar")}
            </Button>
          </div>
        )}
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
      <Section
        title={t("Plans")}
        description={role !== "owner" ? t("Only the workspace owner can change the plan.") : polar ? t("You pay on Polar's secure checkout. Your plan changes as soon as the payment goes through.") : t("Switching is simulated until billing is connected.")}
      >
        <div className="plans">
          {PLANS.map((p) => {
            const isCurrent = p.id === workspace.plan && paid;
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
                  <Button variant={(paid ? up : p.id === workspace.plan) ? "primary" : "secondary"} disabled={role !== "owner"} onClick={() => setSwitching(p)}>
                    {fresh ? t("Start free trial") : !paid ? t("Choose {plan}", { plan: p.name }) : up ? t("Upgrade to {plan}", { plan: p.name }) : t("Switch to {plan}", { plan: p.name })}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </Section>
      {switching && polar && (
        <Confirm
          title={fresh ? t("Try {plan} free for 7 days?", { plan: switching.name }) : t("Switch to {plan}?", { plan: switching.name })}
          body={
            fresh
              ? t("You'll add a card on Polar. Nothing is charged for 7 days; then {plan} is ${price} a month unless you cancel before.", { price: switching.price, plan: switching.name })
              : paid
              ? t("Your subscription moves to {plan} (${price} a month) right away. Polar adjusts the charge for the rest of this period.", { price: switching.price, plan: switching.name })
              : t("You'll pay ${price} a month for {plan} on Polar. Your workspace limits change as soon as the payment goes through.", { price: switching.price, plan: switching.name })
          }
          confirmLabel={fresh ? t("Continue to Polar") : paid ? t("Switch to {plan}", { plan: switching.name }) : t("Continue to checkout")}
          onClose={() => setSwitching(null)}
          onConfirm={async () => {
            try {
              const { url } = await api(`${base}/billing/checkout`, { method: "POST", body: { plan: switching.id } });
              // A running subscription switches product in place; no checkout page.
              if (url) return window.location.assign(url);
              await summary.reload();
              toast(t("Plan changed to {plan}", { plan: switching.name }));
            } catch (e) {
              toast(e.message, { tone: "error", duration: 8000 });
            }
          }}
        />
      )}
      {switching && !polar && (
        <Confirm
          title={t("Switch to {plan}?", { plan: switching.name })}
          body={t("Billing isn't connected, so nothing is charged. Your workspace limits change to the {plan} plan's right away.", { plan: switching.name })}
          confirmLabel={t("Switch to {plan}", { plan: switching.name })}
          onClose={() => setSwitching(null)}
          onConfirm={async () => {
            try {
              await api(`${base}/plan`, {
                method: "PATCH",
                body: { plan: switching.id },
              });
              await summary.reload();
              toast(t("Plan changed to {plan}", { plan: switching.name }), {
                sub: t("Simulated: no payment was taken."),
              });
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

export function WebsiteWidget() {
  return <Settings id="widget" standalone />;
}

export function Settings({ id, standalone = false }) {
  const { workspace } = useWorkspace();
  const tab = TABS.some((x) => x.value === id) ? id : "workspace";
  const [dirty, setDirty] = useState({});
  const mark = (key) => (d) => setDirty((x) => (x[key] === d ? x : { ...x, [key]: d }));
  return (
    <>
      <PageHeader
        title={standalone ? t("Website widget") : t("Settings")}
        description={standalone ? t("Make the chat yours, then add it to your website.") : `${workspace.name} · ${t("workspace, team, widget and plan")}`}
      />
      <div className="page-body">
        <div className="page-inner">
          {standalone ? (
            <WidgetTab standalone onDirty={mark("widget")} />
          ) : (
            <div className="settings">
              <div className="settings-nav">
                <Tabs
                  vertical
                  idBase="st"
                  label={t("Settings sections")}
                  value={tab}
                  onChange={(v) => go("settings", v)}
                  tabs={TABS.map((x) => ({
                    ...x,
                    label: t(x.label),
                    dirty: dirty[x.value],
                  }))}
                />
              </div>
              <div className="settings-panel" {...tabPanel("st", tab)}>
                {tab === "workspace" && <WorkspaceTab onDirty={mark("workspace")} />}
                {tab === "team" && <TeamTab />}
                {tab === "widget" && <WidgetTab onDirty={mark("widget")} />}
                {tab === "billing" && <BillingTab />}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
