import { useState } from "react";
import { t } from "../i18n.js";
import { Icon } from "../icons.jsx";
import {
  Dialog,
  TextInput,
  Textarea,
  Field,
  SegmentedControl,
  Button,
  IconButton,
} from "../ui.jsx";

import { ActionTest, ResponseEditor } from "./integration-panels.jsx";
// A collapsible builder section (Chatbase-style: a step circle + title + chevron).
export function Collapsible({
  step,
  title,
  desc,
  done,
  open,
  onToggle,
  children,
}) {
  return (
    <section className={"build-sec" + (open ? " open" : "")}>
      <button
        type="button"
        className="build-sec-head"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className={"build-step" + (done ? " done" : "")}>
          {done ? <Icon name="check" size={12} strokeWidth={3} /> : step}
        </span>
        <span className="build-sec-title">
          {title}
          {desc && <span className="build-sec-desc">{desc}</span>}
        </span>
        <Icon
          name={open ? "chevronUp" : "chevronDown"}
          size={16}
          className="muted"
        />
      </button>
      {open && <div className="build-sec-body">{children}</div>}
    </section>
  );
}

// ───── Structured tools editor (Chatbase-style per-action form) ─────
const INPUT_TYPES = {
  Text: "string",
  Number: "number",
  Boolean: "boolean",
  List: "array",
  Object: "object",
};
const toJsonType = (label) => INPUT_TYPES[label] || "string";
const fromJsonType = (jt) =>
  Object.keys(INPUT_TYPES).find((k) => INPUT_TYPES[k] === jt) || "Text";

