import { useState, useEffect } from "react";
import { t } from "../i18n.js";
import { api } from "../api.js";
import { Button, TextInput, Textarea, Callout } from "../ui.jsx";

export function AIIntegrationPanel({ base, onImport }) {
  const [mode, setMode] = useState("url");
  const [source, setSource] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState(null);
  const [goal, setGoal] = useState("");
  const [accessMode, setAccessMode] = useState("auto");
  const [plan, setPlan] = useState(null);
  const [result, setResult] = useState(null);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [catalog, setCatalog] = useState(null);
  const [endpointIds, setEndpointIds] = useState([]);
  const [search, setSearch] = useState("");
  const [job, setJob] = useState(null);
  const jobKey = `replybek.ai-draft:${base}`;
  const working = busy || job?.status === "running";
  function receiveJob(data) {
    setJob(data);
    if (data.status !== "running") { setResult(data); setSelected((data.integration?.tools || []).map(tool => tool.name)); }
  }
  useEffect(() => {
    try { const id = localStorage.getItem(jobKey); if (id) setJob({ id, status: "running", completed: 0, total: 0 }); } catch {}
  }, [jobKey]);
  useEffect(() => {
    if (!job?.id || job.status !== "running") return;
    let active = true, timer;
    async function poll() {
      try { const data = await api(`${base}/integrations/ai-jobs/${job.id}`); if (!active) return; receiveJob(data); if (data.status === "running") timer = setTimeout(poll, 1500); }
      catch(e) { if(active) { setError(e.message); timer = setTimeout(poll, 5000); if(e.status === 404) { clearTimeout(timer); setJob(null); try {localStorage.removeItem(jobKey);} catch {} } } }
    }
    poll(); return () => {active = false; clearTimeout(timer);};
  }, [base, job?.id, job?.status]);
  async function jobAction(action) { setBusy(true); try { receiveJob(await api(`${base}/integrations/ai-jobs/${job.id}/${action}`, {method:"POST",body:{}})); setError(""); } catch(e) {setError(e.message);} finally {setBusy(false);} }
  function change(setter, value) {
    setJob(null); try {localStorage.removeItem(jobKey);} catch {}
    setter(value);
    setResult(null);
    setError("");
    setCatalog(null);
    setPlan(null);
    setEndpointIds([]);
    setSearch("");
  }
  async function generate(ids = []) {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const form = new FormData();
      form.append("goal", goal);
      form.append("access_mode", ids.length && plan?.access_mode !== "unknown" ? plan?.access_mode || accessMode : accessMode);
      if (ids.length) form.append("endpoint_ids", JSON.stringify(ids));
      if (mode === "file") form.append("file", file);
      else form.append(mode === "url" ? "url" : "source", mode === "url" ? url : source);
      const data = await api(`${base}/integrations/${ids.length ? "ai-jobs" : "ai-draft"}`, { method: "POST", form });
      if (ids.length) { receiveJob(data); try {localStorage.setItem(jobKey, data.id);} catch {} return; }
      if (data.requires_selection) {
        setCatalog(data.catalog);
        setEndpointIds(data.plan?.endpoint_ids || []);
        setPlan(data.plan);
        setSearch("");
      } else setResult(data);
      setSelected((data.integration?.tools || []).map((tool) => tool.name));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="stack ai-integration">
      <p className="helper">{t("Give AI your API documentation. It will prepare the connection and actions for you to review.")}</p>
      <fieldset disabled={working} className="ai-doc-fields stack">
        <div className="chips" role="group" aria-label={t("Documentation source")}>
          {[
            ["url", "Documentation URL"],
            ["text", "Paste documentation"],
            ["file", "Upload documentation"],
          ].map(([value, label]) => (
            <button type="button" className="chip" aria-pressed={mode === value} key={value} onClick={() => change(setMode, value)}>
              {t(label)}
            </button>
          ))}
        </div>
        {mode === "url" && (
          <TextInput
            id="ai-doc-url"
            label={t("Documentation URL")}
            value={url}
            onChange={(e) => change(setUrl, e.target.value)}
            placeholder="https://example.com/api/docs"
            hint={t("Supports Postman, OpenAPI, Swagger, ReDoc and linked documentation pages. Coverage is shown before you generate.")}
          />
        )}
        {mode === "text" && (
          <Textarea
            id="ai-doc-text"
            label={t("API documentation")}
            value={source}
            onChange={(e) => change(setSource, e.target.value)}
            rows={7}
            maxLength={60000}
            hint={t("Include authentication, endpoint paths, inputs and example responses.")}
          />
        )}
        {mode === "file" && (
          <label className="stack-xs">
            <span className="field-label">{t("Documentation file")}</span>
            <input
              type="file"
              accept=".pdf,.docx,.txt,.md,.csv,.json,.yaml,.yml"
              onChange={(e) => {
                const next = e.target.files?.[0] || null;
                change(setFile, next);
                if (next?.size > 2 * 1024 * 1024) {
                  setFile(null);
                  setError(t("Choose documentation smaller than 2 MB."));
                }
              }}
            />
            <span className="helper">{t("PDF, Word, text, Markdown or OpenAPI · up to 2 MB and 60,000 characters")}</span>
          </label>
        )}
        <Textarea
          id="ai-doc-goal"
          label={t("What should your agent be able to do?")}
          hint={t("Describe the tasks, who will use them, and how your app provides access. Describe the mechanism, never paste credentials.")}
          placeholder={t("Let signed-in customers view their orders and request returns. Our frontend will provide the current user’s token.")}
          value={goal}
          onChange={(e) => {
            change(setGoal, e.target.value);
          }}
          rows={2}
          maxLength={1500}
        />
        <label className="stack-xs" htmlFor="ai-access-mode">
          <span className="field-label">{t("How will your app provide access?")}</span>
          <select id="ai-access-mode" className="input" value={accessMode} onChange={e => change(setAccessMode, e.target.value)}>
            <option value="auto">{t("Let AI propose a connection")}</option>
            <option value="server">{t("Server: OAuth or business API key")}</option>
            <option value="browser_session">{t("Browser: existing session cookies")}</option>
            <option value="frontend_token">{t("Frontend: current user’s token")}</option>
          </select>
        </label>
        <p className="helper">
          {t("Documentation is sent to the AI provider. Remove passwords, API keys and customer data first. Add credentials securely in Connection afterward.")}
        </p>
        <Button
          variant="primary"
          loading={busy}
          disabled={mode === "file" ? !file : mode === "url" ? !url.trim() : source.trim().length < 40}
          onClick={() => generate()}
        >
          {t("Prepare integration plan")}
        </Button>
      </fieldset>
      {busy && (
        <p className="helper" role="status">
          {t("Reading documentation and preparing actions…")}
        </p>
      )}
      {error && <Callout tone="bad">{error}</Callout>}
      {catalog && (
        <fieldset className="ai-doc-fields stack ib-input" disabled={working} aria-label={t("Discovered endpoints")}>
          <strong>{catalog.name}</strong>
          {plan ? <div className="ai-plan stack-xs">
            <strong>{t("Proposed setup")}</strong>
            <p>{plan.summary}</p>
            <p className="helper">{t("{selected} actions proposed from {total} documented endpoints.", {selected:endpointIds.length,total:catalog.count})}</p>
            <p className="helper">{t("Connection")}: {plan.access_mode === "server" ? t("Server: OAuth or business API key") : plan.access_mode === "browser_session" ? t("Browser: existing session cookies") : plan.access_mode === "frontend_token" ? t("Frontend: current user’s token") : t("Needs clarification")}</p>
            {!!plan.requirements.length && <ul>{plan.requirements.map((item,i)=><li key={i}>{item}</li>)}</ul>}
            {!!plan.questions.length && <Callout>{plan.questions.map((item,i)=><p key={i}>{item}</p>)}<p>{t("Update your description or access choice above, then prepare the plan again.")}</p></Callout>}
          </div> : <p className="helper">{t("Describe your goal above for AI to propose actions, or choose them manually.")}</p>}
          <details open={!plan} className="ai-endpoint-review"><summary>{t("Review documented endpoints")} · {endpointIds.length}/{catalog.count}</summary>
          <TextInput id="ai-endpoint-search" label={t("Search endpoints")} value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="row" style={{flexWrap:"wrap"}}>
            <Button size="sm" onClick={() => {setEndpointIds(catalog.endpoints.filter(e=>e.supported).map(e=>e.id));setResult(null);}}>{t("Select all")}</Button>
            <Button size="sm" variant="ghost" onClick={() => {setEndpointIds(ids=>[...new Set([...ids,...catalog.endpoints.filter(e=>e.supported && `${e.name} ${e.group} ${e.method} ${e.path}`.toLowerCase().includes(search.toLowerCase())).map(e=>e.id)])]);setResult(null);}}>{t("Select matching")}</Button>
          </div>
          {catalog.coverage && <div className="helper">{t("Read {count} documentation pages or definitions.",{count:catalog.coverage.read})}
            {catalog.coverage.limited && <Callout tone="warn">{t("Discovery reached its limit. Some documentation may be missing.")}</Callout>}
            {!!catalog.coverage.failed?.length && <details><summary>{t("{count} pages could not be read",{count:catalog.coverage.failed.length})}</summary>{catalog.coverage.failed.map(u=><p key={u}>{u}</p>)}</details>}
            {!!catalog.coverage.unresolved_refs?.length && <Callout tone="warn">{t("Some external or recursive schemas require manual review.")}</Callout>}
          </div>}
          <div className="ai-endpoint-list">
            {catalog.endpoints
              .filter((e) => `${e.name} ${e.group} ${e.method} ${e.path}`.toLowerCase().includes(search.toLowerCase()))
              .map((endpoint) => (
                <label className="row ai-draft-action" key={endpoint.id}>
                  <input
                    type="checkbox"
                    checked={endpointIds.includes(endpoint.id)}
                    disabled={!endpoint.supported}
                    onChange={(e) => {
                      setEndpointIds((ids) => (e.target.checked ? [...ids, endpoint.id] : ids.filter((id) => id !== endpoint.id)));
                      setResult(null);
                    }}
                  />
                  <span>
                    <strong>{endpoint.name}</strong>
                    <span className="helper" style={{ display: "block" }}>
                      {endpoint.method} {endpoint.path}
                    </span>
                    <span className="helper">
                      {endpoint.group}
                      {!endpoint.supported && ` · ${t("Requires manual configuration")}`}
                    </span>
                  </span>
                </label>
              ))}
          </div>
          <div className="row" style={{ flexWrap: "wrap" }}>
            <span className="helper">{t("{count} selected", { count: endpointIds.length })}</span>
            <Button
              size="sm"
              variant="ghost"
              disabled={!endpointIds.length}
              onClick={() => {
                setEndpointIds([]);
                setResult(null);
              }}
            >
              {t("Clear selection")}
            </Button>
          </div>
          </details>
          <Button variant="primary" loading={busy} disabled={!endpointIds.length || plan?.access_mode === "unknown" || !!plan?.questions.length} onClick={() => generate(endpointIds)}>
            {t("Generate selected actions")}
          </Button>
        </fieldset>
      )}
      {job && <div className="ib-input stack-xs" role="status">
        <strong>{job.status === "running" ? t("Generating your integration") : job.status === "cancelled" ? t("Generation cancelled") : t("Generation finished")}</strong>
        <span className="helper">{t("{done} of {total} endpoints processed", {done:job.completed || 0,total:job.total || 0})} · {t("{count} actions generated", {count:job.generated || 0})}</span>
        <progress value={job.completed || 0} max={job.total || 1} style={{width:"100%"}} />
        {job.status === "running" && <><p className="helper">{t("You can close this window. Progress is saved and resumes when you return.")}</p><Button size="sm" disabled={busy} onClick={()=>jobAction("cancel")}>{t("Cancel generation")}</Button></>}
        {!!job.failed?.length && <><details><summary>{t("{count} endpoints need attention",{count:job.failed.length})}</summary>{job.failed.map(e=><p key={e.id}><strong>{e.name}</strong><br/>{e.error}</p>)}</details>{job.status !== "running" && <Button size="sm" loading={busy} onClick={()=>jobAction("retry")}>{t("Retry failed endpoints")}</Button>}</>}
        {job.status === "cancelled" && <Button size="sm" loading={busy} onClick={()=>jobAction("retry")}>{t("Resume generation")}</Button>}
      </div>}
      {result && (
        <div className="stack ib-input" aria-label={t("AI integration draft")}>
          <div>
            <strong>{result.integration?.name || t("More documentation needed")}</strong>
            {result.integration?.base_url && <p className="helper">{result.integration.base_url}</p>}
            <p className="helper">
              {t("Source")}: {result.source}
            </p>
            {result.discovered_count != null && (
              <p className="helper">
                {t("Draft based on {selected} of {total} discovered endpoints.", { selected: result.selected_count, total: result.discovered_count })}
              </p>
            )}
          </div>
          {result.missing?.length > 0 && (
            <div>
              <strong>{t("To finish setup")}</strong>
              <ul>
                {result.missing.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {result.warnings?.length > 0 && (
            <Callout>
              {result.warnings.map((item, i) => (
                <p key={i}>{item}</p>
              ))}
            </Callout>
          )}
          {result.integration?.tools.map((tool) => (
            <div className="ai-draft-action" key={tool.name}>
              <label className="row">
                <input
                  type="checkbox"
                  checked={selected.includes(tool.name)}
                  onChange={(e) => setSelected((items) => (e.target.checked ? [...items, tool.name] : items.filter((n) => n !== tool.name)))}
                />
                <span>
                  <strong>{tool.description || tool.name}</strong>
                  <span className="helper" style={{ display: "block" }}>
                    <code>{tool.name}</code> · {tool.request.method} {tool.request.path}
                  </span>
                  <span className={"badge " + (tool.kind === "write" ? "amber" : "")}>
                    {tool.kind === "write" ? t("Confirmation required") : t("Read action")}
                  </span>
                </span>
              </label>
              {result.evidence?.find((e) => e.name === tool.name) && (
                <details>
                  <summary>{t("Documentation evidence")}</summary>
                  <blockquote>{result.evidence.find((e) => e.name === tool.name).quote}</blockquote>
                </details>
              )}
            </div>
          ))}
          {result.integration && (
            <>
              <p className="helper">{t("Nothing has been connected or executed. Review credentials and actions, then run a test before enabling.")}</p>
              <Button
                variant="primary"
                disabled={!selected.length}
                onClick={() => { try {localStorage.removeItem(jobKey);} catch {} onImport({ ...result.integration, tools: result.integration.tools.filter((tool) => selected.includes(tool.name)) }); }}
              >
                {t("Review connection and actions")}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
