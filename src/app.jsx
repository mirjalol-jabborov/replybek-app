import { useEffect, useState } from "react";
import { Icon } from "./icons.jsx";
import { SessionProvider, useSession } from "./session.jsx";
import { WorkspaceProvider, useWorkspace } from "./workspace.jsx";
import { useRoute, go } from "./hooks.js";
import { getTheme, setTheme } from "./theme.js";
import { t, tk, LANGS, getLang, setLang, onLangChange } from "./i18n.js";
import { ToastProvider, ActionMenu, Dialog, Avatar, IconButton, Button, fmt, pct, initialsOf, capitalize } from "./ui.jsx";
import { Loading } from "./pages/shared.jsx";
import { AuthPage } from "./pages/auth.jsx";
import { Overview } from "./pages/overview.jsx";
import { Agents, CreateAgentDialog } from "./pages/agents.jsx";
import { Knowledge, AddKnowledgeDialog } from "./pages/knowledge.jsx";
import { Playground } from "./pages/playground.jsx";
import { Inbox } from "./pages/inbox.jsx";
import { Analytics } from "./pages/analytics.jsx";
import { Settings } from "./pages/settings.jsx";
import { InstallDialog } from "./pages/install.jsx";
import { Integrations } from "./pages/integrations.jsx";

const NAV = [
  { id: "overview", label: tk("Overview"), icon: "overview" },
  { id: "inbox", label: tk("Inbox"), icon: "inbox" },
  { id: "agents", label: tk("Agents"), icon: "bot" },
  { id: "knowledge", label: tk("Knowledge"), icon: "book" },
  { id: "playground", label: tk("Playground"), icon: "flask" },
  { id: "analytics", label: tk("Analytics"), icon: "chart" },
  { id: "integrations", label: tk("Integrations"), icon: "link" },
  { id: "settings", label: tk("Settings & billing"), icon: "settings" },
];
const PAGES = { overview: Overview, agents: Agents, knowledge: Knowledge, playground: Playground, inbox: Inbox, analytics: Analytics, integrations: Integrations, settings: Settings };

function WorkspaceMenu({ onNavigate }) {
  const { workspaces, setWorkspace } = useSession();
  const { workspace, openDialog } = useWorkspace();
  const nav = (p, id) => {
    go(p, id);
    onNavigate && onNavigate();
  };
  return (
    <ActionMenu
      label={t("Workspace")}
      placement="bottom-start"
      minWidth={250}
      header={
        <div className="stack-xs" style={{ gap: 2 }}>
          <span className="strong text-sm">{workspace.name}</span>
          <span className="helper">
            {workspace.website || t("No website set")} · {t("{plan} plan", { plan: capitalize(workspace.plan) })}
          </span>
        </div>
      }
      items={[
        ...(workspaces.length > 1
          ? [{ heading: t("Switch workspace") }, ...workspaces.map((w) => ({ label: w.name, checked: w.id === workspace.id, onSelect: () => setWorkspace(w.id) })), { separator: true }]
          : []),
        { label: t("Workspace settings"), icon: "settings", onSelect: () => nav("settings", "workspace") },
        { label: t("Team members"), icon: "users", onSelect: () => nav("settings", "team") },
        { label: t("Plan & billing"), icon: "card", onSelect: () => nav("settings", "billing") },
        { separator: true },
        { label: t("Install widget"), icon: "code", onSelect: () => openDialog("install") },
      ]}
      trigger={(p) => (
        <button type="button" className="ws-trigger" {...p} aria-label={t("Workspace: {name}", { name: workspace.name })}>
          <span className="ws-mark" aria-hidden="true">
            {workspace.name[0]}
          </span>
          <span className="rail-hide" style={{ flex: 1, minWidth: 0 }}>
            <span className="ws-name truncate" style={{ display: "block" }}>
              {workspace.name}
            </span>
            <span className="ws-sub">{t("{plan} plan", { plan: capitalize(workspace.plan) })}</span>
          </span>
          <Icon name="chevronDown" size={14} className="muted rail-hide" />
        </button>
      )}
    />
  );
}

