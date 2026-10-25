import { useState } from "react";
import { t } from "../i18n.js";
import { Icon } from "../icons.jsx";
import { api } from "../api.js";
import { useWorkspace } from "../workspace.jsx";
import { useResource } from "../hooks.js";
import { Dialog, Confirm, TextInput, Textarea, Field, SegmentedControl, StatusBadge, Button, IconButton, ActionMenu, PageHeader, Table, Callout, EmptyState, useToast, fmt } from "../ui.jsx";
import { AgentSelect, Loading } from "./shared.jsx";

// What the JSON editor starts with: everything the tools need besides the sign-in settings.
const EMPTY_CONFIG = { headers: {}, context: [], account: {}, tools: [] };
const configOf = (i) => JSON.stringify({ headers: i.headers, context: i.context, account: i.account, tools: i.tools }, null, 2);
const hostOf = (url) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

/** Systems the agents can act in for signed-in customers: their orders, prices, balances. */
export function Integrations() {
  const { base, agents, isAdmin } = useWorkspace();
  const toast = useToast();
  const list = useResource(isAdmin ? `${base}/integrations` : null);
  const setup = useResource(isAdmin ? `${base}/integrations/setup` : null);
  const [editing, setEditing] = useState(null); // {} for a new one
  const [deleting, setDeleting] = useState(null);
  const agentName = (id) => agents.find((a) => a.id === id)?.name || t("Agent");

  const toggle = async (i) => {
    try {
      await api(`${base}/integrations/${i.id}`, { method: "PATCH", body: { enabled: !i.enabled } });
      await list.reload();
      toast(i.enabled ? t("{name} is turned off", { name: i.name }) : t("{name} is turned on", { name: i.name }));
    } catch (e) {
      toast(e.message, { tone: "error" });
    }
  };

  const columns = [
    {
      key: "name",
      header: t("Integration"),
      render: (i) => (
        <div className="cell-text">
          <div className="cell-title truncate">{i.name}</div>
          <div className="cell-sub truncate">{hostOf(i.base_url)}</div>
        </div>
      ),
    },
    { key: "agent", header: t("Agent"), hideSm: true, render: (i) => <span className="sec">{agentName(i.agent_id)}</span> },
    {
      key: "tools",
      header: t("Tools"),
      shrink: true,
      render: (i) => {
        const writes = i.tools.filter((x) => x.kind === "write").length;
        return <span className="sec">{t("{reads} lookups · {writes} changes", { reads: i.tools.length - writes, writes })}</span>;
      },
    },
    { key: "conn", header: t("Signed-in customers"), align: "right", shrink: true, hideSm: true, render: (i) => <span className="num">{fmt(i.connections)}</span> },
    { key: "status", header: t("Status"), shrink: true, render: (i) => <StatusBadge status={i.enabled ? "active" : "paused"} /> },
    {
      key: "actions",
      header: t("Actions"),
      srHeader: true,
      shrink: true,
      align: "right",
      render: (i) => (
        <ActionMenu
          label={t("Actions for {name}", { name: i.name })}
          items={[
            { label: t("Edit"), icon: "settings", onSelect: () => setEditing(i) },
            { label: i.enabled ? t("Turn off") : t("Turn on"), icon: i.enabled ? "pause" : "play", onSelect: () => toggle(i) },
            { separator: true },
            { label: t("Delete integration"), icon: "trash", danger: true, onSelect: () => setDeleting(i) },
          ]}
          trigger={(p) => <IconButton icon="more" label={t("Actions for {name}", { name: i.name })} size="sm" {...p} />}
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t("Integrations")}
        description={t("Let agents look things up and make changes in your systems for signed-in customers.")}
        actions={
          isAdmin &&
          agents.length > 0 && (
            <Button variant="primary" icon="plus" onClick={() => setEditing({})}>
              {t("Add integration")}
            </Button>
          )
        }
      />
      <div className="page-body">
        <div className="page-inner stack" style={{ gap: 16 }}>
          {!isAdmin ? (
            <Callout>{t("Only workspace admins can manage integrations.")}</Callout>
          ) : !list.data ? (
            <Loading />
          ) : list.data.length === 0 ? (
            <div className="box">
              <EmptyState
                icon="link"
                title={t("No integrations yet")}
                action={
                  agents.length > 0 && (
                    <Button variant="primary" size="sm" icon="plus" onClick={() => setEditing({})}>
                      {t("Add integration")}
                    </Button>
                  )
                }
              >
                {t("Connect a system with OAuth sign-in, like an ERP or an online store. Customers sign in on its own page, and the agent can then answer about their orders or place one after they confirm.")}
              </EmptyState>
            </div>
          ) : (
            <Table caption={t("Integrations")} columns={columns} rows={list.data} rowKey={(i) => i.id} onRowClick={(i) => setEditing(i)} />
          )}
          {isAdmin && setup.data && (
            <p className="helper">
              {t("Sign-in return address to register in the other system:")} <code className="mono">{setup.data.redirect_uri}</code>
            </p>
          )}
        </div>
      </div>
      {editing && <IntegrationDialog integration={editing} redirectUri={setup.data?.redirect_uri} onClose={() => setEditing(null)} onSaved={list.reload} />}
      {deleting && (
        <Confirm
          title={t("Delete {name}?", { name: deleting.name })}
          body={t("Customers' sign-ins to it are removed, and the agent can no longer use its tools.")}
          confirmLabel={t("Delete integration")}
          danger
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            try {
              await api(`${base}/integrations/${deleting.id}`, { method: "DELETE" });
              await list.reload();
              toast(t("{name} was deleted", { name: deleting.name }));
            } catch (e) {
              toast(e.message, { tone: "error" });
            }
          }}
        />
      )}
    </>
  );
}

