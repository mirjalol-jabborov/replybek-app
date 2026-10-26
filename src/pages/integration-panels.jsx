import { useEffect, useState } from "react";
import { t } from "../i18n.js";
import { api } from "../api.js";
import { Button, Textarea, TextInput, Field, Callout } from "../ui.jsx";

export function ImportPanel({ base, onImport }) {
  const [format, setFormat] = useState("curl"),
    [source, setSource] = useState(""),
    [data, setData] = useState(null),
    [selected, setSelected] = useState([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function parse() {
    setBusy(true);
    setError("");
    setData(null);
    try {
      const result = await api(`${base}/integrations/import`, {
        method: "POST",
        body: { format, source },
      });
      setData(result);
      setSelected(result.integration.tools.map((x) => x.name));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="stack">
      <label className="field-label" htmlFor="import-format">
        {t("Import from")}
      </label>
      <select
        id="import-format"
        className="input"
        value={format}
        onChange={(e) => {
          setFormat(e.target.value);
          setData(null);
        }}
      >
        <option value="curl">cURL</option>
        <option value="openapi">OpenAPI 3 (JSON / YAML)</option>
        <option value="package">{t("Replybek configuration package")}</option>
      </select>
      <Textarea
        id="import-source"
        label={t("Paste your definition")}
        value={source}
        onChange={(e) => {
          setSource(e.target.value);
          setData(null);
        }}
        rows={7}
        className="mono"
        placeholder={
          format === "curl"
            ? 'curl https://api.example.com/orders -H "Accept: application/json"'
            : ""
        }
      />
      <label className="helper">
        {t("Or choose a JSON, YAML or text file")}
        <input
          type="file"
          accept=".json,.yaml,.yml,.txt"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            if (f.size > 800000) {
              setError(t("Choose a file smaller than 800 KB."));
              return;
            }
            setSource(await f.text());
            setData(null);
          }}
        />
      </label>
      <p className="helper">
        {t(
          "Imports prepare drafts and never execute commands. Review authentication, inputs and write permissions before enabling.",
        )}
      </p>
      {error && <Callout tone="bad">{error}</Callout>}
      <Button loading={busy} disabled={!source.trim()} onClick={parse}>
        {t("Preview import")}
      </Button>
      {data && (
        <div className="stack ib-input">
          <strong>{data.integration.name}</strong>
          {data.warnings.map((w, i) => (
            <p className="helper" key={i}>
              {w}
            </p>
          ))}
          {data.integration.tools.map((tool) => (
            <label className="row" key={tool.name}>
              <input
                type="checkbox"
                checked={selected.includes(tool.name)}
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? [...selected, tool.name]
                      : selected.filter((n) => n !== tool.name),
                  )
                }
                disabled={format === "package"}
              />
              <span>
                <strong>{tool.name}</strong>
                <span className="helper">
                  {" "}
                  {tool.request.method} {tool.request.path} ·{" "}
                  {tool.kind === "write"
                    ? t("Confirmation required")
                    : t("Read action")}
                </span>
              </span>
            </label>
          ))}
          <Button
            variant="primary"
            disabled={!selected.length}
            onClick={() =>
              onImport({
                ...data.integration,
                tools: data.integration.tools.filter((x) =>
                  selected.includes(x.name),
                ),
              })
            }
          >
            {t("Use this configuration")}
          </Button>
        </div>
      )}
    </div>
  );
}