function UserMenu() {
  const { user, signOut } = useSession();
  const { openDialog } = useWorkspace();
  const [theme, setThemeState] = useState(getTheme);
  const pick = (mode) => {
    setTheme(mode);
    setThemeState(mode);
  };
  return (
    <ActionMenu
      label={t("Account")}
      placement="top-start"
      minWidth={230}
      header={
        <div className="stack-xs" style={{ gap: 2 }}>
          <span className="strong text-sm">{user.name}</span>
          <span className="helper truncate">{user.email}</span>
        </div>
      }
      items={[
        { heading: t("Language") },
        ...LANGS.map((l) => ({ label: l.label, checked: getLang() === l.code, onSelect: () => setLang(l.code) })),
        { separator: true },
        { heading: t("Appearance") },
        { label: t("System"), description: t("Follow your computer's setting"), checked: theme === "system", onSelect: () => pick("system") },
        { label: t("Light"), checked: theme === "light", onSelect: () => pick("light") },
        { label: t("Dark"), checked: theme === "dark", onSelect: () => pick("dark") },
        { separator: true },
        { label: t("Help"), checked: undefined, icon: "help", onSelect: () => openDialog("help") },
        { label: t("Sign out"), icon: "arrowLeft", onSelect: signOut },
      ]}
      trigger={(p) => (
        <button type="button" className="user-trigger" {...p} aria-label={t("Account menu for {name}", { name: user.name })}>
          <Avatar initials={initialsOf(user.name)} tone="t1" size="xs" />
          <span className="rail-hide truncate text-sm" style={{ flex: 1, fontWeight: 500 }}>
            {user.name}
          </span>
          <Icon name="chevronUp" size={13} className="muted rail-hide" />
        </button>
      )}
    />
  );
}

