import { useEffect, useRef, useState } from "react";
import { t, tk } from "../i18n.js";
import { Icon } from "../icons.jsx";
import { api } from "../api.js";
import { useWorkspace } from "../workspace.jsx";
import { useResource, go } from "../hooks.js";
import {
  Dialog,
  Drawer,
  Confirm,
  TextInput,
  Textarea,
  Field,
  Select,
  SegmentedControl,
  StatusBadge,
  Button,
  IconButton,
  ActionMenu,
  PageHeader,
  Table,
  Callout,
  EmptyState,
  TYPE_META,
  typeLabel,
  timeAgo,
  dateLong,
  fmt,
  useToast,
  looksLikeUrl,
} from "../ui.jsx";
import { AgentSelect, Loading } from "./shared.jsx";

export const fileSize = (b) => (b > 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB");
const ACCEPT = /\.(pdf|docx|txt|md|csv)$/i;
const MAX = 20 * 1024 * 1024;

/** Picks files to upload (kept as File objects). Checks type and size before anything is sent. */
export function FilePicker({ files, onChange, compact, error }) {
  const input = useRef(null);
  const [over, setOver] = useState(false);
  const [problem, setProblem] = useState("");
  const add = (list) => {
    const names = new Set(files.map((f) => f.name));
    const picked = [...list];
    const bad = picked.filter((f) => !ACCEPT.test(f.name) || f.size > MAX);
    setProblem(
      bad.length
        ? t("{names}: use PDF, DOCX, TXT, MD or CSV up to 20 MB.", {
            names: bad.map((f) => f.name).join(", "),
          })
        : "",
    );
    onChange([...files, ...picked.filter((f) => !bad.includes(f) && !names.has(f.name))]);
  };
  const msg = problem || error;
  return (
    <div className="field">
      <div
        className={"dropzone" + (over ? " over" : "")}
        style={compact ? { padding: "18px 16px" } : undefined}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          add(e.dataTransfer.files);
        }}
      >
        <Icon name="upload" size={20} className="muted" />
        <div className="label">{t("Drop files here")}</div>
        <div className="helper">{t("PDF, DOCX, TXT, MD or CSV, up to 20 MB each")}</div>
        <Button size="sm" onClick={() => input.current.click()} style={{ marginTop: 4 }}>
          {t("Choose files")}
        </Button>
        <input
          ref={input}
          type="file"
          multiple
          accept=".pdf,.docx,.txt,.md,.csv"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            add(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {files.length > 0 && (
        <div className="file-list" aria-label={t("Selected files")}>
          {files.map((f) => (
            <div key={f.name}>
              <Icon name="file" size={15} className="muted" />
              <span className="truncate" style={{ flex: 1 }}>
                {f.name}
              </span>
              <span className="helper num">{fileSize(f.size)}</span>
              <IconButton icon="x" size="sm" label={`Remove ${f.name}`} tooltip={false} onClick={() => onChange(files.filter((x) => x !== f))} />
            </div>
          ))}
        </div>
      )}
      {msg && (
        <span className="field-error">
          <Icon name="alertCircle" size={13} />
          {msg}
        </span>
      )}
    </div>
  );
}

const INTERVALS = [
  {
    value: 0,
    label: tk("Off"),
    description: tk("Only when you re-sync by hand"),
  },
  { value: 1, label: tk("Daily") },
  { value: 7, label: tk("Weekly") },
  { value: 30, label: tk("Monthly") },
];
const sectionLabel = (p) => (p === "/" ? t("Top-level pages") : p);
/** The auto re-sync choices, translated. */
const intervals = () =>
  INTERVALS.map((i) => ({
    ...i,
    label: t(i.label),
    description: i.description && t(i.description),
  }));

