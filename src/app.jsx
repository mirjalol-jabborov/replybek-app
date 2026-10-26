import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons.jsx";
import { SessionProvider, useSession } from "./session.jsx";
import { WorkspaceProvider, useWorkspace } from "./workspace.jsx";
import { InvitePage, ResetPage } from "./pages/join.jsx";
import { useRoute, go } from "./hooks.js";
import { getTheme, setTheme } from "./theme.js";
import { t, LANGS, getLang, setLang, onLangChange } from "./i18n.js";
import { ToastProvider, ActionMenu, Dialog, Avatar, IconButton, Button, Callout, fmt, pct, initialsOf, capitalize, trialDaysLeft, dateLong } from "./ui.jsx";

/** The first day of next month, when the AI message allowance starts over (as the API counts it, in UTC). */
const nextMonth = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 12));
};
import { useModal, Confirm } from "./components/overlay.jsx";
import { limitMessage, setPaymentRequiredHandler, trialMessage } from "./api.js";
import { Loading } from "./pages/shared.jsx";
import { supportChat, openSupportChat } from "./support.js";
import { AuthPage } from "./pages/auth.jsx";
import { Overview } from "./pages/overview.jsx";
import { Agents, CreateAgentDialog } from "./pages/agents.jsx";
import { Knowledge, AddKnowledgeDialog } from "./pages/knowledge.jsx";
import { Playground } from "./pages/playground.jsx";
import { Inbox } from "./pages/inbox.jsx";
import { Analytics } from "./pages/analytics.jsx";
import { Settings, WebsiteWidget } from "./pages/settings.jsx";
import { InstallDialog } from "./pages/install.jsx";
import { Integrations } from "./pages/integrations.jsx";
import { Onboarding } from "./pages/onboarding.jsx";
import { ProfileDialog } from "./pages/profile.jsx";

import { NAV, NAV_GROUPS, WorkspaceBar, AgentWorkflow, CommandPalette } from "./navigation.jsx";
import { BrandMark, Wordmark } from "./components/brand.jsx";

const PAGES = {
  overview: Overview,
  agents: Agents,
  knowledge: Knowledge,
  playground: Playground,
  inbox: Inbox,
  analytics: Analytics,
  integrations: Integrations,
  settings: Settings,
  widget: WebsiteWidget,
};

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
          ? [
              { heading: t("Switch workspace") },
              ...workspaces.map((w) => ({
                label: w.name,
                checked: w.id === workspace.id,
                onSelect: () => setWorkspace(w.id),
              })),
              { separator: true },
            ]
          : []),
        {
          label: t("Workspace settings"),
          icon: "settings",
          onSelect: () => nav("settings", "workspace"),
        },
        {
          label: t("Team members"),
          icon: "users",
          onSelect: () => nav("settings", "team"),
        },
        {
          label: t("Plan & billing"),
          icon: "card",
          onSelect: () => nav("settings", "billing"),
        },
        { separator: true },
        {
          label: t("Install widget"),
          icon: "code",
          onSelect: () => openDialog("install"),
        },
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
        ...LANGS.map((l) => ({
          label: l.label,
          checked: getLang() === l.code,
          onSelect: () => setLang(l.code),
        })),
        { separator: true },
        { heading: t("Appearance") },
        {
          label: t("System"),
          description: t("Follow your computer's setting"),
          checked: theme === "system",
          onSelect: () => pick("system"),
        },
        {
          label: t("Light"),
          checked: theme === "light",
          onSelect: () => pick("light"),
        },
        {
          label: t("Dark"),
          checked: theme === "dark",
          onSelect: () => pick("dark"),
        },
        { separator: true },
        {
          label: t("Help"),
          checked: undefined,
          icon: "help",
          onSelect: () => openDialog("help"),
        },
        { label: t("Your profile"), icon: "user", onSelect: () => openDialog("profile") },
        { label: t("Sign out"), icon: "arrowLeft", onSelect: signOut },
      ]}
      trigger={(p) => (
        <button type="button" className="user-trigger" {...p} aria-label={t("Account menu for {name}", { name: user.name })}>
          <Avatar initials={initialsOf(user.name)} tone="t1" size="xs" src={user.avatar || undefined} cover />
          <span className="rail-hide truncate text-sm" style={{ flex: 1, fontWeight: 500 }}>
            {user.name}
          </span>
          <Icon name="chevronUp" size={13} className="muted rail-hide" />
        </button>
      )}
    />
  );
}

