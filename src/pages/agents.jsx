import { useRef, useState } from "react";
import { t, tk } from "../i18n.js";
import { Icon } from "../icons.jsx";
import { api } from "../api.js";
import { useWorkspace } from "../workspace.jsx";
import { go } from "../hooks.js";
import {
  Dialog,
  TextInput,
  Textarea,
  StatusBadge,
  Avatar,
  Button,
  IconButton,
  ActionMenu,
  PageHeader,
  Table,
  Callout,
  EmptyState,
  Confirm,
  initialsOf,
  toneOf,
  fmt,
  useToast,
  dateLong,
  looksLikeUrl,
  SegmentedControl,
} from "../ui.jsx";
import { FilePicker } from "./knowledge.jsx";
import { readLogo, LOGO_TYPES } from "./widgetPreview.jsx";
import { Loading } from "./shared.jsx";

export function Agents() {
  const { base, agents, agentsLoaded, reloadAgents, setActiveAgent, openDialog, isAdmin } = useWorkspace();
  const toast = useToast();
  const [deleting, setDeleting] = useState(null);
  const [search, setSearch] = useState(""),
    [status, setFilterStatus] = useState("all"),
    [view, setView] = useState("grid");
  const filtered = agents.filter((a) => (status === "all" || a.status === status) && `${a.name} ${a.purpose || ""}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const open = (a, page = "playground") => {
    setActiveAgent(a.id);
    go(page);
  };
  const setStatus = async (a, action) => {
    try {
      await api(`${base}/agents/${a.id}/${action}`, { method: "POST" });
      await reloadAgents();
      toast(action === "publish" ? t("{name} is published", { name: a.name }) : t("{name} is a draft again", { name: a.name }), {
        sub: action === "publish" ? t("Its widget can now answer visitors.") : t("Its widget stops answering visitors."),
      });
    } catch (e) {
      toast(e.message, { tone: "error" });
    }
  };
  // The logo shows on the agent and in its chat widget. Onboarding takes it from the website.
  const logoInput = useRef(null);
  const logoFor = useRef(null);
  const pickLogo = (a) => ((logoFor.current = a), logoInput.current.click());
  const saveLogo = async (a, logo) => {
    try {
      await api(`${base}/agents/${a.id}`, { method: "PATCH", body: { widget: { logo } } });
      await reloadAgents();
      toast(logo ? t("Logo updated") : t("Logo removed"), { sub: t("The chat widget uses it too.") });
    } catch (e) {
      toast(e.message, { tone: "error" });
    }
  };
  const onLogo = (file) => file && logoFor.current && readLogo(file).then((logo) => saveLogo(logoFor.current, logo), (e) => toast(e.message, { tone: "error" }));
  const columns = [
    {
      key: "name",
      header: t("Agent"),
      maxWidth: 380,
      render: (a) => (
        <div className="cell-main">
          <Avatar initials={initialsOf(a.name)} tone={toneOf(a.id)} src={a.widget?.logo || undefined} square />
          <div className="cell-text">
            <button type="button" className="plain-btn cell-title truncate" style={{ display: "block", maxWidth: "100%" }} onClick={() => open(a)}>
              {a.name}
            </button>
            <div className="cell-sub truncate">{a.purpose || t("No description")}</div>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: t("Status"),
      shrink: true,
      render: (a) => <StatusBadge status={a.status} label={a.status === "active" ? t("Published") : t("Draft")} />,
    },
    {
      key: "sources",
      header: t("Sources"),
      align: "right",
      shrink: true,
      hideSm: true,
      render: (a) => (
        <span className="num">
          {a.source_count}
          {a.source_errors > 0 && <span style={{ color: "var(--amber)" }}> · {t("{count} failed", { count: a.source_errors })}</span>}
        </span>
      ),
    },
    {
      key: "conv",
      header: t("Conversations (30d)"),
      align: "right",
      shrink: true,
      hideSm: true,
      render: (a) => <span className="num">{fmt(a.conversations_30d)}</span>,
    },
    {
      key: "created",
      header: t("Created"),
      shrink: true,
      hideSm: true,
      render: (a) => <span className="sec">{dateLong(a.created_at)}</span>,
    },
    {
      key: "actions",
      header: t("Actions"),
      srHeader: true,
      shrink: true,
      render: (a) => (
        <ActionMenu
          label={t("Actions for {name}", { name: a.name })}
          items={[
            {
              label: t("Configure and test"),
              icon: "flask",
              onSelect: () => open(a),
            },
            {
              label: t("Manage knowledge"),
              icon: "book",
              onSelect: () => open(a, "knowledge"),
            },
            ...(isAdmin
              ? [
                  a.status === "active"
                    ? {
                        label: t("Unpublish"),
                        icon: "pause",
                        onSelect: () => setStatus(a, "unpublish"),
                      }
                    : {
                        label: t("Publish"),
                        icon: "globe",
                        onSelect: () => setStatus(a, "publish"),
                      },
                  {
                    label: a.widget?.logo ? t("Change logo") : t("Upload logo"),
                    icon: "upload",
                    onSelect: () => pickLogo(a),
                  },
                  ...(a.widget?.logo ? [{ label: t("Remove logo"), icon: "x", onSelect: () => saveLogo(a, "") }] : []),
                  {
                    label: t("Install widget"),
                    icon: "code",
                    onSelect: () => openDialog("install", { agentId: a.id }),
                  },
                  { separator: true },
                  {
                    label: t("Delete agent"),
                    icon: "trash",
                    danger: true,
                    onSelect: () => setDeleting(a),
                  },
                ]
              : []),
          ]}
          trigger={(p) => <IconButton icon="more" label={t("Actions for {name}", { name: a.name })} size="sm" {...p} />}
        />
      ),
    },
  ];
  return (
    <>
      <input ref={logoInput} id="agent-logo-input" type="file" accept={LOGO_TYPES.join(",")} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => (onLogo(e.target.files[0]), (e.target.value = ""))} />
      <PageHeader
        title={t("Agents")}
        description={t("Each agent has its own instructions, knowledge and widget.")}
        actions={
          isAdmin && (
            <Button variant="primary" icon="plus" onClick={() => openDialog("createAgent")}>
              {t("Create agent")}
            </Button>
          )
        }
      />
      <div className="page-body">
        <div className="page-inner">
          {!agentsLoaded ? (
            <Loading />
          ) : agents.length === 0 ? (
            <div className="box">
              <EmptyState
                icon="bot"
                title={t("No agents yet")}
                action={
                  isAdmin && (
                    <Button variant="primary" size="sm" icon="plus" onClick={() => openDialog("createAgent")}>
                      {t("Create agent")}
                    </Button>
                  )
                }
              >
                {t("An agent answers your customers from the knowledge you give it, and hands off to your team when needed.")}
              </EmptyState>
            </div>
          ) : (
            <>
              <div className="collection-toolbar">
                <TextInput id="agent-search" aria-label={t("Search agents")} icon="search" placeholder={t("Search agents")} value={search} onChange={(e) => setSearch(e.target.value)} />
                <SegmentedControl
                  label={t("Agent status")}
                  value={status}
                  onChange={setFilterStatus}
                  options={[
                    { value: "all", label: t("All"), count: agents.length },
                    { value: "active", label: t("Published") },
                    { value: "draft", label: t("Drafts") },
                  ]}
                />
                <div className="view-switch">
                  <IconButton icon="overview" label={t("Grid view")} aria-pressed={view === "grid"} onClick={() => setView("grid")} />
                  <IconButton icon="menu" label={t("List view")} aria-pressed={view === "list"} onClick={() => setView("list")} />
                </div>
              </div>
              {!filtered.length ? (
                <EmptyState
                  icon="search"
                  title={t("No matching agents")}
                  action={
                    <Button
                      onClick={() => {
                        setSearch("");
                        setFilterStatus("all");
                      }}
                    >
                      {t("Clear filters")}
                    </Button>
                  }
                >
                  {t("Try another name or change the status filter.")}
                </EmptyState>
              ) : view === "list" ? (
                <Table caption={t("Agents")} columns={columns} rows={filtered} rowKey={(a) => a.id} onRowClick={(a) => open(a)} />
              ) : (
                <div className="agents-grid">
                  {filtered.map((a) => (
                    <article className="agent-card" key={a.id} aria-label={a.name}>
                      <div className="agent-card-top">
                        {isAdmin ? (
                          <button type="button" className="agent-logo" onClick={() => pickLogo(a)} aria-label={a.widget?.logo ? t("Change logo") : t("Upload logo")} title={a.widget?.logo ? t("Change logo") : t("Upload logo")}>
                            <Avatar initials={initialsOf(a.name)} tone={toneOf(a.id)} src={a.widget?.logo || undefined} size="lg" square />
                            <span className="agent-logo-edit" aria-hidden="true">
                              <Icon name="upload" size={13} />
                            </span>
                          </button>
                        ) : (
                          <Avatar initials={initialsOf(a.name)} tone={toneOf(a.id)} src={a.widget?.logo || undefined} size="lg" square />
                        )}
                        <StatusBadge status={a.status} label={a.status === "active" ? t("Published") : t("Draft")} />
                        <span className="spacer" />
                        {columns.find((c) => c.key === "actions").render(a)}
                      </div>
                      <button className="agent-card-title" type="button" onClick={() => open(a)}>
                        {a.name}
                      </button>
                      <p>{a.purpose || t("No description")}</p>
                      <div className="agent-card-stats">
                        <span>
                          <Icon name="book" size={14} />
                          {t("{count} sources", { count: a.source_count || 0 })}
                        </span>
                        <span>
                          <Icon name="message" size={14} />
                          {fmt(a.conversations_30d)} {t("conversations")}
                        </span>
                      </div>
                      {a.source_errors > 0 && <span className="helper attn">{t("{count} failed", { count: a.source_errors })}</span>}
                      <div className="agent-card-foot">
                        <Button size="sm" variant="ghost" onClick={() => open(a, "knowledge")}>
                          {t("Manage knowledge")}
                        </Button>
                        <Button size="sm" iconRight="arrowRight" onClick={() => open(a)}>
                          {t("Open agent")}
                        </Button>
                      </div>
                    </article>
                  ))}
                  {isAdmin && (
                    <button type="button" className="agent-create-card" onClick={() => openDialog("createAgent")}>
                      <span>
                        <Icon name="plus" size={22} />
                      </span>
                      <strong>{t("Create agent")}</strong>
                      <p>{t("A new assistant for a new job.")}</p>
                    </button>
                  )}
                </div>
              )}
            </>
          )}
          <p className="helper">{t("Draft agents can be tested in the Playground. Publish an agent to let its website widget answer visitors.")}</p>
        </div>
      </div>
      {deleting && (
        <Confirm
          title={`Delete ${deleting.name}?`}
          body={t("Its knowledge, conversations and widget are deleted permanently. Websites using its widget stop showing the chat.")}
          confirmLabel={t("Delete agent")}
          danger
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            try {
              await api(`${base}/agents/${deleting.id}`, { method: "DELETE" });
              await reloadAgents();
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

const KINDS = [
  {
    id: "website",
    icon: "globe",
    title: tk("Website"),
    sub: tk("Use pages from your site"),
  },
  {
    id: "file",
    icon: "file",
    title: tk("Document"),
    sub: tk("PDF, Word or text files"),
  },
  {
    id: "qa",
    icon: "qa",
    title: tk("Q&A"),
    sub: tk("Type a question and answer"),
  },
  {
    id: "skip",
    icon: "clock",
    title: tk("Add later"),
    sub: tk("Start without knowledge"),
  },
];

export function CreateAgentDialog({ onClose }) {
  const { base, reloadAgents, setActiveAgent } = useWorkspace();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [f, setF] = useState({
    name: "",
    purpose: "",
    kind: "website",
    url: "",
    includeLinked: true,
    files: [],
    q: "",
    a: "",
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) =>
    setF({
      ...f,
      [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    });

  function validate() {
    const e = {};
    if (step === 1) {
      if (!f.name.trim()) e.name = t("Give the agent a name.");
      if (f.purpose.trim().length < 10) e.purpose = t("Describe the agent's job in a short sentence.");
    }
    if (step === 2) {
      if (f.kind === "website" && !looksLikeUrl(f.url)) e.url = t("Enter a website address, like example.com/help.");
      if (f.kind === "file" && !f.files.length) e.files = t("Choose at least one file, or pick another option.");
      if (f.kind === "qa" && !f.q.trim()) e.q = t("Add the question.");
      if (f.kind === "qa" && !f.a.trim()) e.a = t("Add the answer.");
    }
    setErrors(e);
    return !Object.keys(e).length;
  }

  async function create() {
    setBusy(true);
    setError("");
    let agent;
    try {
      agent = await api(`${base}/agents`, {
        method: "POST",
        body: { name: f.name.trim(), purpose: f.purpose.trim() },
      });
    } catch (e) {
      setBusy(false);
      return setError(e.message);
    }
    // The agent exists now; a failed source is reported but doesn't undo it.
    const failures = [];
    const a = `${base}/agents/${agent.id}/sources`;
    try {
      if (f.kind === "website")
        await api(`${a}/website`, {
          method: "POST",
          body: { url: f.url.trim(), include_linked: f.includeLinked },
        });
      if (f.kind === "qa")
        await api(`${a}/qa`, {
          method: "POST",
          body: { question: f.q.trim(), answer: f.a.trim() },
        });
    } catch (e) {
      failures.push(e.message);
    }
    if (f.kind === "file") {
      for (const file of f.files) {
        const form = new FormData();
        form.append("file", file);
        try {
          await api(`${a}/file`, { method: "POST", form });
        } catch (e) {
          failures.push(`${file.name}: ${e.message}`);
        }
      }
    }
    await reloadAgents();
    setActiveAgent(agent.id);
    onClose();
    toast(t("{name} created as a draft", { name: agent.name }), {
      tone: failures.length ? "error" : "success",
      sub: failures.length
        ? t("Some knowledge wasn't added: {list}", {
            list: failures.join(" · "),
          })
        : f.kind === "skip"
          ? t("Add knowledge before testing answers.")
          : t("Its knowledge is being processed."),
      action: { label: t("Open Playground"), onClick: () => go("playground") },
      duration: failures.length ? 9000 : 5000,
    });
    go("agents");
  }

  const steps = [t("Basics"), t("Knowledge"), t("Review")];
  return (
    <Dialog
      title={t("Create agent")}
      description={t("Set up a new support agent in three short steps.")}
      onClose={onClose}
      footNote={`Step ${step} of 3`}
      footer={
        <>
          {step > 1 ? (
            <Button onClick={() => setStep(step - 1)} disabled={busy}>
              {t("Back")}
            </Button>
          ) : (
            <Button onClick={onClose}>{t("Cancel")}</Button>
          )}
          {step < 3 ? (
            <Button variant="primary" iconRight="arrowRight" onClick={() => validate() && setStep(step + 1)}>
              {t("Continue")}
            </Button>
          ) : (
            <Button variant="primary" onClick={create} loading={busy}>
              {t("Create agent")}
            </Button>
          )}
        </>
      }
    >
      <ol className="stepper" aria-label={t("Progress")}>
        {steps.map((s, i) => (
          <li key={s} className={step === i + 1 ? "cur" : step > i + 1 ? "done" : ""} aria-current={step === i + 1 ? "step" : undefined}>
            {i > 0 && <span className="sep" />}
            <span className="sn">{step > i + 1 ? <Icon name="check" size={11} strokeWidth={3} /> : i + 1}</span>
            {s}
          </li>
        ))}
      </ol>
      {error && <Callout tone="bad">{error}</Callout>}

      {step === 1 && (
        <>
          <TextInput
            id="ca-name"
            label={t("Agent name")}
            hint={t("Visitors see this name in the chat widget.")}
            placeholder={t("e.g. Returns Helper")}
            value={f.name}
            onChange={set("name")}
            error={errors.name}
            data-autofocus
            maxLength={80}
          />
          <Textarea
            id="ca-purpose"
            label={t("What should this agent help with?")}
            hint={t("One or two sentences. You can refine its instructions later.")}
            placeholder={t("e.g. Answer questions about returns and exchanges, and help customers start a return.")}
            value={f.purpose}
            onChange={set("purpose")}
            error={errors.purpose}
            maxLength={500}
          />
        </>
      )}

      {step === 2 && (
        <>
          <div className="field">
            <span className="field-label" id="kind-l">
              {t("First knowledge source")}
            </span>
            <div className="choices" role="radiogroup" aria-labelledby="kind-l">
              {KINDS.map((k) => (
                <button type="button" key={k.id} className="choice" role="radio" aria-checked={f.kind === k.id} onClick={() => setF({ ...f, kind: k.id })}>
                  <Icon name={k.icon} size={16} className="c-icon" />
                  <span>
                    <span className="c-title">{t(k.title)}</span>
                    <span className="c-sub">{t(k.sub)}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
          {f.kind === "website" && (
            <>
              <TextInput id="ca-url" label={t("Website address")} icon="globe" placeholder="example.com/help" value={f.url} onChange={set("url")} error={errors.url} />
              <label className="check">
                <input type="checkbox" checked={f.includeLinked} onChange={set("includeLinked")} />
                <span>
                  {t("Import the whole section")}
                  <span className="helper" style={{ display: "block" }}>
                    {t("Reads every page under this address from the site's sitemap (or by following links), and re-syncs weekly. To pick sections yourself, use Knowledge › Add knowledge.")}
                  </span>
                </span>
              </label>
            </>
          )}
          {f.kind === "file" && <FilePicker files={f.files} onChange={(files) => setF({ ...f, files })} error={errors.files} compact />}
          {f.kind === "qa" && (
            <>
              <TextInput id="ca-q" label={t("Question")} placeholder={t("e.g. Can I exchange an item for a different size?")} value={f.q} onChange={set("q")} error={errors.q} />
              <Textarea id="ca-a" label={t("Answer")} placeholder={t("Write the answer the agent should give.")} value={f.a} onChange={set("a")} error={errors.a} />
            </>
          )}
          {f.kind === "skip" && <Callout>{t("Until you add knowledge, the agent replies to questions with its fallback message. You can add sources from the Knowledge page at any time.")}</Callout>}
        </>
      )}

      {step === 3 && (
        <>
          <dl className="review">
            <div>
              <dt>{t("Agent name")}</dt>
              <dd>{f.name}</dd>
            </div>
            <div>
              <dt>{t("Purpose")}</dt>
              <dd>{f.purpose}</dd>
            </div>
            <div>
              <dt>{t("Knowledge")}</dt>
              <dd>
                {f.kind === "website" && `${t("Website")} · ${f.url} · ${f.includeLinked ? t("whole section, weekly re-sync") : t("this page only")}`}
                {f.kind === "file" && `${t("{count} files", { count: f.files.length })} · ${f.files.map((x) => x.name).join(", ")}`}
                {f.kind === "qa" && `${t("Q&A")} · “${f.q}”`}
                {f.kind === "skip" && <span className="muted">{t("None yet")}</span>}
              </dd>
            </div>
            <div>
              <dt>{t("Status")}</dt>
              <dd>{t("Draft · the widget won't answer until you publish")}</dd>
            </div>
          </dl>
          <p className="helper">{t("The agent starts with a friendly tone, a default welcome message and human handoff on. Change these in the Playground.")}</p>
        </>
      )}
    </Dialog>
  );
}