/** Website step: check the site, then choose sections (from its sitemap), the whole site or one page. */
function WebsiteForm({ agentId, value, onChange, error, checkRef }) {
  const { base } = useWorkspace();
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState("");
  const { url, preview, mode, paths, interval } = value;
  const set = (patch) => onChange({ ...value, ...patch });

  async function check() {
    if (!looksLikeUrl(url)) return setCheckError(t("Enter a website address, like example.com/help."));
    setChecking(true);
    setCheckError("");
    try {
      const p = await api(`${base}/agents/${agentId}/sources/website/preview`, {
        method: "POST",
        body: { url: url.trim() },
      });
      const suggested = p.sections.length ? (p.suggested_paths.length ? p.suggested_paths : p.sections.map((s) => s.prefix)) : p.suggested_paths;
      set({ preview: p, mode: "site", paths: suggested });
    } catch (e) {
      setCheckError(e.message);
      set({ preview: null });
    } finally {
      setChecking(false);
    }
  }

  if (checkRef) checkRef.current = check;
  const selected = preview?.sitemap ? preview.sections.filter((s) => paths.includes(s.prefix)).reduce((n, s) => n + s.count, 0) : null;
  return (
    <div className="stack" style={{ gap: 14 }}>
      <Field id="ak-url" label={t("Website address")} hint={t("A help center or docs address. Replybek reads its sitemap to find every page.")} error={checkError || error}>
        <div className="row">
          <TextInput
            id="ak-url"
            icon="globe"
            placeholder="docs.example.com/uz/"
            value={url}
            aria-invalid={checkError || error ? true : undefined}
            onChange={(e) => set({ url: e.target.value, preview: null })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                check();
              }
            }}
          />
          <Button onClick={check} loading={checking} disabled={!url.trim()}>
            {t("Check site")}
          </Button>
        </div>
      </Field>
      {preview && (
        <div className="site-preview">
          <div className="row" style={{ gap: 8 }}>
            <Icon
              name={preview.sitemap ? "checkCircle" : "info"}
              size={15}
              style={{
                color: preview.sitemap ? "var(--green)" : "var(--fg-3)",
              }}
            />
            <span className="strong text-sm">
              {preview.sitemap
                ? t("Found {count} pages on {host}", {
                    count: preview.total,
                    host: preview.host,
                  })
                : t("No sitemap on {host}", { host: preview.host })}
            </span>
          </div>
          <SegmentedControl
            full
            label={t("What to import")}
            value={mode}
            onChange={(m) => set({ mode: m })}
            options={[
              {
                value: "site",
                label: preview.sitemap ? t("Sections of the site") : t("Follow links"),
              },
              { value: "page", label: t("Only this page") },
            ]}
          />
          {mode === "site" && preview.sitemap && (
            <fieldset className="sections">
              <legend className="sr-only">{t("Sections to import")}</legend>
              {preview.sections.map((s) => (
                <label className="check" key={s.prefix}>
                  <input
                    type="checkbox"
                    checked={paths.includes(s.prefix)}
                    onChange={(e) =>
                      set({
                        paths: e.target.checked ? [...paths, s.prefix] : paths.filter((p) => p !== s.prefix),
                      })
                    }
                  />
                  <span className="sections-row">
                    <span className="mono">{sectionLabel(s.prefix)}</span>
                    <span className="helper num">{t("{count} pages", { count: s.count })}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          )}
          {mode === "site" && !preview.sitemap && (
            <p className="helper">
              {paths.length
                ? t("Replybek will follow links from this page within {paths}, up to {limit} pages.", { paths: paths.join(", "), limit: fmt(preview.page_limit) })
                : t("Replybek will follow links from this page, up to {limit} pages.", { limit: fmt(preview.page_limit) })}
            </p>
          )}
          {mode === "site" && preview.sitemap && selected > preview.page_limit && (
            <Callout tone="warn">
              {t("Your plan imports up to {limit} pages per website. The first {limit} of {total} will be imported.", { limit: fmt(preview.page_limit), total: fmt(selected) })}
            </Callout>
          )}
          {preview.blocked_by_robots > 0 && (
            <p className="helper">{t("{count} pages are skipped because the site's robots.txt asks crawlers not to read them.", { count: preview.blocked_by_robots })}</p>
          )}
          {mode === "site" && (
            <Select
              id="ak-interval"
              label={t("Re-sync automatically")}
              hint={t("Picks up new and changed pages. Unchanged pages aren't processed again.")}
              value={interval}
              onChange={(v) => set({ interval: v })}
              options={intervals()}
              size="sm"
              width={180}
            />
          )}
        </div>
      )}
    </div>
  );
}

export function AddKnowledgeDialog({ onClose, tab: initialTab = "website", prefillQ = "", agentId: initialAgent, unansweredId, onDone }) {
  const { base, activeAgent, agents, reloadAgents } = useWorkspace();
  const toast = useToast();
  const [agentId, setAgentId] = useState(initialAgent || activeAgent?.id);
  const agent = agents.find((a) => a.id === agentId);
  const [tab, setTab] = useState(initialTab);
  const [site, setSite] = useState({
    url: "",
    preview: null,
    mode: "site",
    paths: [],
    interval: 7,
  });
  const [files, setFiles] = useState([]);
  const [q, setQ] = useState(prefillQ);
  const [a, setA] = useState("");
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const checkSite = useRef(null);

  const sitePages = site.preview?.sitemap && site.mode === "site" ? site.preview.sections.filter((s) => site.paths.includes(s.prefix)).reduce((n, s) => n + s.count, 0) : null;

  async function submit() {
    const e = {};
    if (tab === "website" && !site.preview) e.url = looksLikeUrl(site.url) ? t("Check the site first to choose what to import.") : t("Enter a website address, like example.com/help.");
    if (tab === "website" && site.preview?.sitemap && site.mode === "site" && !site.paths.length) e.url = t("Choose at least one section.");
    if (tab === "file" && !files.length) e.files = t("Choose at least one file.");
    if (tab === "qa" && !q.trim()) e.q = t("Add the question.");
    if (tab === "qa" && !a.trim()) e.a = t("Add the answer.");
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    const path = `${base}/agents/${agentId}/sources`;
    try {
      if (tab === "website") {
        const allSections = site.preview.sitemap && site.paths.length === site.preview.sections.length;
        await api(`${path}/website`, {
          method: "POST",
          body:
            site.mode === "page"
              ? { url: site.preview.url, mode: "page" }
              : {
                  url: site.preview.url,
                  mode: "site",
                  include_paths: allSections ? [] : site.paths,
                  sync_interval_days: site.interval,
                },
        });
      }
      if (tab === "qa")
        await api(`${path}/qa`, {
          method: "POST",
          body: {
            question: q.trim(),
            answer: a.trim(),
            ...(unansweredId ? { unanswered_id: unansweredId } : {}),
          },
        });
      if (tab === "file") {
        const failed = [];
        for (const file of files) {
          const form = new FormData();
          form.append("file", file);
          try {
            await api(`${path}/file`, { method: "POST", form });
          } catch (err) {
            failed.push(`${file.name}: ${err.message}`);
          }
        }
        if (failed.length === files.length) throw new Error(failed.join(" · "));
        if (failed.length)
          toast(
            t("{done} of {total} files added", {
              done: files.length - failed.length,
              total: files.length,
            }),
            { tone: "error", sub: failed.join(" · "), duration: 9000 },
          );
      }
    } catch (err) {
      setBusy(false);
      return setErrors({
        [tab === "website" ? "url" : tab === "file" ? "files" : "a"]: err.message,
      });
    }
    reloadAgents();
    onDone && onDone();
    onClose();
    toast(tab === "qa" ? t("Q&A saved") : tab === "website" ? (site.mode === "page" ? t("Page added") : t("Website import started")) : t("Files added"), {
      sub:
        tab === "website" && site.mode === "site"
          ? t("Progress shows in the Knowledge table. Large sites take a few minutes.")
          : t("{name} can use it once processing finishes.", {
              name: agent?.name || t("The agent"),
            }),
    });
  }

  const submitLabel =
    tab === "website"
      ? !site.preview
        ? t("Check site")
        : site.mode === "page"
          ? t("Add page")
          : sitePages != null
            ? `Import ${fmt(Math.min(sitePages, site.preview.page_limit))} pages`
            : t("Import website")
      : tab === "file"
        ? files.length > 1
          ? `Add ${files.length} files`
          : t("Add file")
        : t("Save Q&A");
  return (
    <Dialog
      title={t("Add knowledge")}
      description={t("Give an agent something to answer from.")}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t("Cancel")}</Button>
          <Button
            variant="primary"
            onClick={() => (tab === "website" && !site.preview ? checkSite.current?.() : submit())}
            loading={busy}
            disabled={!agentId || (tab === "website" && site.preview && site.mode === "site" && sitePages === 0)}
          >
            {submitLabel}
          </Button>
        </>
      }
    >
      <div className="field">
        <span className="field-label">{t("Add to")}</span>
        <AgentSelect value={agentId} onChange={setAgentId} prefix={null} width="100%" />
      </div>
      <div className="field">
        <span className="field-label">{t("Source type")}</span>
        <SegmentedControl
          full
          label={t("Source type")}
          value={tab}
          onChange={(v) => {
            setTab(v);
            setErrors({});
          }}
          options={[
            { value: "website", label: t("Website"), icon: "globe" },
            { value: "file", label: t("Files"), icon: "file" },
            { value: "qa", label: "Q&A", icon: "qa" },
          ]}
        />
      </div>
      {tab === "website" && <WebsiteForm agentId={agentId} value={site} onChange={setSite} error={errors.url} checkRef={checkSite} />}
      {tab === "file" && <FilePicker files={files} onChange={setFiles} error={errors.files} />}
      {tab === "qa" && (
        <>
          <TextInput
            id="ak-q"
            label={t("Question")}
            hint={t("Write it the way a customer would ask.")}
            placeholder={t("e.g. Do you offer gift wrapping?")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            error={errors.q}
            data-autofocus={!prefillQ || undefined}
          />
          <Textarea
            id="ak-a"
            label={t("Answer")}
            rows={4}
            placeholder={t("The answer the agent should give.")}
            value={a}
            onChange={(e) => setA(e.target.value)}
            error={errors.a}
            data-autofocus={prefillQ ? true : undefined}
          />
          {unansweredId && <Callout>{t("This question came from your unanswered list. Once saved, the agent can answer it.")}</Callout>}
        </>
      )}
    </Dialog>
  );
}