function Sidebar({ page, onNavigate, collapsed, onToggle }) {
  const { workspace, openDialog } = useWorkspace();
  const usage = workspace.usage;
  const limits = workspace.limits;
  const access = workspace.billing?.access;
  const waiting = usage?.waiting || 0;
  return (
    <nav id={onToggle ? "desktop-navigation" : undefined} className="sidebar" aria-label={t("Workspace")}>
      <div className="sidebar-brand-row">
        <a href="#/overview" className="app-brand" aria-label={t("Replybek")} onClick={onNavigate}>
          <BrandMark />
          <span className="rail-hide">
            <Wordmark />
          </span>
        </a>
        {onToggle ? (
          <IconButton icon="panelLeft" label={collapsed ? t("Expand sidebar") : t("Collapse sidebar")} aria-expanded={!collapsed} aria-controls="desktop-navigation" onClick={onToggle} />
        ) : (
          <IconButton icon="x" label={t("Close")} onClick={onNavigate} />
        )}
      </div>
      <WorkspaceMenu onNavigate={onNavigate} />
      <div className="nav">
        {NAV_GROUPS.map((group) => (
          <div className="nav-group" key={group.label}>
            <span className="nav-group-title rail-hide">{t(group.label)}</span>
            {group.items.map((n) => (
              <button
                key={n.id}
                type="button"
                className="nav-item"
                data-tip={t(n.label)}
                title={collapsed ? t(n.label) : undefined}
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
            {access === "trial" && workspace.billing.renews_at && <span className="usage-trial">{t("Free trial: {count} days left", { count: trialDaysLeft(workspace.billing.renews_at) })}</span>}
            {access === "none" && <span className="usage-trial">{t("Free trial not started")}</span>}
            {access === "ended" && <span className="usage-trial ended">{t("Subscription ended")}</span>}
            <span className="row" style={{ justifyContent: "space-between" }}>
              <span>{t("AI messages this month")}</span>
              <span className="num">{pct(usage.messages, limits.messages)}%</span>
            </span>
            <span className={"progress" + (usage.messages / limits.messages > 0.9 ? " warn" : "")}>
              <span
                style={{
                  width: Math.min(100, pct(usage.messages, limits.messages)) + "%",
                }}
              />
            </span>
            <span className="num">
              {t("{used} of {total}", {
                used: fmt(usage.messages),
                total: fmt(limits.messages),
              })}
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
  // Our own support chat, once it has loaded (app.replybek.uz only).
  const [chat, setChat] = useState(() => supportChat());
  useEffect(() => {
    if (!chat) supportChat(() => setChat(true));
  }, [chat]);
  const steps = [
    [t("Create an agent"), t("Name it and describe what it should help with."), () => go("agents")],
    [t("Add knowledge"), t("Websites, files and Q&A. The agent answers only from these."), () => go("knowledge")],
    [t("Test answers"), t("Ask questions in the Playground and open the sources used."), () => go("playground")],
    [t("Install the widget"), t("Publish the agent and paste one script tag into your site."), () => go("widget")],
    [t("Handle conversations"), t("Take over in the Inbox when a customer needs a person."), () => go("inbox")],
  ];
  return (
    <Dialog title={t("Help")} description={t("How Replybek works, in five steps.")} onClose={onClose}>
      <ol className="file-list" style={{ listStyle: "none" }}>
        {steps.map(([title, s, fn], i) => (
          <li
            key={title}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 8px 8px 12px",
              borderTop: i ? "1px solid var(--border)" : 0,
            }}
          >
            <span className="num muted text-sm" style={{ width: 14 }}>
              {i + 1}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="label" style={{ display: "block" }}>
                {title}
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
      <div className="row" style={{ gap: 12, justifyContent: "space-between", flexWrap: "wrap", padding: "12px", borderRadius: 10, background: "var(--surface-muted)" }}>
        <span className="helper" style={{ flex: "1 1 220px" }}>{t("Step-by-step guides for every feature, with short videos.")}</span>
        <a className="btn btn-secondary btn-sm" href="https://docs.replybek.uz/" target="_blank" rel="noopener noreferrer">
          <span className="btn-label">{t("Open the guides")}</span>
          <Icon name="arrowRight" size={14} />
        </a>
      </div>
      {chat && (
        <div className="row" style={{ gap: 12, justifyContent: "space-between", flexWrap: "wrap", padding: "12px", borderRadius: 10, background: "var(--surface-muted)" }}>
          <span className="helper" style={{ flex: "1 1 220px" }}>{t("Have a question? Ask our AI agent, or a person from our team.")}</span>
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              onClose();
              setTimeout(openSupportChat, 50);
            }}
          >
            {t("Chat with us")}
          </Button>
        </div>
      )}
      <p className="helper">{t("Esc closes menus and dialogs. Enter sends a message; Shift+Enter adds a new line.")}</p>
    </Dialog>
  );
}

// The plan's agents and knowledge sources are all used: explain and point at the plans instead of a form
// the API would refuse.
const LIMITED_DIALOGS = { createAgent: "agents", addKnowledge: "sources" };

function Dialogs() {
  const { dialog, closeDialog, workspace, locked } = useWorkspace();
  if (!dialog) return null;
  const kind = LIMITED_DIALOGS[dialog.name];
  const ended = workspace.billing?.access === "ended";
  // Read-only until the trial starts (or a plan is chosen again): same idea as the limits below.
  if (kind && locked) {
    return (
      <Confirm
        title={ended ? t("Your subscription has ended.") : t("Start your free trial first")}
        body={ended ? t("Choose a plan to add agents and knowledge again.") : t("Start your 7-day free trial to add agents and knowledge. You can view everything until then.")}
        confirmLabel={ended ? t("Choose a plan") : t("Start free trial")}
        onClose={closeDialog}
        onConfirm={() => go("settings", "billing")}
      />
    );
  }
  // Any AI feature the API refused for billing (e.g. the free test messages are used up).
  if (dialog.name === "trial") {
    return (
      <Confirm
        title={ended ? t("Your subscription has ended.") : t("Start your 7-day free trial")}
        body={dialog.message || (ended ? t("Choose a plan to keep using AI features.") : t("AI features need the free trial. Add a card on Polar; nothing is charged for 7 days."))}
        confirmLabel={ended ? t("Choose a plan") : t("Start free trial")}
        onClose={closeDialog}
        onConfirm={() => go("settings", "billing")}
      />
    );
  }
  const limit = kind && workspace.limits?.[kind];
  if (limit && workspace.usage?.[kind] >= limit) {
    return (
      <Confirm
        title={kind === "agents" ? t("Agent limit reached") : t("Knowledge limit reached")}
        body={limitMessage({ code: `limit_${kind}`, limit })}
        confirmLabel={t("See plans")}
        onClose={closeDialog}
        onConfirm={() => go("settings", "billing")}
      />
    );
  }
  if (dialog.name === "createAgent") return <CreateAgentDialog onClose={closeDialog} />;
  if (dialog.name === "install") return <InstallDialog onClose={closeDialog} agentId={dialog.agentId} />;
  if (dialog.name === "addKnowledge") return <AddKnowledgeDialog {...dialog} onClose={closeDialog} />;
  if (dialog.name === "search") return <CommandPalette onClose={closeDialog} />;
  if (dialog.name === "help") return <HelpDialog onClose={closeDialog} />;
  if (dialog.name === "profile") return <ProfileDialog onClose={closeDialog} />;
  return null;
}

function MobileNavigation({ page, onClose }) {
  const ref = useRef(null);
  const [closing, setClosing] = useState(false);
  const close = () => setClosing(true);
  useModal(ref, close);
  useEffect(() => {
    if (!closing) return;
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 200;
    const timer = window.setTimeout(onClose, delay);
    return () => window.clearTimeout(timer);
  }, [closing, onClose]);
  return (
    <div className={"mobile-nav" + (closing ? " is-closing" : "")} ref={ref} role="dialog" aria-modal="true" aria-label={t("Navigation")} onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <Sidebar page={page} onNavigate={close} />
    </div>
  );
}

function Workspace() {
  const route = useRoute();
  const { workspace, summary, agents, agentsLoaded, roleAdmin, openDialog } = useWorkspace();
  useEffect(() => {
    setPaymentRequiredHandler((data) => {
      summary.reload();
      // Onboarding shows its own way to the trial (and the dashboard's dialogs aren't on screen there).
      if (!window.location.hash.startsWith("#/onboarding")) openDialog("trial", { message: trialMessage(data) });
    });
    return () => setPaymentRequiredHandler(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // A brand-new workspace (no agent, never onboarded) starts in onboarding. It's a route, so it
  // stays put while onboarding creates the agent and across the trip to Polar checkout. One that left
  // onboarding half-way before starting the trial goes back to it (the API only allows edits there).
  const needsOnboarding = roleAdmin && summary.data && agentsLoaded && !workspace.settings?.onboarded && (agents.length === 0 || workspace.billing?.access === "none");
  useEffect(() => {
    if (needsOnboarding && route.page !== "onboarding") go("onboarding");
  }, [needsOnboarding, route.page]);
  const [navOpen, setNavOpen] = useState(false);
  const [sidebarPreference, setSidebarPreference] = useState(() => {
    try {
      const saved = localStorage.getItem("replybek.sidebarCollapsed");
      return saved === null ? null : saved === "true";
    } catch {
      return null;
    }
  });
  const [narrow, setNarrow] = useState(() => window.matchMedia("(max-width: 1180px)").matches);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 1180px)");
    const update = () => setNarrow(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const sidebarCollapsed = sidebarPreference ?? narrow;
  const toggleSidebar = () => {
    const next = !sidebarCollapsed;
    setSidebarPreference(next);
    try {
      localStorage.setItem("replybek.sidebarCollapsed", String(next));
    } catch {
      /* Keep the choice for this session. */
    }
  };
  const page = PAGES[route.page] ? route.page : "overview";
  const Page = PAGES[page];
  // The trial and subscription banners already say why agents aren't answering; this one is for a used-up allowance.
  const messagesOut = !["none", "ended"].includes(workspace.billing?.access) && workspace.limits && workspace.usage?.messages >= workspace.limits.messages;
  useEffect(() => {
    document.title = `${t(NAV.find((n) => n.id === page).label)} · ${workspace.name} · Replybek`;
  }, [page, workspace.name]);
  // Onboarding picks its step from the agents and billing state, so wait for both (e.g. back from Polar).
  if (route.page === "onboarding" || needsOnboarding) return agentsLoaded && summary.data ? <Onboarding /> : <Loading label={t("Loading Replybek…")} />;
  return (
    <div className={"shell" + (sidebarCollapsed ? " sidebar-collapsed" : "")}>
      <Sidebar page={page} collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      <div className="main">
        <WorkspaceBar page={page} onOpenNavigation={() => setNavOpen(true)} />
        <AgentWorkflow page={page} />
        {workspace.billing?.access === "ended" && page !== "settings" && (
          <div className="billing-banner">
            <Callout tone="bad" action={<Button size="sm" variant="primary" onClick={() => go("settings", "billing")}>{t("Choose a plan")}</Button>}>
              {t("Your subscription has ended.")} {t("Your agents pass new chats to your team instead of answering, until you choose a plan.")} {t("Until then you can view everything but not change it.")}
            </Callout>
          </div>
        )}
        {messagesOut && page !== "settings" && (
          <div className="billing-banner">
            <Callout tone="bad" action={<Button size="sm" variant="primary" onClick={() => go("settings", "billing")}>{t("See plans")}</Button>}>
              {t("Your agents used all {count} AI messages this month. New chats go to your team until {date}, or upgrade the plan to turn answers back on.", { count: fmt(workspace.limits.messages), date: dateLong(nextMonth()) })}
            </Callout>
          </div>
        )}
        {workspace.billing?.access === "none" && page !== "settings" && (
          <div className="billing-banner">
            <Callout tone="info" action={<Button size="sm" variant="primary" onClick={() => go("settings", "billing")}>{t("Start free trial")}</Button>}>
              {t("Your agent isn't answering visitors yet, and you can view everything but not change it. Start your 7-day free trial to go live.")}
            </Callout>
          </div>
        )}
        <main className="page" id="main" data-page={page} key={`${workspace.id}:${page}`}>
          <Page id={route.id} />
        </main>
      </div>
      {navOpen && <MobileNavigation page={page} onClose={() => setNavOpen(false)} />}
      <Dialogs />
    </div>
  );
}

function Root() {
  const session = useSession();
  const route = useRoute();
  // Re-render every 30 s so relative times stay fresh.
  const [, tick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(timer);
  }, []);
  // Invitation and password links work signed in or out.
  if (route.page === "invite") return <InvitePage token={route.id} />;
  if (route.page === "reset") return <ResetPage token={route.id} />;
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
