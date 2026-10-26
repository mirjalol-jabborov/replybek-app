import { useState } from "react";
import { t } from "../i18n.js";
import { Icon } from "../icons.jsx";
import { api } from "../api.js";
import { useWorkspace } from "../workspace.jsx";
import {
  Dialog,
  Button,
  TextInput,
  Textarea,
  Callout,
  useToast,
} from "../ui.jsx";
import { ToolsSection } from "./integration-tools.jsx";
import { AIIntegrationPanel } from "./integration-ai.jsx";
import {
  ImportPanel,
  ActionTest,
  ProcedureEditor,
  JsonValue,
} from "./integration-panels.jsx";

const empty = {
  headers: {},
  context: [],
  account: {},
  tools: [],
  procedures: [],
};
const stages = () => [
  t("Start"),
  t("Connection"),
  t("Actions"),
  t("Procedures"),
  t("Test"),
  t("Review"),
];
const configOf = (i) => ({
  ...empty,
  headers: i.headers || {},
  context: i.context || [],
  account: i.account || {},
  tools: i.tools || [],
  procedures: i.procedures || [],
});
export function IntegrationWizard({
  integration,
  redirectUri,
  onClose,
  onSaved,
}) {
  const { base, agents, activeAgent } = useWorkspace();
  const toast = useToast();
  const [saved, setSaved] = useState(integration),
    [step, setStep] = useState(integration.id ? 2 : 0),
    [importing, setImporting] = useState("ai"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false);
  const [f, setF] = useState({
    name: integration.name || "",
    agent_id: integration.agent_id || activeAgent?.id || agents[0]?.id,
    mode: integration.mode || "server",
    base_url: integration.base_url || "",
    auth: { type: "oauth", ...integration.auth },
    client_secret: "",
    config: configOf(integration),
  });
  const [rawConfig, setRawConfig] = useState(
    JSON.stringify(configOf(integration), null, 2),
  );
  const patch = (x) => {
    setF((v) => ({ ...v, ...x }));
    setDirty(true);
    setError("");
  };
  const auth = (x) => patch({ auth: { ...f.auth, ...x } });
  const changeConfig = (x) => {
    setRawConfig(JSON.stringify(x, null, 2));
    patch({ config: x });
  };
  const configChange = (text) => {
    setRawConfig(text);
    try {
      const parsed = JSON.parse(text);
      if (
        !parsed ||
        typeof parsed !== "object" ||
        Array.isArray(parsed) ||
        ["tools", "procedures", "context"].some(
          (k) => parsed[k] && !Array.isArray(parsed[k]),
        )
      )
        throw new Error();
      patch({ config: configOf(parsed) });
    } catch {
      setError(t("Fix the configuration JSON before saving."));
    }
  };
  const server = f.mode === "server";
  const authenticated =
    !server ||
    f.auth.type === "none" ||
    (f.auth.type === "api_key"
      ? f.client_secret || saved.has_client_secret
      : f.auth.authorize_url && f.auth.token_url && f.auth.client_id);
  const checks = [
    { label: t("System named"), ok: !!f.name.trim() },
    { label: t("Connection configured"), ok: !!f.base_url && !!authenticated },
    { label: t("Actions configured"), ok: f.config.tools.length > 0 },
    {
      label: t("Current configuration tested"),
      ok: !dirty && !!saved.last_test?.ok,
    },
  ];
  async function refreshTest() {
    await onSaved();
    const items = await api(`${base}/integrations`);
    const current = items.find((i) => i.id === saved.id);
    if (current) setSaved(current);
  }
  async function save(enable = false, close = false) {
    setError("");
    setBusy(true);
    try {
      const config = JSON.parse(rawConfig);
      const body = {
        name: f.name,
        agent_id: f.agent_id,
        mode: f.mode,
        base_url: f.base_url,
        auth: server ? f.auth : { browser_auth: f.auth.browser_auth || "session", header: f.auth.header, prefix: f.auth.prefix },
        ...config,
        enabled: enable,
        ...(f.client_secret ? { client_secret: f.client_secret } : {}),
      };
      const current = await api(
        saved.id ? `${base}/integrations/${saved.id}` : `${base}/integrations`,
        { method: saved.id ? "PATCH" : "POST", body },
      );
      setSaved(current);
      setF({ ...f, client_secret: "", config: configOf(current) });
      setRawConfig(JSON.stringify(configOf(current), null, 2));
      setDirty(false);
      await onSaved();
      toast(enable ? t("Integration enabled") : t("Draft saved"));
      if (close) onClose();
      else setStep(4);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function imported(i) {
    const config = configOf(i);
    setF({
      ...f,
      ...i,
      agent_id: f.agent_id,
      auth: { type: "oauth", ...i.auth },
      client_secret: "",
      config,
    });
    setRawConfig(JSON.stringify(config, null, 2));
    setDirty(true);
    setImporting(false);
    setStep(1);
  }
  return (
    <Dialog
      title={
        saved.id
          ? t("Configure {name}", { name: saved.name })
          : t("Connect a business system")
      }
      description={t(
        "Set up a connection, choose actions, test them, then enable your agent.",
      )}
      size="integration"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t("Close")}</Button>
          {step > 0 && (
            <Button onClick={() => setStep(step - 1)}>{t("Back")}</Button>
          )}
          <Button loading={busy} onClick={() => save(false)}>
            {t("Save draft")}
          </Button>
          {step < 5 ? (
            <Button variant="primary" onClick={() => setStep(step + 1)}>
              {t("Continue")}
            </Button>
          ) : (
            <Button
              variant="primary"
              loading={busy}
              disabled={!f.config.tools.length}
              onClick={() => save(true, true)}
            >
              {t("Save and enable")}
            </Button>
          )}
        </>
      }
    >
      <div className="ib-wizard">
        <aside className="ib-sidebar">
          <div className="ib-system">
            <span className="ib-system-icon">
              <Icon name="link" size={20} />
            </span>
            <strong>{f.name || t("New integration")}</strong>
            <span className="helper">
              {saved.enabled ? t("Enabled") : t("Draft")}
            </span>
          </div>
          <nav className="ib-stages" aria-label={t("Integration setup steps")}>
            {stages().map((name, i) => (
              <button
                key={name}
                type="button"
                aria-current={step === i ? "step" : undefined}
                onClick={() => setStep(i)}
              >
                <Icon
                  name={
                    [
                      "settings",
                      "link",
                      "code",
                      "layers",
                      "flask",
                      "checkCircle",
                    ][i]
                  }
                  size={16}
                />
                {name}
              </button>
            ))}
          </nav>
          <p className="ib-sidebar-note">
            {t("Connect once. Give your agent the actions it needs.")}
          </p>
        </aside>
        <div className="ib-main stack">
          <div className="ib-section-heading">
            <span className="eyebrow">{t("Integration setup")}</span>
            <h3>{stages()[step]}</h3>
          </div>
          {error && <Callout tone="bad">{error}</Callout>}
          {saved.enabled && (
            <Callout>
              {t(
                "This integration is currently enabled. Saving a draft disables it until you enable it again.",
              )}
            </Callout>
          )}
          {step === 0 && (
            <div className="stack">
              <h3>{t("How would you like to start?")}</h3>
              <div className="grid-2">
                <button className={"type-card" + (importing === "ai" ? " sel" : "")} onClick={() => setImporting("ai")}>
                  <Icon name="bot" size={22} />
                  <span><strong>{t("Set up with AI")}</strong><span className="type-card-desc">{t("Add documentation. Review the connection and actions AI prepares.")}</span></span>
                </button>
                <button
                  className={"type-card" + (!importing ? " sel" : "")}
                  onClick={() => setImporting(false)}
                >
                  <Icon name="code" size={22} />
                  <span>
                    <strong>{t("Build with forms")}</strong>
                    <span className="type-card-desc">
                      {t(
                        "Describe your connection and add actions one at a time.",
                      )}
                    </span>
                  </span>
                </button>
                <button
                  className={"type-card" + (importing === "import" ? " sel" : "")}
                  onClick={() => setImporting("import")}
                >
                  <Icon name="upload" size={22} />
                  <span>
                    <strong>{t("Import a definition")}</strong>
                    <span className="type-card-desc">
                      {t(
                        "Start from cURL, OpenAPI or a reusable Replybek package.",
                      )}
                    </span>
                  </span>
                </button>
              </div>
              {importing === "ai" ? <AIIntegrationPanel base={base} onImport={imported} /> : importing === "import" ? (
                <ImportPanel base={base} onImport={imported} />
              ) : (
                <>
                  <TextInput
                    id="builder-name"
                    label={t("Integration name")}
                    placeholder={t("Your business system")}
                    value={f.name}
                    onChange={(e) => patch({ name: e.target.value })}
                  />
                  <label className="field-label" htmlFor="builder-agent">
                    {t("Agent")}
                  </label>
                  <select
                    id="builder-agent"
                    className="input"
                    disabled={!!saved.id}
                    value={f.agent_id}
                    onChange={(e) => patch({ agent_id: e.target.value })}
                  >
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  <p className="helper">
                    {t(
                      "No system-specific code is required. Every connection is defined by its authentication, actions and mappings.",
                    )}
                  </p>
                </>
              )}
            </div>
          )}
          {step === 1 && (
            <div className="stack">
              <TextInput
                id="connection-name"
                label={t("Integration name")}
                value={f.name}
                onChange={(e) => patch({ name: e.target.value })}
              />
              <div className="grid-2">
                {[
                  [
                    "server",
                    t("Server connection"),
                    t(
                      "Replybek calls the API using OAuth, an API key or a public endpoint.",
                    ),
                  ],
                  [
                    "in_page",
                    t("Customer browser session"),
                    t(
                      "Requests run inside the connected system as its signed-in user.",
                    ),
                  ],
                ].map(([value, title, description]) => (
                  <button
                    key={value}
                    className={"type-card" + (f.mode === value ? " sel" : "")}
                    onClick={() => patch({ mode: value })}
                  >
                    <span>
                      <strong>{title}</strong>
                      <span className="type-card-desc">{description}</span>
                    </span>
                  </button>
                ))}
              </div>
              <TextInput
                id="connection-url"
                label={t("System address")}
                value={f.base_url}
                placeholder="https://api.example.com"
                onChange={(e) => patch({ base_url: e.target.value })}
              />
              {server ? (
                <>
                  <label className="field-label" htmlFor="connection-auth">
                    {t("Authentication")}
                  </label>
                  <select
                    id="connection-auth"
                    className="input"
                    value={f.auth.type}
                    onChange={(e) => auth({ type: e.target.value })}
                  >
                    <option value="oauth">{t("Customer OAuth sign-in")}</option>
                    <option value="api_key">{t("Business API key")}</option>
                    <option value="none">
                      {t("Public API (no authentication)")}
                    </option>
                  </select>
                  {f.auth.type === "oauth" && (
                    <>
                      <div className="grid-2">
                        <TextInput
                          id="oauth-authorize"
                          label={t("Sign-in page path")}
                          value={f.auth.authorize_url || ""}
                          onChange={(e) =>
                            auth({ authorize_url: e.target.value })
                          }
                          placeholder="/oauth/authorize"
                        />
                        <TextInput
                          id="oauth-token"
                          label={t("Token path")}
                          value={f.auth.token_url || ""}
                          onChange={(e) => auth({ token_url: e.target.value })}
                          placeholder="/oauth/token"
                        />
                        <TextInput
                          id="oauth-client"
                          label={t("Client ID")}
                          value={f.auth.client_id || ""}
                          onChange={(e) => auth({ client_id: e.target.value })}
                        />
                        <TextInput
                          id="oauth-secret"
                          label={t("Client secret")}
                          type="password"
                          autoComplete="new-password"
                          placeholder={
                            saved.has_client_secret
                              ? t("Saved. Leave empty to keep it.")
                              : ""
                          }
                          value={f.client_secret}
                          onChange={(e) =>
                            patch({ client_secret: e.target.value })
                          }
                        />
                        <TextInput
                          id="oauth-scope"
                          label={t("Scope")}
                          value={f.auth.scope || ""}
                          onChange={(e) => auth({ scope: e.target.value })}
                        />
                        <label>
                          {t("Token request format")}
                          <select
                            className="input"
                            value={f.auth.token_format || "form"}
                            onChange={(e) =>
                              auth({ token_format: e.target.value })
                            }
                          >
                            <option value="form">{t("Form")}</option>
                            <option value="json">JSON</option>
                          </select>
                        </label>
                      </div>
                      <Callout>
                        {t("Register this return address in the system:")}{" "}
                        <code>{redirectUri}</code>
                      </Callout>
                    </>
                  )}
                  {f.auth.type === "api_key" && (
                    <>
                      <Callout>
                        {t(
                          "This key uses the business account for every customer. Only expose actions and data that this audience is allowed to access. Use customer OAuth for private per-customer accounts.",
                        )}
                      </Callout>
                      <TextInput
                        id="api-key"
                        label={t("API key")}
                        type="password"
                        autoComplete="new-password"
                        value={f.client_secret}
                        placeholder={
                          saved.has_client_secret
                            ? t("Saved. Leave empty to keep it.")
                            : ""
                        }
                        onChange={(e) =>
                          patch({ client_secret: e.target.value })
                        }
                      />
                      <div className="grid-2">
                        <TextInput
                          id="api-key-header"
                          label={t("Authentication header")}
                          value={f.auth.header || "Authorization"}
                          onChange={(e) => auth({ header: e.target.value })}
                        />
                        <TextInput
                          id="api-key-prefix"
                          label={t("Key prefix")}
                          hint={t(
                            "Use “Bearer ” including the space, or leave empty for a raw key.",
                          )}
                          value={f.auth.prefix ?? "Bearer "}
                          onChange={(e) => auth({ prefix: e.target.value })}
                        />
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="stack">
                  <Callout>{t('Install the widget inside this system with data-inpage="true". Its origin must match the system address. No customer session cookies are stored by Replybek.')}</Callout>
                  <label className="stack-xs" htmlFor="browser-auth">
                    <span className="field-label">{t("Browser authentication")}</span>
                    <select id="browser-auth" className="input" value={f.auth.browser_auth || "session"} onChange={e => auth({browser_auth:e.target.value})}>
                      <option value="session">{t("Browser: existing session cookies")}</option>
                      <option value="host_token">{t("Frontend: current user’s token")}</option>
                    </select>
                  </label>
                  {f.auth.browser_auth === "host_token" && <>
                    <p className="helper">{t("Your developer connects this callback to your app’s current-user token provider. The widget reads it for each same-origin API request. It is never added to the chat or integration settings.")}</p>
                    <pre className="code"><code>{`window.ReplybekAuth = {
  async getToken({ integrationId, method, path }) {
    // Replace with your application's current-user credential.
    return await yourApp.getCurrentUserToken();
  }
};`}</code></pre>
                    <div className="grid-2">
                      <TextInput id="browser-auth-header" label={t("Authentication header")} value={f.auth.header || "Authorization"} onChange={e => auth({header:e.target.value})}/>
                      <TextInput id="browser-auth-prefix" label={t("Key prefix")} value={f.auth.prefix ?? "Bearer "} onChange={e => auth({prefix:e.target.value})}/>
                    </div>
                    <Callout>{t("The host app must supply a valid credential for the documented authentication scheme. Requests stop if the callback is missing; cross-origin APIs need a same-origin proxy or a server connection.")}</Callout>
                  </>}
                </div>
              )}
              <AccountContext
                value={f.config.context}
                onChange={(context) => changeConfig({ ...f.config, context })}
              />
              <details>
                <summary>{t("Advanced connection settings")}</summary>
                <JsonValue
                  validate={(v) =>
                    !v.headers ||
                    (!Array.isArray(v.headers) && typeof v.headers === "object")
                  }
                  key={saved.id || "new"}
                  label={t("Headers, account label and context")}
                  value={{
                    headers: f.config.headers,
                    account: f.config.account,
                  }}
                  onChange={(x) =>
                    changeConfig({
                      ...f.config,
                      headers: x.headers || {},
                      account: x.account || {},
                    })
                  }
                />
              </details>
            </div>
          )}
          {step === 2 && (
            <ToolsSection
              base={base}
              integrationId={saved.id}
              baseUrl={f.base_url}
              mode={f.mode}
              authType={f.auth.type}
              isNew={!saved.id}
              config={rawConfig}
              onChange={configChange}
              error={error}
            />
          )}
          {step === 3 && (
            <ProcedureEditor
              value={f.config.procedures || []}
              onChange={(procedures) =>
                changeConfig({ ...f.config, procedures })
              }
              tools={f.config.tools}
              base={base}
            />
          )}
          {step === 4 && (
            <>
              <h3>{t("Verify your configuration")}</h3>
              {dirty && (
                <Callout>
                  {t(
                    "You have unsaved changes. Save a draft to test the latest authentication settings. Draft request previews and simulations use your current action edits.",
                  )}
                </Callout>
              )}
              <ActionTest
                base={base}
                integrationId={saved.id}
                baseUrl={f.base_url}
                mode={f.mode}
                authType={f.auth.type}
                config={rawConfig}
                onTest={refreshTest}
              />
            </>
          )}
          {step === 5 && (
            <div className="stack">
              <h3>{t("Ready to enable?")}</h3>
              {checks.map((c) => (
                <div key={c.label} className="row">
                  <span className={"badge " + (c.ok ? "green" : "amber")}>
                    {c.ok ? "✓" : "○"}
                  </span>
                  {c.label}
                </div>
              ))}
              <p className="helper">
                {t(
                  "A simulated result checks your mappings. A live read test checks connectivity. Neither guarantees that every business workflow will succeed.",
                )}
              </p>
              <div className="ib-input">
                <strong>{f.name}</strong>
                <p>{f.base_url}</p>
                <p>
                  {t("{count} actions", { count: f.config.tools.length })} ·{" "}
                  {t("{count} procedures", {
                    count: (f.config.procedures || []).length,
                  })}
                </p>
                <p className="helper">
                  {t(
                    "Write actions always require customer confirmation. Enable only after reviewing every action and its access to business data.",
                  )}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
function AccountContext({ value, onChange }) {
  const update = (i, patch) =>
    onChange(value.map((x, j) => (i === j ? { ...x, ...patch } : x)));
  return (
    <details>
      <summary>{t("Account context")}</summary>
      <div className="stack">
        <p className="helper">
          {t(
            "Read account fields once after connection, then bind action inputs to these trusted values.",
          )}
        </p>
        {value.map((x, i) => (
          <div className="ib-input stack" key={i}>
            <div className="grid-2">
              <TextInput
                id={`ctx-name-${i}`}
                label={t("Context name")}
                value={x.name}
                placeholder="account_id"
                onChange={(e) => update(i, { name: e.target.value })}
              />
              <TextInput
                id={`ctx-path-${i}`}
                label={t("Endpoint path")}
                value={x.request.path}
                placeholder="/me"
                onChange={(e) =>
                  update(i, { request: { ...x.request, path: e.target.value } })
                }
              />
            </div>
            <div className="grid-2">
              <select
                aria-label={t("Context request method")}
                className="input"
                value={x.request.method || "GET"}
                onChange={(e) =>
                  update(i, {
                    request: { ...x.request, method: e.target.value },
                  })
                }
              >
                <option>GET</option>
                <option>POST</option>
              </select>
              <TextInput
                id={`ctx-pick-${i}`}
                label={t("Response field")}
                value={x.pick}
                placeholder="user.id"
                onChange={(e) => update(i, { pick: e.target.value })}
              />
            </div>
            <Button
              size="sm"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
            >
              {t("Remove")}
            </Button>
          </div>
        ))}
        <Button
          size="sm"
          onClick={() =>
            onChange([
              ...value,
              { name: "", request: { method: "GET", path: "" }, pick: "" },
            ])
          }
        >
          {t("Add account field")}
        </Button>
      </div>
    </details>
  );
}