function Readiness({ s, onRetry, onResync, canEdit }) {
  if (s.status === "processing")
    return (
      <Callout tone="info" icon="loader">
        <strong>
          {s.progress
            ? t("Processing {done} of {total} pages.", {
                done: fmt(s.progress.done),
                total: fmt(s.progress.total),
              })
            : t("Processing.")}
        </strong>{" "}
        {t("Reading, splitting and indexing the content.")}
      </Callout>
    );
  if (s.status === "error")
    return (
      <Callout
        tone="bad"
        action={
          canEdit && (
            <Button size="sm" icon="refresh" onClick={onRetry}>
              {t("Retry")}
            </Button>
          )
        }
      >
        <strong>{t("This source can't be used for answers.")}</strong> {s.error}
      </Callout>
    );
  if (s.syncing)
    return (
      <Callout tone="info" icon="loader">
        <strong>
          {s.progress
            ? t("Re-syncing: {done} of {total} pages checked.", {
                done: fmt(s.progress.done),
                total: fmt(s.progress.total),
              })
            : t("Re-syncing.")}
        </strong>{" "}
        {t("The agent keeps answering from the current pages meanwhile.")}
      </Callout>
    );
  if (s.error)
    return (
      <Callout
        tone="warn"
        action={
          canEdit &&
          s.type === "website" && (
            <Button size="sm" icon="refresh" onClick={onResync}>
              {t("Re-sync")}
            </Button>
          )
        }
      >
        <strong>{t("Available for answers.")}</strong> {s.error}
      </Callout>
    );
  return (
    <Callout tone="ok">
      <strong>{t("This source is available for answers.")}</strong> {t("{count} passages the agent can quote.", { count: s.chunk_count })}
    </Callout>
  );
}