export function ResponseEditor({ value, onChange, kind }) {
  let config;
  try {
    config = JSON.parse(value);
  } catch {
    return (
      <Callout tone="bad">
        {t("Fix the advanced JSON to use visual mapping.")}
      </Callout>
    );
  }
  const r = config.response || { type: "json" };
  const update = (patch) =>
    onChange(
      JSON.stringify({ ...config, response: { ...r, ...patch } }, null, 2),
    );
  const fields = Object.entries(r.fields || {});
  return (
    <div className="stack">
      <label className="field-label">{t("Response format")}</label>
      <select
        aria-label={t("Response format")}
        className="input"
        value={r.type || "json"}
        onChange={(e) => update({ type: e.target.value })}
      >
        <option value="json">JSON</option>
        <option value="rows">{t("Rows and columns")}</option>
      </select>
      {r.type === "rows" ? (
        <div className="grid-2">
          <TextInput
            id="response-rows"
            label={t("Rows field")}
            value={r.rows || ""}
            placeholder="data"
            onChange={(e) => update({ rows: e.target.value })}
          />
          <TextInput
            id="response-columns"
            label={t("Column names")}
            value={Array.isArray(r.columns) ? r.columns.join(", ") : ""}
            placeholder="id, name, price"
            onChange={(e) =>
              update({
                columns: e.target.value
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
              })
            }
          />
        </div>
      ) : (
        <>
          <TextInput
            id="response-pick"
            label={t("Read data from")}
            hint={t(
              "Leave empty for the whole response. Use a path such as data.orders.",
            )}
            value={r.pick || ""}
            onChange={(e) => update({ pick: e.target.value })}
          />
          <span className="field-label">{t("Fields the agent can see")}</span>
          <p className="helper">
            {t(
              "Map friendly names to fields in the selected data. Leave empty to return all fields.",
            )}
          </p>
          {fields.map(([name, path], i) => (
            <div className="row-wrap" key={i}>
              <input
                aria-label={t("Output name")}
                className="input sm"
                value={name}
                placeholder="order_status"
                onChange={(e) =>
                  update({
                    fields: Object.fromEntries(
                      fields.map((v, j) =>
                        j === i ? [e.target.value, v[1]] : v,
                      ),
                    ),
                  })
                }
              />
              <input
                aria-label={t("Response field")}
                className="input sm"
                value={path}
                placeholder="status.label"
                onChange={(e) =>
                  update({
                    fields: Object.fromEntries(
                      fields.map((v, j) =>
                        j === i ? [v[0], e.target.value] : v,
                      ),
                    ),
                  })
                }
              />
              <Button
                size="sm"
                onClick={() =>
                  update({
                    fields: Object.fromEntries(
                      fields.filter((_, j) => j !== i),
                    ),
                  })
                }
              >
                {t("Remove")}
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            onClick={() =>
              update({
                fields: { ...r.fields, [`field_${fields.length + 1}`]: "" },
              })
            }
          >
            {t("Add response field")}
          </Button>
        </>
      )}
      {kind === "write" && (
        <>
          <TextInput
            id="confirm-title"
            label={t("Confirmation title")}
            value={config.confirm?.title || ""}
            placeholder={t("Create order for {{args.customer_name}}")}
            onChange={(e) =>
              onChange(
                JSON.stringify(
                  {
                    ...config,
                    confirm: { ...config.confirm, title: e.target.value },
                  },
                  null,
                  2,
                ),
              )
            }
          />
          <p className="helper">
            {t("The customer must confirm before this action makes a change.")}
          </p>
        </>
      )}
    </div>
  );
}

// What the tester asks for, derived from the action itself: the inputs the agent
// collects in the chat, and the account-context values it reads after sign-in.
function scenarioFields(tool, parsed) {
  const props = tool?.input?.properties || {};
  const bindings = tool?.bindings || {};
  const customer = Object.entries(props)
    .filter(([k]) => !bindings[k] || bindings[k].source === "customer")
    .map(([name, def]) => ({
      name,
      type: def?.type || "string",
      description: def?.description || "",
    }));
  const keys = new Set();
  for (const c of parsed?.context || []) if (c?.name) keys.add(c.name);
  for (const b of Object.values(bindings))
    if (b?.source === "context" && b.path)
      keys.add(String(b.path).split(".")[0]);
  return { customer, context: [...keys].map((name) => ({ name })) };
}

// A small labeled form that reads and writes one JSON object, kept as a JSON string
// so the request sent to the backend is unchanged.
function ValueFields({ specs, value, onChange }) {
  let obj = {};
  try {
    const p = JSON.parse(value || "{}");
    if (p && typeof p === "object" && !Array.isArray(p)) obj = p;
  } catch {
    /* fall back to an empty object; the JSON view is where raw edits happen */
  }
  const setKey = (name, v) => {
    const next = { ...obj };
    if (v === undefined) delete next[name];
    else next[name] = v;
    onChange(JSON.stringify(next, null, 2));
  };
  return (
    <div className="stack" style={{ gap: 8 }}>
      {specs.map((s) => {
        const v = obj[s.name];
        const id = `sf-${s.name}`;
        if (s.type === "boolean")
          return (
            <Field key={s.name} id={id} label={s.name} hint={s.description}>
              <select
                id={id}
                className="input"
                value={v === true ? "true" : v === false ? "false" : ""}
                onChange={(e) =>
                  setKey(
                    s.name,
                    e.target.value === "" ? undefined : e.target.value === "true",
                  )
                }
              >
                <option value="">{t("Not set")}</option>
                <option value="true">{t("Yes")}</option>
                <option value="false">{t("No")}</option>
              </select>
            </Field>
          );
        if (s.type === "number")
          return (
            <TextInput
              key={s.name}
              id={id}
              label={s.name}
              hint={s.description}
              type="number"
              value={v ?? ""}
              onChange={(e) =>
                setKey(
                  s.name,
                  e.target.value === "" ? undefined : Number(e.target.value),
                )
              }
            />
          );
        if (s.type === "array" || s.type === "object")
          return (
            <Textarea
              key={s.name}
              id={id}
              label={s.name}
              hint={s.description || t("Enter a JSON value.")}
              className="mono"
              rows={3}
              value={
                v === undefined ? "" : typeof v === "string" ? v : JSON.stringify(v)
              }
              onChange={(e) => {
                let nv = e.target.value;
                try {
                  nv = JSON.parse(e.target.value);
                } catch {
                  /* keep the text as-is until it parses */
                }
                setKey(s.name, e.target.value === "" ? undefined : nv);
              }}
            />
          );
        return (
          <TextInput
            key={s.name}
            id={id}
            label={s.name}
            hint={s.description}
            value={v ?? ""}
            onChange={(e) =>
              setKey(s.name, e.target.value === "" ? undefined : e.target.value)
            }
          />
        );
      })}
    </div>
  );
}

export function ActionTest({
  base,
  integrationId,
  baseUrl,
  mode,
  authType,
  config,
  onTest,
}) {
  let parsed = {};
  try {
    parsed = JSON.parse(config);
  } catch {
    /* editor error is shown elsewhere */
  }
  const tools = parsed.tools || [];
  const [selected, setSelected] = useState(""),
    [rawScenario, setRawScenario] = useState(false),
    [args, setArgs] = useState("{}"),
    [context, setContext] = useState("{}"),
    [steps, setSteps] = useState("{}"),
    [mock, setMock] = useState("{}"),
    [token, setToken] = useState(""),
    [status, setStatus] = useState(200),
    [result, setResult] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [runId, setRunId] = useState("");
  const tool = tools.find((x) => x.name === selected) || tools[0];
  const scenario = scenarioFields(tool, parsed);
  useEffect(() => {
    setResult(null);
    setRunId("");
  }, [config, baseUrl, selected, args, context, steps, mock, status]);
  useEffect(() => {
    if (!runId) return;
    let stopped = false;
    const timer = setInterval(async () => {
      try {
        const r = await api(
          `${base}/integrations/${integrationId}/tests/${runId}`,
        );
        if (stopped) return;
        if (r.result) {
          setResult(r.result);
          setRunId("");
          onTest?.();
        } else if (r.expired) {
          setError(t("The browser test expired. Create a new test."));
          setRunId("");
        }
      } catch (e) {
        if (!stopped) {
          setError(e.message);
          setRunId("");
        }
      }
    }, 2500);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [runId, base, integrationId]);
  async function run(testMode) {
    setError("");
    setResult(null);
    setBusy(true);
    setRunId("");
    try {
      const r = await api(`${base}/integrations/${integrationId}/test`, {
        method: "POST",
        body: {
          tool,
          base_url: baseUrl,
          headers: parsed.headers || {},
          args: JSON.parse(args),
          context: JSON.parse(context),
          steps: JSON.parse(steps),
          mode: testMode,
          mock: JSON.parse(mock),
          sample_status: Number(status),
          ...(token ? { access_token: token } : {}),
        },
      });
      setResult(r);
      if (r.run_id) setRunId(r.run_id);
      onTest?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      setToken("");
    }
  }
  if (!integrationId)
    return (
      <Callout>
        {t(
          "Save a draft first, then test it here. Your agent cannot use a disabled draft.",
        )}
      </Callout>
    );
  if (!tool) return <Callout>{t("Add an action before testing.")}</Callout>;
  return (
    <div className="stack">
      <label className="field-label" htmlFor="test-action">
        {t("Action to test")}
      </label>
      <select
        className="input"
        id="test-action"
        value={tool.name}
        onChange={(e) => setSelected(e.target.value)}
      >
        {tools.map((x) => (
          <option key={x.name}>{x.name}</option>
        ))}
      </select>
      <div className="stack" style={{ gap: 8 }}>
        <div className="row-wrap" style={{ justifyContent: "space-between" }}>
          <span className="field-label">{t("Sample scenario")}</span>
          <button
            type="button"
            className="link"
            onClick={() => setRawScenario((v) => !v)}
          >
            {rawScenario ? t("Fill with the form") : t("Edit as JSON")}
          </button>
        </div>
        {rawScenario ? (
          <div className="grid-2">
            <Textarea
              id="test-inputs"
              label={t("Sample customer inputs (JSON)")}
              value={args}
              onChange={(e) => setArgs(e.target.value)}
              rows={4}
            />
            <Textarea
              id="test-context"
              label={t("Sample account context (JSON)")}
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={4}
            />
          </div>
        ) : (
          <div className="grid-2">
            <div className="stack" style={{ gap: 6 }}>
              <span className="field-hint">
                {t("Customer inputs — what the agent collects in the chat.")}
              </span>
              {scenario.customer.length ? (
                <ValueFields
                  specs={scenario.customer}
                  value={args}
                  onChange={setArgs}
                />
              ) : (
                <p className="helper">
                  {t("This action takes no customer inputs.")}
                </p>
              )}
            </div>
            <div className="stack" style={{ gap: 6 }}>
              <span className="field-hint">
                {t("Account context — read from the signed-in account.")}
              </span>
              {scenario.context.length ? (
                <ValueFields
                  specs={scenario.context}
                  value={context}
                  onChange={setContext}
                />
              ) : (
                <p className="helper">
                  {t("This action uses no account context.")}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
      {Object.values(tool.bindings || {}).some((b) => b.source === "step") && (
        <Textarea
          id="test-steps"
          label={t("Sample previous step results (JSON)")}
          value={steps}
          onChange={(e) => setSteps(e.target.value)}
          rows={4}
        />
      )}
      <Textarea
        id="test-mock"
        label={t("Mock system response (JSON)")}
        value={mock}
        onChange={(e) => setMock(e.target.value)}
        rows={4}
      />
      <TextInput
        id="test-status"
        label={t("Simulated HTTP status")}
        type="number"
        min="100"
        max="599"
        value={status}
        onChange={(e) => setStatus(e.target.value)}
      />
      {mode === "server" && (!authType || authType === "oauth") && (
        <TextInput
          id="test-token"
          label={t("Temporary test access token")}
          hint={t(
            "Use a token from your own account. It is used once and is not saved.",
          )}
          type="password"
          autoComplete="off"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
      )}
      <div className="row-wrap">
        <Button disabled={busy} onClick={() => run("preview")}>
          {t("Preview request")}
        </Button>
        <Button disabled={busy} onClick={() => run("mock")}>
          {t("Simulate response")}
        </Button>
        <Button
          variant="primary"
          loading={busy}
          disabled={tool.kind !== "read" || tool.request?.method !== "GET"}
          onClick={() => run(mode === "in_page" ? "browser" : "live")}
        >
          {mode === "in_page"
            ? t("Prepare browser read test")
            : t("Run read test")}
        </Button>
      </div>
      <p className="helper">
        {t(
          "Live tests allow GET read actions only. Simulate POST actions and writes. Browser tests run in your own signed-in system tab.",
        )}
      </p>
      {error && <Callout tone="bad">{error}</Callout>}
      {result && (
        <div className="ib-test-result">
          <strong>{result.message || t("Request preview")}</strong>
          {result.script ? (
            <>
              <p className="helper">
                {t(
                  "Open the connected system, then run this script in its developer console. It reads one endpoint and sends the test result back to Replybek.",
                )}
              </p>
              <Textarea
                id="browser-script"
                label={t("Browser test script")}
                value={result.script}
                readOnly
                rows={8}
              />
              <Button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(result.script);
                  } catch {
                    setError(t("Select the script and copy it manually."));
                  }
                }}
              >
                {t("Copy script")}
              </Button>
            </>
          ) : (
            <pre className="code">{JSON.stringify(result, null, 2)}</pre>
          )}
        </div>
      )}
    </div>
  );
}

export function ProcedureEditor({ value, onChange, tools, base }) {
  const [index, setIndex] = useState(-1),
    [args, setArgs] = useState("{}"),
    [context, setContext] = useState("{}"),
    [mocks, setMocks] = useState("{}"),
    [result, setResult] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    setResult(null);
  }, [args, context, mocks]);
  const p = value[index];
  const update = (patch) => {
    onChange(value.map((x, i) => (i === index ? { ...x, ...patch } : x)));
    setResult(null);
  };
  const setStep = (i, patch) =>
    update({
      steps: p.steps.map((s, j) => (i === j ? { ...s, ...patch } : s)),
    });
  const inputs = Object.entries(p?.input?.properties || {});
  async function simulate() {
    setError("");
    setResult(null);
    try {
      setResult(
        await api(`${base}/integrations/simulate-procedure`, {
          method: "POST",
          body: {
            procedure: p,
            tools,
            args: JSON.parse(args),
            context: JSON.parse(context),
            mocks: JSON.parse(mocks),
          },
        }),
      );
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <div className="stack">
      <p className="helper">
        {t(
          "Procedures run actions in order. Checks stop the workflow when requirements fail. Every write still waits for customer confirmation.",
        )}
      </p>
      <div className="row-wrap">
        {value.map((x, i) => (
          <Button
            key={i}
            variant={i === index ? "primary" : "secondary"}
            onClick={() => {
              setIndex(i);
              setResult(null);
            }}
          >
            {x.name || t("Untitled procedure")}
          </Button>
        ))}
        <Button
          icon="plus"
          onClick={() => {
            onChange([
              ...value,
              {
                name: "",
                description: "",
                input: { type: "object", properties: {}, required: [] },
                steps: [],
              },
            ]);
            setIndex(value.length);
            setResult(null);
          }}
        >
          {t("Add procedure")}
        </Button>
      </div>
      {p && (
        <div className="stack ib-input">
          <div className="grid-2">
            <TextInput
              id="procedure-name"
              label={t("Procedure name")}
              value={p.name}
              placeholder="check_and_create_order"
              onChange={(e) => update({ name: e.target.value })}
            />
            <TextInput
              id="procedure-description"
              label={t("What it accomplishes")}
              value={p.description}
              onChange={(e) => update({ description: e.target.value })}
            />
          </div>
          <TextInput
            id="procedure-when"
            label={t("When to use")}
            value={p.when || ""}
            onChange={(e) => update({ when: e.target.value })}
          />
          <span className="field-label">
            {t("Customer inputs collected before starting")}
          </span>
          {inputs.map(([name, def], i) => (
            <div className="row-wrap" key={i}>
              <input
                aria-label={t("Procedure input name")}
                className="input sm"
                value={name}
                onChange={(e) => {
                  const entries = inputs.map((v, j) =>
                    j === i ? [e.target.value, v[1]] : v,
                  );
                  update({
                    input: {
                      ...p.input,
                      properties: Object.fromEntries(entries),
                      required: (p.input.required || []).map((n) =>
                        n === name ? e.target.value : n,
                      ),
                    },
                  });
                }}
              />
              <select
                aria-label={t("Input type")}
                className="input sm"
                value={def.type || "string"}
                onChange={(e) =>
                  update({
                    input: {
                      ...p.input,
                      properties: {
                        ...p.input.properties,
                        [name]: { ...def, type: e.target.value },
                      },
                    },
                  })
                }
              >
                {["string", "number", "boolean", "object", "array"].map(
                  (tp) => (
                    <option key={tp}>{tp}</option>
                  ),
                )}
              </select>
              <Button
                size="sm"
                onClick={() =>
                  update({
                    input: {
                      ...p.input,
                      properties: Object.fromEntries(
                        inputs.filter((_, j) => j !== i),
                      ),
                      required: (p.input.required || []).filter(
                        (n) => n !== name,
                      ),
                    },
                  })
                }
              >
                {t("Remove")}
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            onClick={() => {
              const name = `input_${inputs.length + 1}`;
              update({
                input: {
                  ...p.input,
                  properties: {
                    ...p.input.properties,
                    [name]: { type: "string" },
                  },
                  required: [...(p.input.required || []), name],
                },
              });
            }}
          >
            {t("Add procedure input")}
          </Button>
          {p.steps.map((s, i) => (
            <div className="ib-step stack" key={i}>
              <div className="row-wrap">
                <strong>{i + 1}.</strong>
                <input
                  aria-label={t("Step name")}
                  className="input sm"
                  value={s.id}
                  onChange={(e) => setStep(i, { id: e.target.value })}
                />
                <select
                  aria-label={t("Step type")}
                  className="input sm"
                  value={s.kind || "action"}
                  onChange={(e) =>
                    setStep(i, {
                      kind: e.target.value,
                      condition:
                        e.target.value === "check"
                          ? { path: "", op: "exists" }
                          : undefined,
                    })
                  }
                >
                  <option value="action">{t("Run action")}</option>
                  <option value="check">{t("Check a condition")}</option>
                </select>
                <Button
                  size="sm"
                  onClick={() =>
                    update({ steps: p.steps.filter((_, j) => j !== i) })
                  }
                >
                  {t("Remove")}
                </Button>
              </div>
              {s.kind !== "check" && (
                <>
                  <select
                    aria-label={t("Step action")}
                    className="input"
                    value={s.tool || ""}
                    onChange={(e) => setStep(i, { tool: e.target.value })}
                  >
                    <option value="">{t("Choose an action")}</option>
                    {tools.map((x) => (
                      <option key={x.name} value={x.name}>
                        {x.name}
                        {x.kind === "write"
                          ? " · " + t("Confirmation required")
                          : ""}
                      </option>
                    ))}
                  </select>
                  {Object.entries(
                    tools.find((x) => x.name === s.tool)?.input?.properties ||
                      {},
                  )
                    .filter(
                      ([k]) =>
                        !tools.find((x) => x.name === s.tool)?.bindings?.[k] ||
                        tools.find((x) => x.name === s.tool)?.bindings?.[k]
                          ?.source === "customer",
                    )
                    .map(([key]) => (
                      <TextInput
                        key={key}
                        id={`step-${i}-${key}`}
                        label={key}
                        value={
                          typeof s.args?.[key] === "string"
                            ? s.args[key]
                            : JSON.stringify(s.args?.[key] ?? "")
                        }
                        placeholder="{{args.order_id}}"
                        onChange={(e) => {
                          let v = e.target.value;
                          try {
                            v = JSON.parse(v);
                          } catch {}
                          setStep(i, { args: { ...s.args, [key]: v } });
                        }}
                      />
                    ))}
                </>
              )}
              {s.kind === "check" && (
                <>
                  <div className="grid-2">
                    <TextInput
                      id={`condition-${i}`}
                      label={t("Value to check")}
                      placeholder="steps.lookup.available"
                      value={s.condition?.path || ""}
                      onChange={(e) =>
                        setStep(i, {
                          condition: { ...s.condition, path: e.target.value },
                        })
                      }
                    />
                    <select
                      aria-label={t("Comparison")}
                      className="input"
                      value={s.condition?.op || "exists"}
                      onChange={(e) =>
                        setStep(i, {
                          condition: { ...s.condition, op: e.target.value },
                        })
                      }
                    >
                      {[
                        "exists",
                        "equals",
                        "not_equals",
                        "greater_than",
                        "less_than",
                      ].map((op) => (
                        <option key={op}>{op}</option>
                      ))}
                    </select>
                  </div>
                  {s.condition?.op !== "exists" && (
                    <TextInput
                      id={`condition-value-${i}`}
                      label={t("Compare with (JSON or text)")}
                      value={
                        s.condition?.value === undefined
                          ? ""
                          : typeof s.condition.value === "string"
                            ? s.condition.value
                            : JSON.stringify(s.condition.value)
                      }
                      onChange={(e) => {
                        let v = e.target.value;
                        try {
                          v = JSON.parse(v);
                        } catch {}
                        setStep(i, { condition: { ...s.condition, value: v } });
                      }}
                    />
                  )}
                  <TextInput
                    id={`condition-message-${i}`}
                    label={t("Message when the check fails")}
                    value={s.message || ""}
                    onChange={(e) => setStep(i, { message: e.target.value })}
                  />
                </>
              )}
            </div>
          ))}
          <Button
            disabled={p.steps.length >= 12}
            onClick={() =>
              update({
                steps: [
                  ...p.steps,
                  {
                    id: `step_${p.steps.length + 1}`,
                    kind: "action",
                    tool: tools[0]?.name || "",
                    args: {},
                  },
                ],
              })
            }
          >
            {t("Add step")}
          </Button>
          <p className="helper">
            {t(
              "Use {{args.name}} for procedure inputs and {{steps.step_name.field}} for an earlier result. Steps run from top to bottom.",
            )}
          </p>
          <details>
            <summary>{t("Advanced procedure JSON")}</summary>
            <JsonValue
              validate={(v) =>
                typeof v.name === "string" &&
                typeof v.description === "string" &&
                Array.isArray(v.steps) &&
                v.steps.every((s) => s && typeof s.id === "string") &&
                v.input?.type === "object"
              }
              value={p}
              onChange={(v) => {
                onChange(value.map((x, i) => (i === index ? v : x)));
                setResult(null);
              }}
            />
          </details>
          <details>
            <summary>{t("Simulate procedure")}</summary>
            <div className="stack">
              <Textarea
                id="procedure-args"
                label={t("Sample customer inputs (JSON)")}
                value={args}
                onChange={(e) => setArgs(e.target.value)}
              />
              <Textarea
                id="procedure-context"
                label={t("Sample account context (JSON)")}
                value={context}
                onChange={(e) => setContext(e.target.value)}
              />
              <Textarea
                id="procedure-mocks"
                label={t("Mock responses by step name (JSON)")}
                value={mocks}
                onChange={(e) => setMocks(e.target.value)}
                hint={t(
                  'Provide a raw system response for each action step. Use {"error":"unavailable"} to simulate a failure.',
                )}
              />
              <Button onClick={simulate}>{t("Run simulation")}</Button>
              {error && <Callout tone="bad">{error}</Callout>}
              {result && (
                <pre className="code">{JSON.stringify(result, null, 2)}</pre>
              )}
            </div>
          </details>
          <Button
            onClick={() => {
              onChange(value.filter((_, i) => i !== index));
              setIndex(-1);
            }}
          >
            {t("Remove procedure")}
          </Button>
        </div>
      )}
    </div>
  );
}
export function JsonValue({ value, onChange, label, validate }) {
  const [text, setText] = useState(JSON.stringify(value, null, 2)),
    [error, setError] = useState("");
  const serialized = JSON.stringify(value, null, 2);
  useEffect(() => {
    setText(serialized);
    setError("");
  }, [serialized]);
  function apply() {
    try {
      const v = JSON.parse(text);
      if (
        !v ||
        typeof v !== "object" ||
        Array.isArray(v) ||
        (validate && !validate(v))
      )
        throw new Error();
      onChange(v);
      setError("");
    } catch {
      setError(t("Enter a valid JSON object with the required fields."));
    }
  }
  return (
    <>
      <Textarea
        label={label || t("Configuration JSON")}
        value={text}
        rows={10}
        onChange={(e) => setText(e.target.value)}
      />
      <p className="helper">
        {t("Apply JSON changes before saving the configuration.")}
      </p>
      <Button onClick={apply}>{t("Apply JSON")}</Button>
      {error && (
        <p role="alert" className="helper">
          {error}
        </p>
      )}
    </>
  );
}