export function ToolsSection({
  base,
  integrationId,
  baseUrl,
  mode,
  authType,
  isNew,
  config,
  onChange,
  error,
}) {
  let parsed = {};
  let ok = true;
  try {
    parsed = JSON.parse(config) || {};
    if (
      typeof parsed !== "object" ||
      Array.isArray(parsed) ||
      (parsed.tools &&
        (!Array.isArray(parsed.tools) ||
          parsed.tools.some((t) => !t || typeof t !== "object")))
    )
      ok = false;
  } catch {
    ok = false;
  }
  const tools = Array.isArray(parsed.tools) ? parsed.tools : [];
  const [raw, setRaw] = useState(!ok);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null); // index | "new" | null
  const saveTool = (tool, index) => {
    const next =
      index === "new"
        ? [...tools, tool]
        : tools.map((x, i) => (i === index ? tool : x));
    onChange(JSON.stringify({ ...parsed, tools: next }, null, 2));
    setEditing(null);
  };
  const remove = (index) =>
    onChange(
      JSON.stringify(
        { ...parsed, tools: tools.filter((_, i) => i !== index) },
        null,
        2,
      ),
    );

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
          hint={t(
            "headers, context (values read after sign-in), account (the signed-in name) and tools. Each tool has a name, description, kind (read or write), input, request and response.",
          )}
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
        <span className="field-hint">
          {t(
            "What the agent can do in the system. Look-ups run on their own; changes ask the user to confirm.",
          )}
        </span>
        <button type="button" className="link" onClick={() => setRaw(true)}>
          {t("Edit as JSON")}
        </button>
      </div>
      <div className="action-list-head">
        <h3>
          {t("Actions")} <span className="badge">{tools.length}</span>
        </h3>
        <Button
          size="sm"
          variant="primary"
          icon="plus"
          onClick={() => setEditing("new")}
        >
          {t("Add action")}
        </Button>
      </div>
      {tools.length > 0 && (
        <TextInput
          id="action-search"
          label={t("Search actions")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("Search by name or description")}
        />
      )}
      {!tools.length && (
        <div className="action-empty">
          <Icon name="code" size={26} />
          <strong>{t("Give your agent something to do")}</strong>
          <p>
            {t(
              "Add an action to look up information or make a confirmed change in your system.",
            )}
          </p>
        </div>
      )}
      {tools.map(
        (tool, i) =>
          (!search ||
            `${tool.name} ${tool.description}`
              .toLowerCase()
              .includes(search.toLowerCase())) && (
            <div className="tool-card" key={i}>
              <span className="tool-icon">
                <Icon
                  name={tool.kind === "write" ? "checkCircle" : "code"}
                  size={18}
                />
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="row" style={{ gap: 8 }}>
                  <span className="cell-title truncate mono">{tool.name}</span>
                  <span
                    className={
                      "badge " + (tool.kind === "write" ? "amber" : "")
                    }
                  >
                    {tool.kind === "write" ? t("change") : t("lookup")}
                  </span>
                </div>
                {(tool.when || tool.description) && (
                  <div className="helper truncate">
                    {tool.when || tool.description}
                  </div>
                )}
              </div>
              <Button size="sm" variant="ghost" onClick={() => setEditing(i)}>
                {t("Edit")}
              </Button>
              <IconButton
                icon="trash"
                size="sm"
                label={t("Remove {name}", { name: tool.name })}
                onClick={() => remove(i)}
              />
            </div>
          ),
      )}
      {editing !== null && (
        <ToolEditor
          base={base}
          integrationId={integrationId}
          baseUrl={baseUrl}
          isNew={isNew}
          mode={mode}
          authType={authType}
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

const blankTool = () => ({
  original: {},
  name: "",
  when: "",
  description: "",
  kind: "read",
  inputs: [],
  method: "POST",
  path: "",
  headers: [],
  body: "",
  advanced: JSON.stringify({ response: { type: "json" } }, null, 2),
});
function fromTool(tool) {
  const props = tool.input?.properties || {};
  const required = tool.input?.required || [];
  return {
    original: tool,
    name: tool.name || "",
    when: tool.when || "",
    description: tool.description || "",
    kind: tool.kind || "read",
    inputs: Object.entries(props).map(([name, def]) => ({
      name,
      type: fromJsonType(def?.type),
      description: def?.description || "",
      required: required.includes(name),
      source: tool.bindings?.[name]?.source || "customer",
      path: tool.bindings?.[name]?.path || "",
      value:
        tool.bindings?.[name]?.value === undefined
          ? ""
          : JSON.stringify(tool.bindings[name].value),
      definition: def,
    })),
    method: tool.request?.method || "POST",
    path: tool.request?.path || "",
    headers: Object.entries(tool.request?.headers || {}).map(([k, v]) => ({
      k,
      v: String(v),
    })),
    body:
      tool.request?.body !== undefined
        ? JSON.stringify(tool.request.body, null, 2)
        : "",
    advanced: JSON.stringify(
      {
        response: tool.response || { type: "json" },
        ...(tool.confirm ? { confirm: tool.confirm } : {}),
      },
      null,
      2,
    ),
  };
}
function toTool(f) {
  const properties = {};
  const required = [];
  const bindings = {};
  for (const inp of f.inputs) {
    if (!inp.name.trim()) continue;
    properties[inp.name.trim()] = {
      ...inp.definition,
      type: toJsonType(inp.type),
      ...(inp.description.trim()
        ? { description: inp.description.trim() }
        : {}),
    };
    if (inp.required) required.push(inp.name.trim());
    if (inp.source && inp.source !== "customer") {
      let value = inp.value;
      if (inp.source === "fixed") {
        try {
          value = JSON.parse(inp.value);
        } catch {
          /* plain text */
        }
      }
      bindings[inp.name.trim()] = {
        source: inp.source,
        ...(inp.source === "fixed" ? { value } : { path: inp.path }),
      };
    }
  }
  const headers = {};
  for (const h of f.headers) if (h.k.trim()) headers[h.k.trim()] = h.v;
  const adv = JSON.parse(f.advanced || "{}");
  const request = {
    ...f.original?.request,
    method: f.method,
    path: f.path.trim(),
    headers,
    body: f.body.trim() ? JSON.parse(f.body) : undefined,
  };
  return {
    ...f.original,
    bindings,
    name: f.name.trim(),
    ...(f.when.trim() ? { when: f.when.trim() } : {}),
    description: f.description.trim() || f.name.trim(),
    kind: f.kind,
    input: { ...f.original?.input, type: "object", properties, required },
    request,
    ...(adv.response ? { response: adv.response } : {}),
    ...(adv.confirm ? { confirm: adv.confirm } : {}),
  };
}

function ToolEditor({
  tool,
  headers,
  existing,
  onClose,
  onSave,
  base,
  integrationId,
  baseUrl,
  mode,
  authType,
  isNew,
}) {
  const [f, setF] = useState(() => (tool ? fromTool(tool) : blankTool()));
  const [open, setOpen] = useState("general");
  const [requestTab, setRequestTab] = useState("headers");
  const [errors, setErrors] = useState({});
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  function submit() {
    const e = {};
    if (!/^[a-z][a-z0-9_]{1,47}$/.test(f.name.trim()))
      e.name = t(
        "Use lowercase letters, digits and underscores (e.g. list_orders).",
      );
    else if (existing.includes(f.name.trim()))
      e.name = t("Another tool already has this name.");
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
      else if (e.path || e.body) {
        setOpen("api");
        if (e.body) setRequestTab("body");
      } else setOpen("advanced");
      return;
    }
    const names = f.inputs.map((x) => x.name.trim());
    if (
      names.some((n) => !/^[a-z][a-z0-9_]*$/i.test(n)) ||
      new Set(names).size !== names.length
    ) {
      setErrors({
        path: t(
          "Use unique input names with letters, numbers and underscores.",
        ),
      });
      setOpen("api");
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
  const sec = (k) => ({
    open: open === k,
    onToggle: () => setOpen(open === k ? "" : k),
  });

  return (
    <Dialog
      title={tool ? t("Edit action") : t("Add action")}
      description={t(
        "Describe one thing the agent can do, and the request it makes.",
      )}
      size="action-editor"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t("Cancel")}</Button>
          <Button variant="primary" onClick={submit}>
            {t("Save action")}
          </Button>
        </>
      }
    >
      <div className="action-layout">
        <div className="build">
          <Collapsible
            step={1}
            title={t("General")}
            desc={f.name || undefined}
            done={Boolean(f.name)}
            {...sec("general")}
          >
            <div className="stack" style={{ gap: 12 }}>
              <TextInput
                id="te-name"
                label={t("Action name")}
                hint={t("A lowercase id the agent uses, e.g. list_orders.")}
                value={f.name}
                onChange={set("name")}
                error={errors.name}
              />
              <Textarea
                id="te-when"
                label={t("When to use")}
                hint={t(
                  "Tell the agent when to call this — e.g. when the customer asks about their orders.",
                )}
                rows={2}
                value={f.when}
                onChange={set("when")}
              />
              <TextInput
                id="te-desc"
                label={t("Short description")}
                optional
                value={f.description}
                onChange={set("description")}
              />
              <Field id="te-kind" label={t("What it does")}>
                <SegmentedControl
                  label={t("What it does")}
                  value={f.kind}
                  onChange={(v) => setF({ ...f, kind: v })}
                  options={[
                    { value: "read", label: t("Look up (runs now)") },
                    {
                      value: "write",
                      label: t("Make a change (needs confirm)"),
                    },
                  ]}
                />
              </Field>
            </div>
          </Collapsible>

          <Collapsible
            step={2}
            title={t("API")}
            desc={f.path || undefined}
            done={Boolean(f.path)}
            {...sec("api")}
          >
            <div className="stack" style={{ gap: 14 }}>
              <div className="stack" style={{ gap: 6 }}>
                <span className="field-label">
                  {t("Inputs the agent collects")}
                </span>
                <span className="field-hint">
                  {t(
                    "Values the agent fills from the chat and puts in the request with {{args.name}}.",
                  )}
                </span>
                <InputsEditor
                  inputs={f.inputs}
                  onChange={(v) => setF({ ...f, inputs: v })}
                />
              </div>
              <div
                className="row-wrap"
                style={{ gap: 8, alignItems: "flex-end" }}
              >
                <Field id="te-method" label={t("Method")}>
                  <select
                    className="input"
                    value={f.method}
                    onChange={set("method")}
                    style={{ width: 110 }}
                  >
                    {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </Field>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <TextInput
                    id="te-path"
                    label={t("Endpoint path")}
                    placeholder="/api/orders/{{args.order_id | url}}"
                    value={f.path}
                    onChange={set("path")}
                    error={errors.path}
                  />
                </div>
              </div>
              <div
                className="action-request-tabs"
                role="tablist"
                aria-label={t("Request settings")}
              >
                {["headers", "body"].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={requestTab === tab}
                    onClick={() => setRequestTab(tab)}
                  >
                    {tab === "headers" ? t("Headers") : t("Body")}
                    <span>
                      {tab === "headers"
                        ? f.headers.length
                        : f.body.trim()
                          ? 1
                          : 0}
                    </span>
                  </button>
                ))}
              </div>
              {requestTab === "headers" ? (
                <div className="stack" style={{ gap: 6 }}>
                  <KVEditor
                    rows={f.headers}
                    onChange={(v) => setF({ ...f, headers: v })}
                    keyLabel={t("Header")}
                    valueLabel={t("Value")}
                    addLabel={t("Add header")}
                  />
                </div>
              ) : (
                <Textarea
                  id="te-body"
                  label={t("Request body (JSON)")}
                  optional
                  hint={t("Use {{args.name}} for inputs.")}
                  className="mono"
                  rows={6}
                  value={f.body}
                  onChange={set("body")}
                  error={errors.body}
                  spellCheck={false}
                />
              )}
            </div>
          </Collapsible>

          <Collapsible step={3} title={t("Test action")} {...sec("test")}>
            <ActionTest
              base={base}
              integrationId={integrationId}
              baseUrl={baseUrl}
              mode={mode}
              authType={authType}
              config={previewConfig}
            />
          </Collapsible>

          <Collapsible
            step={4}
            title={t("Response and confirmation")}
            {...sec("advanced")}
          >
            <ResponseEditor
              value={f.advanced}
              onChange={(v) => setF({ ...f, advanced: v })}
              kind={f.kind}
            />
            <details>
              <summary>{t("Advanced JSON")}</summary>
              <Textarea
                id="te-adv"
                label={t("Response shaping and confirm card (JSON)")}
                hint={t(
                  "response: how to read the answer (rows + columns, or a json pick). confirm (for changes): the card's title and lines.",
                )}
                className="mono"
                rows={8}
                value={f.advanced}
                onChange={set("advanced")}
                error={errors.advanced}
                spellCheck={false}
              />
            </details>
          </Collapsible>
        </div>
        <aside className="action-preview">
          <div className="row">
            <Icon name="eye" size={16} />
            <strong>{t("Action preview")}</strong>
            <span className="badge">{t("Draft")}</span>
          </div>
          <div className="action-preview-card">
            <span className="ib-system-icon">
              <Icon
                name={f.kind === "write" ? "checkCircle" : "search"}
                size={22}
              />
            </span>
            <h3>{f.name || t("Untitled action")}</h3>
            <p className="helper">
              {f.description ||
                t(
                  "Describe one thing the agent can do, and the request it makes.",
                )}
            </p>
            <div className="action-preview-rule">
              <span className="field-label">{t("When to use")}</span>
              <p>
                {f.when ||
                  t("Add instructions to help the agent choose this action.")}
              </p>
            </div>
            <div className="action-preview-rule">
              <span className="field-label">{t("Request")}</span>
              <span className="http-method">{f.method}</span>
              <code>
                {baseUrl}
                {f.path || "/…"}
              </code>
            </div>
            {f.inputs.length > 0 && (
              <div className="action-preview-rule">
                <span className="field-label">{t("Inputs")}</span>
                {f.inputs.map((input, i) => (
                  <div className="row" key={i}>
                    <code>{input.name || "…"}</code>
                    <span className="helper">
                      {input.source === "context"
                        ? t("Signed-in account")
                        : input.source === "fixed"
                          ? t("Fixed value")
                          : input.source === "step"
                            ? t("Previous procedure step")
                            : t("Ask the customer")}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="action-preview-rule helper">
              <Icon
                name={f.kind === "write" ? "checkCircle" : "play"}
                size={15}
              />
              {f.kind === "write"
                ? t("Confirmation required")
                : t("Read action")}
            </div>
          </div>
          <Button icon="flask" onClick={() => setOpen("test")}>
            {t("Test action")}
          </Button>
        </aside>
      </div>
    </Dialog>
  );
}

function InputsEditor({ inputs, onChange }) {
  const setRow = (i, patch) =>
    onChange(inputs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="stack">
      {inputs.map((row, i) => (
        <div className="ib-input" key={i}>
          <div className="row-wrap">
            <input
              aria-label={t("Input name")}
              className="input sm"
              placeholder="order_id"
              value={row.name}
              onChange={(e) => setRow(i, { name: e.target.value })}
            />
            <select
              aria-label={t("Input type")}
              className="input sm"
              value={row.type}
              onChange={(e) => setRow(i, { type: e.target.value })}
            >
              {Object.keys(INPUT_TYPES).map((tp) => (
                <option key={tp} value={tp}>{t(tp)}</option>
              ))}
            </select>
            <label className="row">
              <input
                type="checkbox"
                checked={row.required}
                onChange={(e) => setRow(i, { required: e.target.checked })}
              />
              {t("Required")}
            </label>
            <IconButton
              icon="x"
              label={t("Remove input")}
              onClick={() => onChange(inputs.filter((_, j) => j !== i))}
            />
          </div>
          <input
            aria-label={t("Input description")}
            className="input sm"
            placeholder={t("What should the customer provide?")}
            value={row.description}
            onChange={(e) => setRow(i, { description: e.target.value })}
          />
          <div className="grid-2">
            <select
              aria-label={t("Input source")}
              className="input sm"
              value={row.source || "customer"}
              onChange={(e) => setRow(i, { source: e.target.value })}
            >
              <option value="customer">{t("Ask the customer")}</option>
              <option value="context">{t("Signed-in account")}</option>
              <option value="fixed">{t("Fixed value")}</option>
              <option value="step">{t("Previous procedure step")}</option>
            </select>
            {row.source === "fixed" ? (
              <input
                aria-label={t("Fixed value")}
                className="input sm"
                value={row.value || ""}
                onChange={(e) => setRow(i, { value: e.target.value })}
                placeholder={t("Text or JSON value")}
              />
            ) : ["context", "step"].includes(row.source) ? (
              <input
                aria-label={t("Source field")}
                className="input sm"
                value={row.path || ""}
                onChange={(e) => setRow(i, { path: e.target.value })}
                placeholder={
                  row.source === "context" ? "account_id" : "lookup.id"
                }
              />
            ) : null}
          </div>
        </div>
      ))}
      <Button
        size="sm"
        icon="plus"
        onClick={() =>
          onChange([
            ...inputs,
            {
              name: "",
              type: "Text",
              description: "",
              required: true,
              source: "customer",
            },
          ])
        }
      >
        {t("Add data input")}
      </Button>
      <p className="helper">
        {t(
          "Account and fixed values are supplied by the server. The agent cannot override them. Step inputs are available only inside procedures.",
        )}
      </p>
    </div>
  );
}

function KVEditor({ rows, onChange, keyLabel, valueLabel, addLabel }) {
  const setRow = (i, patch) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="stack" style={{ gap: 6 }}>
      {rows.map((row, i) => (
        <div className="kv-row" key={i}>
          <input
            className="input sm mono"
            placeholder={keyLabel}
            value={row.k}
            onChange={(e) => setRow(i, { k: e.target.value })}
          />
          <input
            className="input sm mono"
            placeholder={valueLabel}
            value={row.v}
            onChange={(e) => setRow(i, { v: e.target.value })}
          />
          <IconButton
            icon="x"
            size="sm"
            label={t("Remove")}
            tooltip={false}
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
          />
        </div>
      ))}
      <div>
        <Button
          size="sm"
          variant="secondary"
          icon="plus"
          onClick={() => onChange([...rows, { k: "", v: "" }])}
        >
          {addLabel}
        </Button>
      </div>
    </div>
  );
}