function PagesList({ sourceId }) {
  const { base } = useWorkspace();
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const pages = useResource(`${base}/sources/${sourceId}/pages`);
  const all = pages.data || [];
  const term = q.trim().toLowerCase();
  const rows = all.filter((p) => (filter === "all" || p.status === filter) && (!term || (p.url + " " + (p.title || "")).toLowerCase().includes(term)));
  const failed = all.filter((p) => p.status === "error").length;
  if (!pages.data) return <Loading />;
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="row-wrap" style={{ justifyContent: "space-between" }}>
        <span className="eyebrow">{t("Pages")}</span>
        <SegmentedControl
          label={t("Pages to show")}
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: t("All"), count: all.length },
            {
              value: "error",
              label: t("Failed"),
              count: failed,
              disabled: !failed,
            },
          ]}
        />
      </div>
      {all.length > 8 && <TextInput id="pg-search" aria-label={t("Search pages")} icon="search" size="sm" placeholder={t("Search pages")} value={q} onChange={(e) => setQ(e.target.value)} />}
      <div className="page-list">
        {rows.slice(0, 200).map((p) => (
          <div className="page-item" key={p.id}>
            <Icon
              name={p.status === "ready" ? "checkCircle" : "alertCircle"}
              size={14}
              style={{
                color: p.status === "ready" ? "var(--green)" : "var(--amber)",
                marginTop: 2,
              }}
            />
            <div style={{ minWidth: 0, flex: 1 }}>
              <a className="page-title truncate" href={p.url} target="_blank" rel="noopener noreferrer">
                {p.title || new URL(p.url).pathname}
              </a>
              <div className="helper truncate">
                {p.status === "ready" ? `${new URL(p.url).pathname} · ${t("{count} passages", { count: p.chunk_count })}` : `${new URL(p.url).pathname} · ${p.error}`}
              </div>
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <p className="helper" style={{ padding: 10 }}>
            {t("No pages match.")}
          </p>
        )}
      </div>
      {rows.length > 200 && (
        <p className="helper">
          {t("Showing 200 of {total}. Search to find a page.", {
            total: fmt(rows.length),
          })}
        </p>
      )}
    </div>
  );
}

