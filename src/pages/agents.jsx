import { useRef, useState } from "react";
import { t } from "../i18n.js";
import { Icon } from "../icons.jsx";
import { api } from "../api.js";
import { useWorkspace } from "../workspace.jsx";
import { go } from "../hooks.js";
import {
  TextInput,
  StatusBadge,
  Avatar,
  Button,
  IconButton,
  ActionMenu,
  PageHeader,
  Table,
  EmptyState,
  Confirm,
  initialsOf,
  toneOf,
  fmt,
  useToast,
  dateLong,
  SegmentedControl,
} from "../ui.jsx";
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
                      <p>{t("A new AI agent for a new job.")}</p>
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