function Sidebar({ page, onNavigate }) {
  const { workspace, openDialog } = useWorkspace();
  const usage = workspace.usage;
  const limits = workspace.limits;
  const waiting = usage?.waiting || 0;
  return (
    <nav className="sidebar" aria-label={t("Workspace")}>
      <WorkspaceMenu onNavigate={onNavigate} />
      <div className="nav">
        {NAV.map((n) => (
          <button
            key={n.id}
            type="button"
            className="nav-item"
            data-tip={t(n.label)}
            aria-current={page === n.id ? "page" : undefined}
            onClick={() => {
              go(n.id);
              onNavigate && onNavigate();
            }}
          >
            <Icon name={n.icon} size={16} />
            <span className="nav-label">{t(n.label)}</span>
            {n.id === "inbox" && waiting > 0 && (
              <span className="nav-count" aria-label={t("{n} waiting for a teammate", { n: waiting })}>
                {waiting}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="side-foot">
        {usage && limits && (
          <button
            type="button"
            className="usage-mini rail-hide"
            onClick={() => {
              go("settings", "billing");
              onNavigate && onNavigate();
            }}
          >
            <span className="row" style={{ justifyContent: "space-between" }}>
              <span>{t("AI messages this month")}</span>
              <span className="num">{pct(usage.messages, limits.messages)}%</span>
            </span>
            <span className={"progress" + (usage.messages / limits.messages > 0.9 ? " warn" : "")}>
              <span style={{ width: Math.min(100, pct(usage.messages, limits.messages)) + "%" }} />
            </span>
            <span className="num">
              {t("{used} of {total}", { used: fmt(usage.messages), total: fmt(limits.messages) })}
            </span>
          </button>
        )}
        <div className="side-row">
          <UserMenu />
          <IconButton icon="help" label={t("Help")} onClick={() => openDialog("help")} />
        </div>
      </div>
    </nav>
  );
}

function HelpDialog({ onClose }) {
  const steps = [
    [t("Create an agent"), t("Name it and describe what it should help with."), () => go("agents")],
    [t("Add knowledge"), t("Websites, files and Q&A. The agent answers only from these."), () => go("knowledge")],
    [t("Test answers"), t("Ask questions in the Playground and open the sources used."), () => go("playground")],
    [t("Install the widget"), t("Publish the agent and paste one script tag into your site."), () => go("settings", "widget")],
    [t("Handle conversations"), t("Take over in the Inbox when a customer needs a person."), () => go("inbox")],
  ];
  return (
    <Dialog title={t("Help")} description={t("How Replybek works, in five steps.")} onClose={onClose}>
      <ol className="file-list" style={{ listStyle: "none" }}>
        {steps.map(([t, s, fn], i) => (
          <li key={t} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 8px 8px 12px", borderTop: i ? "1px solid var(--border)" : 0 }}>
            <span className="num muted text-sm" style={{ width: 14 }}>
              {i + 1}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="label" style={{ display: "block" }}>
                {t}
              </span>
              <span className="helper">{s}</span>
            </span>
            <Button
              size="sm"
              onClick={() => {
                onClose();
                fn();
              }}
            >
              {t("Open")}
            </Button>
          </li>
        ))}
      </ol>
      <p className="helper">Esc closes menus and dialogs. Enter sends a message; Shift+Enter adds a new line.</p>
    </Dialog>
  );
}

function Dialogs() {
  const { dialog, closeDialog } = useWorkspace();
  if (!dialog) return null;
  if (dialog.name === "createAgent") return <CreateAgentDialog onClose={closeDialog} />;
  if (dialog.name === "install") return <InstallDialog onClose={closeDialog} agentId={dialog.agentId} />;
  if (dialog.name === "addKnowledge") return <AddKnowledgeDialog {...dialog} onClose={closeDialog} />;
  if (dialog.name === "help") return <HelpDialog onClose={closeDialog} />;
  return null;
}

function Workspace() {
  const route = useRoute();
  const { workspace } = useWorkspace();
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e) => e.key === "Escape" && setNavOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [navOpen]);
  const page = PAGES[route.page] ? route.page : "overview";
  const Page = PAGES[page];
  useEffect(() => {
    document.title = `${t(NAV.find((n) => n.id === page).label)} · ${workspace.name} · Replybek`;
  }, [page, workspace.name]);
  return (
    <div className="shell">
      <Sidebar page={page} />
      <div className="main">
        <div className="mobile-bar">
          <IconButton icon="menu" label={t("Open navigation")} tooltip={false} onClick={() => setNavOpen(true)} />
          <span className="ws-mark" aria-hidden="true">
            {workspace.name[0]}
          </span>
          <span className="ws-name truncate">{workspace.name}</span>
        </div>
        <main className="page" id="main" key={`${workspace.id}:${page}`}>
          <Page id={route.id} />
        </main>
      </div>
      {navOpen && (
        <div className="mobile-nav" onMouseDown={(e) => e.target === e.currentTarget && setNavOpen(false)}>
          <Sidebar page={page} onNavigate={() => setNavOpen(false)} />
        </div>
      )}
      <Dialogs />
    </div>
  );
}

function Root() {
  const session = useSession();
  // Re-render every 30 s so relative times stay fresh.
  const [, tick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(timer);
  }, []);
  if (session.status === "loading") return <Loading label={t("Loading Replybek…")} />;
  if (session.status === "out") return <AuthPage />;
  if (!session.workspace) return <Loading label={t("No workspace found for this account.")} />;
  return (
    <WorkspaceProvider key={session.workspace.id}>
      <Workspace />
    </WorkspaceProvider>
  );
}

export function App() {
  // Changing the language re-renders everything below the session with the new texts.
  const [lang, setLangState] = useState(getLang);
  useEffect(() => onLangChange(setLangState), []);
  return (
    <ToastProvider>
      <SessionProvider>
        <Root key={lang} />
      </SessionProvider>
    </ToastProvider>
  );
}