const DISCOVERY = {
  sitemap: tk("From the site's sitemap"),
  links: tk("By following links"),
  page: tk("Single page"),
};

function SourceDrawer({ id, onClose, onRemove, onChanged }) {
  const { base, agents, isAdmin } = useWorkspace();
  const toast = useToast();
  const src = useResource(`${base}/sources/${id}`, {
    poll: 2000,
    pollWhile: (d) => d.status === "processing" || d.syncing,
  });
  const s = src.data;
  const act = async (path, body, msg) => {
    try {
      const updated = await api(`${base}/sources/${id}${path}`, {
        method: body ? "PATCH" : "POST",
        body,
      });
      src.setData((d) => ({ ...d, ...updated }));
      src.reload();
      onChanged();
      msg && toast(msg);
    } catch (e) {
      toast(e.message, { tone: "error" });
    }
  };
  const site = s?.type === "website" && s.mode === "site";
  return (
    <Drawer
      title={s?.name || t("Source")}
      description={s ? `${typeLabel(s.type)} · ${agents.find((a) => a.id === s.agent_id)?.name || ""}` : undefined}
      onClose={onClose}
      width={520}
      footer={
        <>
          {isAdmin && s && (
            <Button variant="danger-ghost" icon="trash" onClick={() => onRemove(s)} style={{ marginRight: "auto" }}>
              {t("Remove source")}
            </Button>
          )}
          {isAdmin && s?.type === "website" && s.status === "ready" && (
            <Button icon="refresh" onClick={() => act("/resync", null, "Re-sync started")} loading={s.syncing} disabled={s.syncing}>
              {s.syncing ? t("Syncing") : t("Re-sync now")}
            </Button>
          )}
          <Button onClick={onClose}>{t("Close")}</Button>
        </>
      }
    >
      {src.error ? (
        <Callout tone="bad">{src.error.message}</Callout>
      ) : !s ? (
        <Loading />
      ) : (
        <>
          <Readiness s={s} onRetry={() => act("/retry", null, "Processing again")} onResync={() => act("/resync", null, "Re-sync started")} canEdit={isAdmin} />
          <dl className="dl">
            <dt>{t("Status")}</dt>
            <dd>
              <StatusBadge status={s.status} label={s.status === "processing" && s.progress ? `Processing ${s.progress.done}/${s.progress.total}` : undefined} />
            </dd>
            {s.url && (
              <>
                <dt>{t("Address")}</dt>
                <dd className="mono">{s.url}</dd>
              </>
            )}
            {s.type === "website" && s.discovery && (
              <>
                <dt>{t("Found")}</dt>
                <dd>{t(DISCOVERY[s.discovery])}</dd>
              </>
            )}
            {site && (
              <>
                <dt>{t("Sections")}</dt>
                <dd className="mono">{s.include_paths?.length ? s.include_paths.join(", ") : t("Whole site")}</dd>
              </>
            )}
            {s.pages != null && (
              <>
                <dt>{t("Pages")}</dt>
                <dd>
                  {t("{n} ready", { n: fmt(s.pages) })}
                  {s.pages_failed ? ` · ${t("{count} failed", { count: s.pages_failed })}` : ""}
                  {s.pages_over_limit ? ` · ${t("{n} over plan limit", { n: fmt(s.pages_over_limit) })}` : ""}
                </dd>
              </>
            )}
            {s.bytes != null && (
              <>
                <dt>{t("Size")}</dt>
                <dd>{fileSize(s.bytes)}</dd>
              </>
            )}
            <dt>{s.last_synced_at ? t("Last synced") : t("Last updated")}</dt>
            <dd>{timeAgo(s.last_synced_at || s.updated_at)}</dd>
          </dl>
          {site && isAdmin && (
            <Select
              id="src-interval"
              label={t("Re-sync automatically")}
              hint={s.next_sync_at ? t("Next sync {date}.", { date: dateLong(s.next_sync_at) }) : t("Re-sync by hand when the site changes.")}
              value={s.sync_interval_days}
              onChange={(v) => act("", { sync_interval_days: v }, v ? t("Auto re-sync updated") : t("Auto re-sync turned off"))}
              options={intervals()}
              size="sm"
              width={180}
            />
          )}
          {s.type === "website" && s.status !== "processing" ? (
            <PagesList sourceId={s.id} key={`${s.id}:${s.last_synced_at}`} />
          ) : s.qa ? (
            <div className="stack">
              <div className="eyebrow">Q&A</div>
              {s.qa.map((p, i) => (
                <div className="passage" key={i}>
                  <div className="p-head">{p.q}</div>
                  <div className="p-text">{p.a}</div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {s.preview && (
                <div className="stack-xs">
                  <div className="eyebrow">{t("Text preview")}</div>
                  <div className="preview-text">{s.preview}</div>
                </div>
              )}
              {s.passages?.length > 0 && (
                <div className="stack">
                  <div className="eyebrow">{t("First passages the agent can quote")}</div>
                  {s.passages.map((p, i) => (
                    <div className="passage" key={i}>
                      {p.heading && <div className="p-head">{p.heading}</div>}
                      <div className="p-text">{p.content.length > 400 ? p.content.slice(0, 397) + "…" : p.content}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </Drawer>
  );
}

const sizeOf = (s) => (s.type === "qa" ? `${(s.qa || []).length} ${t("Q&A")}` : s.pages ? t("{count} pages", { count: s.pages }) : s.bytes ? fileSize(s.bytes) : "—");

export function Knowledge({ id }) {
  const { base, activeAgent, agentsLoaded, openDialog, isAdmin, reloadAgents } = useWorkspace();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [removing, setRemoving] = useState(null);
  const list = useResource(activeAgent ? `${base}/agents/${activeAgent.id}/sources` : null, {
    poll: 2000,
    pollWhile: (d) => d.some((s) => s.status === "processing" || s.syncing),
  });
  const all = list.data || [];
  // A source opened by link (e.g. "Review" on the Overview) may belong to another agent.
  useEffect(() => {
    if (id) api(`${base}/sources/${id}`).catch(() => go("knowledge"));
  }, [id]);
  const q = query.trim().toLowerCase();
  const rows = all.filter((s) => (type === "all" || s.type === type) && (s.name + " " + (s.url || "")).toLowerCase().includes(q));
  const ready = all.filter((s) => s.status === "ready").length;
  const issues = all.filter((s) => s.status === "error");
  const processing = all.filter((s) => s.status === "processing").length;
  const counts = {
    all: all.length,
    website: all.filter((s) => s.type === "website").length,
    file: all.filter((s) => s.type === "file").length,
    qa: all.filter((s) => s.type === "qa").length,
  };
  const refresh = () => {
    list.reload();
    reloadAgents();
  };
  const retry = async (s) => {
    try {
      await api(`${base}/sources/${s.id}/retry`, { method: "POST" });
      refresh();
      toast(t("Processing again"));
    } catch (e) {
      toast(e.message, { tone: "error" });
    }
  };
  const add = () => openDialog("addKnowledge", { agentId: activeAgent.id, onDone: refresh });

  const columns = [
    {
      key: "name",
      header: t("Source"),
      maxWidth: 360,
      render: (s) => (
        <div className="cell-main">
          <span className="type-icon">
            <Icon name={TYPE_META[s.type].icon} size={15} />
          </span>
          <div className="cell-text">
            <button type="button" className="plain-btn cell-title truncate" style={{ display: "block", maxWidth: "100%" }} onClick={() => go("knowledge", s.id)}>
              {s.name}
            </button>
            {s.url && <div className="cell-sub truncate">{s.url.replace(/^https?:\/\//, "")}</div>}
          </div>
        </div>
      ),
    },
    {
      key: "type",
      header: t("Type"),
      hideSm: true,
      shrink: true,
      render: (s) => <span className="sec">{typeLabel(s.type)}</span>,
    },
    {
      key: "status",
      header: t("Readiness"),
      shrink: true,
      render: (s) =>
        s.status === "processing" && s.progress ? (
          <StatusBadge status="processing" label={`Processing ${fmt(s.progress.done)}/${fmt(s.progress.total)}`} />
        ) : s.syncing ? (
          <StatusBadge status="processing" label={t("Syncing")} />
        ) : s.status === "ready" && s.pages_failed ? (
          <StatusBadge status="ready" label={`${t("Ready")} · ${t("{count} failed", { count: s.pages_failed })}`} />
        ) : (
          <StatusBadge status={s.status} />
        ),
    },
    {
      key: "updated",
      header: t("Updated"),
      hideSm: true,
      shrink: true,
      render: (s) => <span className="num sec">{timeAgo(s.last_synced_at || s.updated_at)}</span>,
    },
    {
      key: "size",
      header: t("Size"),
      hideSm: true,
      shrink: true,
      align: "right",
      render: (s) => <span className="num sec">{sizeOf(s)}</span>,
    },
    {
      key: "actions",
      header: t("Actions"),
      srHeader: true,
      shrink: true,
      render: (s) => (
        <ActionMenu
          label={t("Actions for {name}", { name: s.name })}
          items={[
            {
              label: t("View details"),
              icon: "eye",
              onSelect: () => go("knowledge", s.id),
            },
            ...(isAdmin && s.status === "error"
              ? [
                  {
                    label: t("Retry"),
                    icon: "refresh",
                    onSelect: () => retry(s),
                  },
                ]
              : []),
            ...(isAdmin
              ? [
                  { separator: true },
                  {
                    label: t("Remove source"),
                    icon: "trash",
                    danger: true,
                    onSelect: () => setRemoving(s),
                  },
                ]
              : []),
          ]}
          trigger={(p) => <IconButton icon="more" size="sm" label={t("Actions for {name}", { name: s.name })} {...p} />}
        />
      ),
    },
  ];

  if (agentsLoaded && !activeAgent) {
    return (
      <>
        <PageHeader title={t("Knowledge")} description={t("What your agents use to answer")} />
        <div className="page-body">
          <div className="page-inner">
            <div className="box">
              <EmptyState
                icon="bot"
                title={t("Create an agent first")}
                action={
                  <Button variant="primary" size="sm" onClick={() => openDialog("createAgent")}>
                    {t("Create agent")}
                  </Button>
                }
              >
                {t("Knowledge belongs to an agent.")}
              </EmptyState>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={t("Knowledge")}
        description={activeAgent ? t("What {name} uses to answer", { name: activeAgent.name }) : " "}
        actions={
          <>
            {isAdmin && (
              <Button variant="primary" icon="plus" onClick={add} disabled={!activeAgent}>
                {t("Add knowledge")}
              </Button>
            )}
          </>
        }
      />
      <div className="page-body">
        <div className="page-inner" style={{ gap: 16 }}>
          {isAdmin && (
            <div className="source-shortcuts">
              {[
                ["website", "globe", t("Website"), t("Import pages from your help center.")],
                ["file", "file", t("Files"), t("Upload documents your team already uses.")],
                ["qa", "qa", t("Q&A"), t("Add an answer in your own words.")],
              ].map(([tab, icon, title, description]) => (
                <button
                  type="button"
                  key={tab}
                  onClick={() =>
                    openDialog("addKnowledge", {
                      tab,
                      agentId: activeAgent?.id,
                      onDone: refresh,
                    })
                  }
                >
                  <span className="source-shortcut-icon">
                    <Icon name={icon} size={20} />
                  </span>
                  <span>
                    <strong>{title}</strong>
                    <small>{description}</small>
                  </span>
                  <Icon name="plus" size={15} />
                </button>
              ))}
            </div>
          )}
          {issues.length > 0 && (
            <Callout
              tone="warn"
              action={
                <Button size="sm" onClick={() => go("knowledge", issues[0].id)}>
                  {t("Review")}
                </Button>
              }
            >
              <strong>
                {issues.length} source{issues.length > 1 ? "s" : ""} can't be used for answers.
              </strong>{" "}
              {issues[0].error}
            </Callout>
          )}
          <div className="row-wrap" style={{ justifyContent: "space-between", gap: 12 }}>
            <div className="row-wrap">
              <div style={{ width: 240, maxWidth: "100%" }}>
                <TextInput id="kn-search" aria-label={t("Search sources")} icon="search" size="sm" placeholder={t("Search sources")} value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <SegmentedControl
                label={t("Source type")}
                value={type}
                onChange={setType}
                options={[
                  { value: "all", label: t("All"), count: counts.all },
                  {
                    value: "website",
                    label: t("Websites"),
                    count: counts.website,
                  },
                  { value: "file", label: t("Files"), count: counts.file },
                  { value: "qa", label: "Q&A", count: counts.qa },
                ]}
              />
            </div>
            {all.length > 0 && (
              <span className="helper" aria-live="polite">
                {t("{done} of {total} ready", {
                  done: ready,
                  total: all.length,
                })}
                {processing ? ` · ${t("{n} processing", { n: processing })}` : ""}
              </span>
            )}
          </div>
          {list.loading && !list.data ? (
            <Loading />
          ) : list.error && !list.data ? (
            <div className="box">
              <EmptyState
                icon="alertCircle"
                title={t("Couldn't load knowledge")}
                action={
                  <Button size="sm" onClick={list.reload}>
                    {t("Try again")}
                  </Button>
                }
              >
                {list.error.message}
              </EmptyState>
            </div>
          ) : all.length === 0 ? (
            <div className="box">
              <EmptyState
                icon="book"
                title={t("{name} has no knowledge yet", {
                  name: activeAgent?.name || t("This agent"),
                })}
                action={
                  isAdmin && (
                    <Button variant="primary" size="sm" icon="plus" onClick={add}>
                      {t("Add knowledge")}
                    </Button>
                  )
                }
              >
                {t("Add a website, a document or a few Q&A pairs. Until then, the agent replies with its fallback message.")}
              </EmptyState>
            </div>
          ) : rows.length === 0 ? (
            <div className="box">
              <EmptyState
                icon="search"
                title={t("No sources match")}
                action={
                  <Button
                    size="sm"
                    onClick={() => {
                      setQuery("");
                      setType("all");
                    }}
                  >
                    {t("Clear filters")}
                  </Button>
                }
              >
                {t("Try a different search or source type.")}
              </EmptyState>
            </div>
          ) : (
            <Table
              caption={t("Knowledge sources for {name}", {
                name: activeAgent?.name,
              })}
              columns={columns}
              rows={rows}
              rowKey={(s) => s.id}
              onRowClick={(s) => go("knowledge", s.id)}
            />
          )}
          <p className="helper">{t("Sources belong to {name} only. The agent answers from them and nothing else.", { name: activeAgent?.name || t("the selected agent") })}</p>
        </div>
      </div>
      {id && (
        <SourceDrawer
          id={id}
          onClose={() => go("knowledge")}
          onChanged={refresh}
          onRemove={(s) => {
            go("knowledge");
            setRemoving(s);
          }}
        />
      )}
      {removing && (
        <Confirm
          title={t("Remove this source?")}
          body={t("The agent stops using “{name}” in its answers. You can add it again later.", { name: removing.name })}
          confirmLabel={t("Remove source")}
          danger
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            try {
              await api(`${base}/sources/${removing.id}`, { method: "DELETE" });
              refresh();
              toast(t("Removed “{name}”", { name: removing.name }));
            } catch (e) {
              toast(e.message, { tone: "error" });
            }
          }}
        />
      )}
    </>
  );
}