// A collapsible builder section (Chatbase-style: a step circle + title + chevron).
function Collapsible({ step, title, desc, done, open, onToggle, children }) {
  return (
    <section className={"build-sec" + (open ? " open" : "")}>
      <button type="button" className="build-sec-head" onClick={onToggle} aria-expanded={open}>
        <span className={"build-step" + (done ? " done" : "")}>{done ? <Icon name="check" size={12} strokeWidth={3} /> : step}</span>
        <span className="build-sec-title">
          {title}
          {desc && <span className="build-sec-desc">{desc}</span>}
        </span>
        <Icon name={open ? "chevronUp" : "chevronDown"} size={16} className="muted" />
      </button>
      {open && <div className="build-sec-body">{children}</div>}
    </section>
  );
}

function IntegrationDialog({ integration, redirectUri, onClose, onSaved }) {
  const { base, agents, activeAgent } = useWorkspace();
  const toast = useToast();
  const isNew = !integration.id;
  const [open, setOpen] = useState(isNew ? "general" : "tools");
  const toggle = (k) => () => setOpen((o) => (o === k ? "" : k));
  const [f, setF] = useState({
    name: integration.name || "",
    agent_id: integration.agent_id || activeAgent?.id || agents[0]?.id,
    mode: integration.mode || "server",
    base_url: integration.base_url || "",
    authorize_url: integration.auth?.authorize_url || "",
    token_url: integration.auth?.token_url || "",
    client_id: integration.auth?.client_id || "",
    client_secret: "",
    scope: integration.auth?.scope || "",
    token_format: integration.auth?.token_format || "form",
    config: isNew ? JSON.stringify(EMPTY_CONFIG, null, 2) : configOf(integration),
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const server = f.mode === "server";
  let toolCount = 0;
  try {
    toolCount = (JSON.parse(f.config).tools || []).length;
  } catch {
    toolCount = -1; // invalid JSON
  }

  async function save() {
    const e = {};
    if (!f.name.trim()) e.name = t("Give it a name.");
    if (!/^https?:\/\/\S+$/i.test(f.base_url.trim())) e.base_url = t("Enter the system's address, starting with https://.");
    if (server) {
      if (!f.authorize_url.trim()) e.authorize_url = t("Add the sign-in page path.");
      if (!f.token_url.trim()) e.token_url = t("Add the token path.");
      if (!f.client_id.trim()) e.client_id = t("Add the client ID.");
      if (isNew && !f.client_secret) e.client_secret = t("Add the client secret.");
    }
    let config;
    try {
      config = JSON.parse(f.config);
    } catch {
      e.config = t("This isn't valid JSON.");
    }
    setErrors(e);
    if (Object.keys(e).length) {
      // Open the section holding the first error so it's visible.
      if (e.name) setOpen("general");
      else if (e.base_url || e.authorize_url || e.token_url || e.client_id || e.client_secret) setOpen("connection");
      else if (e.config) setOpen("tools");
      return;
    }
    const body = {
      name: f.name.trim(),
      mode: f.mode,
      base_url: f.base_url.trim(),
      auth: server ? { authorize_url: f.authorize_url.trim(), token_url: f.token_url.trim(), client_id: f.client_id.trim(), scope: f.scope.trim() || undefined, token_format: f.token_format } : {},
      ...(f.client_secret ? { client_secret: f.client_secret } : {}),
      headers: config.headers || {},
      context: config.context || [],
      account: config.account || {},
      tools: config.tools || [],
      ...(isNew ? { agent_id: f.agent_id } : {}),
    };
    setBusy(true);
    try {
      await api(isNew ? `${base}/integrations` : `${base}/integrations/${integration.id}`, { method: isNew ? "POST" : "PATCH", body });
      await onSaved();
      toast(isNew ? t("{name} added", { name: body.name }) : t("Changes saved"));
      onClose();
    } catch (err) {
      setErrors({ config: err.message });
      setOpen("tools");
    } finally {
      setBusy(false);
    }
  }

  const modeCard = (value, title, desc) => (
    <button type="button" className={"type-card" + (f.mode === value ? " sel" : "")} onClick={() => setF({ ...f, mode: value })}>
      <span className="type-radio" aria-hidden="true" />
      <span>
        <span className="type-card-title">{title}</span>
        <span className="type-card-desc">{desc}</span>
      </span>
    </button>
  );

  return (
    <Dialog
      title={isNew ? t("Add integration") : t("Edit {name}", { name: integration.name })}
      description={t("Connect a system and describe the tools the agent can use.")}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>{t("Cancel")}</Button>
          <Button variant="primary" loading={busy} onClick={save}>
            {isNew ? t("Add integration") : t("Save changes")}
          </Button>
        </>
      }
    >
      <div className="build">
        <Collapsible step={1} title={t("General")} desc={f.name.trim() || undefined} done={Boolean(f.name.trim())} open={open === "general"} onToggle={toggle("general")}>
          <TextInput id="ig-name" label={t("Name")} hint={t("Customers see it on the sign-in button.")} value={f.name} onChange={set("name")} error={errors.name} maxLength={80} />
          {isNew && agents.length > 1 && <AgentSelect id="ig-agent" label={t("Agent")} value={f.agent_id} onChange={(v) => setF({ ...f, agent_id: v })} width="100%" />}
        </Collapsible>

        <Collapsible step={2} title={t("Connection")} desc={server ? t("OAuth sign-in") : t("In the user's own session")} done={Boolean(f.base_url.trim())} open={open === "connection"} onToggle={toggle("connection")}>
          <div className="stack" style={{ gap: 10 }}>
            <span className="field-label">{t("How the agent reaches the system")}</span>
            {modeCard("in_page", t("In-page (the user's session)"), t("The widget runs inside the system's own pages and acts as the signed-in user. No keys, no stored passwords."))}
            {modeCard("server", t("Server (OAuth sign-in)"), t("The customer signs in on the system's page; Replybek calls its API with a stored token. For public sites."))}
            <TextInput id="ig-url" label={t("System address")} placeholder="https://erp.example.com" value={f.base_url} onChange={set("base_url")} error={errors.base_url} />
            {server && (
              <>
                <div className="grid-2">
                  <TextInput id="ig-auth" label={t("Sign-in page path")} placeholder="/oauth/authorize" value={f.authorize_url} onChange={set("authorize_url")} error={errors.authorize_url} />
                  <TextInput id="ig-token" label={t("Token path")} placeholder="/oauth/token" value={f.token_url} onChange={set("token_url")} error={errors.token_url} />
                  <TextInput id="ig-cid" label={t("Client ID")} value={f.client_id} onChange={set("client_id")} error={errors.client_id} autoComplete="off" />
                  <TextInput id="ig-secret" label={t("Client secret")} type="password" autoComplete="new-password" placeholder={isNew ? "" : t("Saved. Leave empty to keep it.")} value={f.client_secret} onChange={set("client_secret")} error={errors.client_secret} />
                  <TextInput id="ig-scope" label={t("Scope")} placeholder={t("(optional)")} value={f.scope} onChange={set("scope")} />
                  <Field id="ig-format" label={t("Token request format")}>
                    <SegmentedControl label={t("Token request format")} value={f.token_format} onChange={(v) => setF({ ...f, token_format: v })} options={[{ value: "form", label: t("Form (standard)") }, { value: "json", label: "JSON" }]} />
                  </Field>
                </div>
                {redirectUri && (
                  <Callout>
                    {t("Register this return address in the system:")} <code className="mono">{redirectUri}</code>
                  </Callout>
                )}
              </>
            )}
          </div>
        </Collapsible>

        <Collapsible step={3} title={t("Tools")} desc={toolCount >= 0 ? t("{count} tools", { count: toolCount }) : t("Invalid JSON")} done={toolCount > 0} open={open === "tools"} onToggle={toggle("tools")}>
          <ToolsSection base={base} integrationId={integration.id} baseUrl={f.base_url} isNew={isNew} config={f.config} onChange={(c) => setF({ ...f, config: c })} error={errors.config} />
        </Collapsible>
      </div>
    </Dialog>
  );
}

/** A safe dry-run: pick a tool, give sample args, and see the exact request it would send (even before saving). */
function ToolPreview({ base, integrationId, baseUrl, config }) {
  const toast = useToast();
  let parsedConfig = {};
  try {
    parsedConfig = JSON.parse(config) || {};
  } catch {
    // The JSON above is invalid; the preview just offers nothing until it's fixed.
  }
  const tools = (parsedConfig.tools || []).filter((x) => x && x.name);
  const [tool, setTool] = useState("");
  const [args, setArgs] = useState("{}");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const name = tool || tools[0]?.name;

  const run = async () => {
    let parsed;
    try {
      parsed = args.trim() ? JSON.parse(args) : {};
    } catch {
      return toast(t("Sample inputs must be valid JSON."), { tone: "error" });
    }
    const draftTool = tools.find((x) => x.name === name);
    setBusy(true);
    try {
      setResult(await api(`${base}/integrations/${integrationId}/tools/${name}/preview`, { method: "POST", body: { args: parsed, base_url: baseUrl, headers: parsedConfig.headers || {}, tool: draftTool } }));
    } catch (e) {
      toast(e.message, { tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  if (!tools.length) return null;
  return (
    <div className="stack" style={{ gap: 8, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
      <span className="eyebrow">{t("Preview a request")}</span>
      <span className="field-hint">{t("See exactly what a tool would send, with sample inputs. Nothing is sent to the system.")}</span>
      <div className="row-wrap" style={{ gap: 8 }}>
        <Field id="ig-prev-tool" label={t("Tool")} layout="row" tight>
          <select id="ig-prev-tool" className="input" value={name} onChange={(e) => setTool(e.target.value)}>
            {tools.map((x) => (
              <option key={x.name} value={x.name}>
                {x.name} {x.kind === "write" ? "· " + t("change") : ""}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Textarea id="ig-prev-args" label={t("Sample inputs (JSON)")} className="mono" rows={3} value={args} onChange={(e) => setArgs(e.target.value)} spellCheck={false} />
      <div>
        <Button size="sm" icon="flask" loading={busy} onClick={run}>
          {t("Preview")}
        </Button>
      </div>
      {result && (
        <pre className="code" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {result.request.method} {result.request.path}
          {"\n"}
          {JSON.stringify({ headers: result.request.headers, body: result.request.body }, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ───── Structured tools editor (Chatbase-style per-action form) ─────
const INPUT_TYPES = { Text: "string", Number: "number", Boolean: "boolean", List: "array", Object: "object" };
const toJsonType = (label) => INPUT_TYPES[label] || "string";
const fromJsonType = (jt) => Object.keys(INPUT_TYPES).find((k) => INPUT_TYPES[k] === jt) || "Text";

function ToolsSection({ base, integrationId, baseUrl, isNew, config, onChange, error }) {
  let parsed = {};
  let ok = true;
  try {
    parsed = JSON.parse(config) || {};
  } catch {
    ok = false;
  }
  const tools = Array.isArray(parsed.tools) ? parsed.tools : [];
  const [raw, setRaw] = useState(!ok);
  const [editing, setEditing] = useState(null); // index | "new" | null
  const saveTool = (tool, index) => {
    const next = index === "new" ? [...tools, tool] : tools.map((x, i) => (i === index ? tool : x));
    onChange(JSON.stringify({ ...parsed, tools: next }, null, 2));
    setEditing(null);
  };
  const remove = (index) => onChange(JSON.stringify({ ...parsed, tools: tools.filter((_, i) => i !== index) }, null, 2));

  if (raw || !ok) {
    return (
      <div className="stack" style={{ gap: 8 }}>
        {ok && (
          <button type="button" className="link" onClick={() => setRaw(false)}>
            {t("Back to the visual editor")}
          </button>
        )}
        <Textarea
          id="ig-config"
          label={t("Tools and account settings (JSON)")}
          hint={t("headers, context (values read after sign-in), account (the signed-in name) and tools. Each tool has a name, description, kind (read or write), input, request and response.")}
          className="mono"
          rows={14}
          value={config}
          onChange={(e) => onChange(e.target.value)}
          error={error}
          spellCheck={false}
        />
      </div>
    );
  }
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="row-wrap" style={{ justifyContent: "space-between" }}>
        <span className="field-hint">{t("What the agent can do in the system. Look-ups run on their own; changes ask the user to confirm.")}</span>
        <button type="button" className="link" onClick={() => setRaw(true)}>
          {t("Edit as JSON")}
        </button>
      </div>
      {tools.map((tool, i) => (
        <div className="tool-card" key={i}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="row" style={{ gap: 8 }}>
              <span className="cell-title truncate mono">{tool.name}</span>
              <span className={"badge " + (tool.kind === "write" ? "amber" : "")}>{tool.kind === "write" ? t("change") : t("lookup")}</span>
            </div>
            {(tool.when || tool.description) && <div className="helper truncate">{tool.when || tool.description}</div>}
          </div>
          <Button size="sm" variant="ghost" onClick={() => setEditing(i)}>
            {t("Edit")}
          </Button>
          <IconButton icon="trash" size="sm" label={t("Remove {name}", { name: tool.name })} onClick={() => remove(i)} />
        </div>
      ))}
      <div>
        <Button size="sm" icon="plus" onClick={() => setEditing("new")}>
          {t("Add tool")}
        </Button>
      </div>
      {editing !== null && (
        <ToolEditor
          base={base}
          integrationId={integrationId}
          baseUrl={baseUrl}
          isNew={isNew}
          headers={parsed.headers || {}}
          tool={editing === "new" ? null : tools[editing]}
          existing={tools.map((x) => x.name).filter((_, i) => i !== editing)}
          onClose={() => setEditing(null)}
          onSave={(tool) => saveTool(tool, editing)}
        />
      )}
    </div>
  );
}

const blankTool = () => ({ name: "", when: "", description: "", kind: "read", inputs: [], method: "POST", path: "", headers: [], body: "", advanced: JSON.stringify({ response: { type: "json" } }, null, 2) });
function fromTool(tool) {
  const props = tool.input?.properties || {};
  const required = tool.input?.required || [];
  return {
    name: tool.name || "",
    when: tool.when || "",
    description: tool.description || "",
    kind: tool.kind || "read",
    inputs: Object.entries(props).map(([name, def]) => ({ name, type: fromJsonType(def?.type), description: def?.description || "", required: required.includes(name) })),
    method: tool.request?.method || "POST",
    path: tool.request?.path || "",
    headers: Object.entries(tool.request?.headers || {}).map(([k, v]) => ({ k, v: String(v) })),
    body: tool.request?.body !== undefined ? JSON.stringify(tool.request.body, null, 2) : "",
    advanced: JSON.stringify({ response: tool.response || { type: "json" }, ...(tool.confirm ? { confirm: tool.confirm } : {}) }, null, 2),
  };
}
function toTool(f) {
  const properties = {};
  const required = [];
  for (const inp of f.inputs) {
    if (!inp.name.trim()) continue;
    properties[inp.name.trim()] = { type: toJsonType(inp.type), ...(inp.description.trim() ? { description: inp.description.trim() } : {}) };
    if (inp.required) required.push(inp.name.trim());
  }
  const headers = {};
  for (const h of f.headers) if (h.k.trim()) headers[h.k.trim()] = h.v;
  const adv = JSON.parse(f.advanced || "{}");
  const request = { method: f.method, path: f.path.trim(), ...(Object.keys(headers).length ? { headers } : {}), ...(f.body.trim() ? { body: JSON.parse(f.body) } : {}) };
  return {
    name: f.name.trim(),
    ...(f.when.trim() ? { when: f.when.trim() } : {}),
    description: f.description.trim() || f.name.trim(),
    kind: f.kind,
    input: { type: "object", properties, ...(required.length ? { required } : {}) },
    request,
    ...(adv.response ? { response: adv.response } : {}),
    ...(adv.confirm ? { confirm: adv.confirm } : {}),
  };
}

function ToolEditor({ tool, headers, existing, onClose, onSave, base, integrationId, baseUrl, isNew }) {
  const [f, setF] = useState(() => (tool ? fromTool(tool) : blankTool()));
  const [open, setOpen] = useState("general");
  const [errors, setErrors] = useState({});
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  function submit() {
    const e = {};
    if (!/^[a-z][a-z0-9_]{1,47}$/.test(f.name.trim())) e.name = t("Use lowercase letters, digits and underscores (e.g. list_orders).");
    else if (existing.includes(f.name.trim())) e.name = t("Another tool already has this name.");
    if (!f.path.trim()) e.path = t("Add the endpoint path.");
    if (f.body.trim()) {
      try {
        JSON.parse(f.body);
      } catch {
        e.body = t("The body must be valid JSON.");
      }
    }
    try {
      JSON.parse(f.advanced || "{}");
    } catch {
      e.advanced = t("This isn't valid JSON.");
    }
    setErrors(e);
    if (Object.keys(e).length) {
      if (e.name) setOpen("general");
      else if (e.path || e.body) setOpen("api");
      else setOpen("advanced");
      return;
    }
    onSave(toTool(f));
  }

  let previewConfig = "{}";
  try {
    previewConfig = JSON.stringify({ headers, tools: [toTool(f)] });
  } catch {
    // invalid advanced/body JSON — the Test section will show once it's fixed
  }
  const sec = (k) => ({ open: open === k, onToggle: () => setOpen(open === k ? "" : k) });

  return (
    <Dialog
      title={tool ? t("Edit tool") : t("Add tool")}
      description={t("Describe one thing the agent can do, and the request it makes.")}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t("Cancel")}</Button>
          <Button variant="primary" onClick={submit}>
            {t("Save tool")}
          </Button>
        </>
      }
    >
      <div className="build">
        <Collapsible step={1} title={t("General")} desc={f.name || undefined} done={Boolean(f.name)} {...sec("general")}>
          <div className="stack" style={{ gap: 12 }}>
            <TextInput id="te-name" label={t("Tool name")} hint={t("A lowercase id the agent uses, e.g. list_orders.")} value={f.name} onChange={set("name")} error={errors.name} />
            <Textarea id="te-when" label={t("When to use")} hint={t("Tell the agent when to call this — e.g. when the customer asks about their orders.")} rows={2} value={f.when} onChange={set("when")} />
            <TextInput id="te-desc" label={t("Short description")} optional value={f.description} onChange={set("description")} />
            <Field id="te-kind" label={t("What it does")}>
              <SegmentedControl
                label={t("What it does")}
                value={f.kind}
                onChange={(v) => setF({ ...f, kind: v })}
                options={[
                  { value: "read", label: t("Look up (runs now)") },
                  { value: "write", label: t("Make a change (needs confirm)") },
                ]}
              />
            </Field>
          </div>
        </Collapsible>

        <Collapsible step={2} title={t("API")} desc={f.path || undefined} done={Boolean(f.path)} {...sec("api")}>
          <div className="stack" style={{ gap: 14 }}>
            <div className="stack" style={{ gap: 6 }}>
              <span className="field-label">{t("Inputs the agent collects")}</span>
              <span className="field-hint">{t("Values the agent fills from the chat and puts in the request with {{args.name}}.")}</span>
              <InputsEditor inputs={f.inputs} onChange={(v) => setF({ ...f, inputs: v })} />
            </div>
            <div className="row-wrap" style={{ gap: 8, alignItems: "flex-end" }}>
              <Field id="te-method" label={t("Method")}>
                <select className="input" value={f.method} onChange={set("method")} style={{ width: 110 }}>
                  {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </Field>
              <div style={{ flex: 1, minWidth: 220 }}>
                <TextInput id="te-path" label={t("Endpoint path")} placeholder="/b/trade/tdeal/order/order_list:table" value={f.path} onChange={set("path")} error={errors.path} />
              </div>
            </div>
            <div className="stack" style={{ gap: 6 }}>
              <span className="field-label">{t("Headers")}</span>
              <KVEditor rows={f.headers} onChange={(v) => setF({ ...f, headers: v })} keyLabel={t("Header")} valueLabel={t("Value")} addLabel={t("Add header")} />
            </div>
            <Textarea id="te-body" label={t("Request body (JSON)")} optional hint={t("Use {{args.name}} for inputs.")} className="mono" rows={6} value={f.body} onChange={set("body")} error={errors.body} spellCheck={false} />
          </div>
        </Collapsible>

        <Collapsible step={3} title={t("Test response")} {...sec("test")}>
          {isNew ? <p className="helper">{t("Save the integration first to test a live request.")}</p> : <ToolPreview base={base} integrationId={integrationId} baseUrl={baseUrl} config={previewConfig} />}
        </Collapsible>

        <Collapsible step={4} title={t("Response & confirm (advanced)")} {...sec("advanced")}>
          <Textarea
            id="te-adv"
            label={t("Response shaping and confirm card (JSON)")}
            hint={t("response: how to read the answer (rows + columns, or a json pick). confirm (for changes): the card's title and lines.")}
            className="mono"
            rows={8}
            value={f.advanced}
            onChange={set("advanced")}
            error={errors.advanced}
            spellCheck={false}
          />
        </Collapsible>
      </div>
    </Dialog>
  );
}

function InputsEditor({ inputs, onChange }) {
  const setRow = (i, patch) => onChange(inputs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="stack" style={{ gap: 6 }}>
      {inputs.map((row, i) => (
        <div className="input-row" key={i}>
          <input className="input sm mono" placeholder={t("name")} value={row.name} onChange={(e) => setRow(i, { name: e.target.value })} />
          <select className="input sm" value={row.type} onChange={(e) => setRow(i, { type: e.target.value })}>
            {Object.keys(INPUT_TYPES).map((tp) => (
              <option key={tp}>{tp}</option>
            ))}
          </select>
          <input className="input sm" placeholder={t("What the agent should ask for")} value={row.description} onChange={(e) => setRow(i, { description: e.target.value })} />
          <IconButton icon="x" size="sm" label={t("Remove")} tooltip={false} onClick={() => onChange(inputs.filter((_, j) => j !== i))} />
        </div>
      ))}
      <div>
        <Button size="sm" variant="secondary" icon="plus" onClick={() => onChange([...inputs, { name: "", type: "Text", description: "", required: false }])}>
          {t("Add data input")}
        </Button>
      </div>
    </div>
  );
}

function KVEditor({ rows, onChange, keyLabel, valueLabel, addLabel }) {
  const setRow = (i, patch) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="stack" style={{ gap: 6 }}>
      {rows.map((row, i) => (
        <div className="kv-row" key={i}>
          <input className="input sm mono" placeholder={keyLabel} value={row.k} onChange={(e) => setRow(i, { k: e.target.value })} />
          <input className="input sm mono" placeholder={valueLabel} value={row.v} onChange={(e) => setRow(i, { v: e.target.value })} />
          <IconButton icon="x" size="sm" label={t("Remove")} tooltip={false} onClick={() => onChange(rows.filter((_, j) => j !== i))} />
        </div>
      ))}
      <div>
        <Button size="sm" variant="secondary" icon="plus" onClick={() => onChange([...rows, { k: "", v: "" }])}>
          {addLabel}
        </Button>
      </div>
    </div>
  );
}
