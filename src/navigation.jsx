import { useEffect, useState } from "react";
import { t, tk } from "./i18n.js";
import { go } from "./hooks.js";
import { useWorkspace } from "./workspace.jsx";
import { useSession } from "./session.jsx";
import { Icon } from "./icons.jsx";
import { Dialog, TextInput, IconButton, StatusBadge } from "./ui.jsx";
import { AgentSelect } from "./pages/shared.jsx";
import { supportChat, openSupportChat, identifySupportChat, onSupportUnread } from "./support.js";

export const NAV_GROUPS = [
  {
    label: tk("Workspace"),
    items: [
      { id: "overview", label: tk("Overview"), icon: "overview" },
      { id: "agents", label: tk("Agents"), icon: "bot" },
    ],
  },
  {
    label: tk("Build & launch"),
    items: [
      { id: "knowledge", label: tk("Knowledge"), icon: "book" },
      { id: "playground", label: tk("Playground"), icon: "flask" },
      { id: "integrations", label: tk("Integrations"), icon: "link" },
      { id: "widget", label: tk("Website widget"), icon: "code" },
    ],
  },
  {
    label: tk("Monitor & improve"),
    items: [
      { id: "inbox", label: tk("Inbox"), icon: "inbox" },
      { id: "analytics", label: tk("Analytics"), icon: "chart" },
    ],
  },
  {
    label: tk("Manage"),
    items: [{ id: "settings", label: tk("Settings & billing"), icon: "settings" }],
  },
];
export const NAV = NAV_GROUPS.flatMap((group) => group.items);

export function WorkspaceBar({ page, onOpenNavigation }) {
  const { workspace, openDialog } = useWorkspace();
  const currentPage = NAV.find((item) => item.id === page);
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (!document.querySelector('[role="dialog"]')) openDialog("search");
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openDialog]);
  return (
    <header className="workspace-bar">
      <span className="mobile-menu-trigger">
        <IconButton icon="menu" label={t("Open navigation")} tooltip={false} onClick={onOpenNavigation} />
      </span>
      <div className="workspace-crumb">
        <span className="truncate">{workspace.name}</span>
        <Icon name="chevronRight" size={13} />
        <strong>{t(currentPage?.label || "Workspace")}</strong>
      </div>
      <div className="workspace-bar-actions">
        <button className="quick-search" type="button" onClick={() => openDialog("search")} aria-label={t("Search pages and agents")}>
          <Icon name="search" size={16} />
          <span>{t("Quick search")}</span>
          <kbd>⌘ K</kbd>
        </button>
        <SupportButton />
        <IconButton icon="help" label={t("Help")} onClick={() => openDialog("help")} />
      </div>
    </header>
  );
}

/** Opens our support chat, with the number of replies the person hasn't read. Shown once it has loaded. */
function SupportButton() {
  const { user, workspace } = useWorkspace();
  const { workspaces } = useSession();
  const [ready, setReady] = useState(() => supportChat());
  const [unread, setUnread] = useState(() => window.Replybek?.unread?.() || 0);
  useEffect(() => {
    if (!ready) supportChat(() => setReady(true));
  }, [ready]);
  useEffect(
    () => identifySupportChat({ ...user, workspaceCount: workspaces.length }, workspace),
    [user.id, user.name, user.email, user.avatar, workspace.id, workspace.name, workspace.plan, workspace.billing?.access, workspaces.length]
  );
  useEffect(() => onSupportUnread(setUnread), []);
  if (!ready) return null;
  const label = unread ? t("Chat with us · {count} unread", { count: unread }) : t("Chat with us");
  return (
    <span className="support-btn">
      <IconButton icon="message" label={label} onClick={openSupportChat} />
      {unread > 0 && (
        <span className="support-count" aria-hidden="true">
          {unread}
        </span>
      )}
    </span>
  );
}

export function AgentWorkflow({ page }) {
  const { activeAgent, agentsLoaded } = useWorkspace();
  if (!["knowledge", "playground", "widget"].includes(page) || !agentsLoaded || !activeAgent) return null;
  return (
    <div className="agent-workflow">
      <div className="agent-workflow-context">
        <AgentSelect id="working-agent" prefix={null} size="sm" width={215} />
        <StatusBadge status={activeAgent.status} label={activeAgent.status === "active" ? t("Published") : t("Draft")} />
      </div>
      <nav aria-label={t("Agent setup workflow")} className="workflow-links">
        {[
          ["knowledge", t("Add knowledge"), "book"],
          ["playground", t("Test answers"), "flask"],
          ["widget", t("Go live"), "globe"],
        ].map(([id, label, icon], i) => (
          <button key={id} type="button" aria-current={page === id ? "page" : undefined} onClick={() => go(id)}>
            <span>{i + 1}</span>
            {label}
            <Icon name={icon} size={14} />
          </button>
        ))}
      </nav>
    </div>
  );
}

export function CommandPalette({ onClose }) {
  const { agents, setActiveAgent, openDialog, isAdmin } = useWorkspace();
  const [query, setQuery] = useState(""),
    [selected, setSelected] = useState(0);
  const commands = [
    ...NAV.map((n) => ({
      key: n.id,
      label: t(n.label),
      group: t("Pages"),
      icon: n.icon,
      run: () => go(n.id),
    })),
    ...(isAdmin
      ? [
          {
            key: "create",
            label: t("Create agent"),
            group: t("Quick actions"),
            icon: "plus",
            run: () => openDialog("createAgent"),
          },
          ...(agents.length
            ? [
                {
                  key: "source",
                  label: t("Add knowledge"),
                  group: t("Quick actions"),
                  icon: "upload",
                  run: () => openDialog("addKnowledge"),
                },
              ]
            : []),
        ]
      : []),
    ...agents.map((a) => ({
      key: a.id,
      label: a.name,
      group: t("Agents"),
      icon: "bot",
      run: () => {
        setActiveAgent(a.id);
        go("playground");
      },
    })),
  ];
  const results = commands.filter((c) => `${c.label} ${c.group}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  useEffect(() => {
    document.querySelector('.command-item[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [selected, query]);
  const choose = (c) => {
    onClose();
    c.run();
  };
  return (
    <Dialog title={t("Quick search")} description={t("Jump to a page, find an agent, or start a task.")} onClose={onClose} size="command">
      <TextInput
        id="command-query"
        icon="search"
        label={t("Search pages and agents")}
        placeholder={t("Where would you like to go?")}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelected(0);
        }}
        data-autofocus
        role="combobox"
        aria-expanded="true"
        aria-controls="command-results"
        aria-autocomplete="list"
        aria-activedescendant={results[selected] ? `command-${results[selected].key}` : undefined}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setSelected((i) => (results.length ? (i + (e.key === "ArrowDown" ? 1 : results.length - 1)) % results.length : 0));
          }
          if (e.key === "Enter" && results[selected]) {
            e.preventDefault();
            choose(results[selected]);
          }
        }}
      />
      <div id="command-results" className="command-results" role="listbox" aria-label={t("Search results")}>
        {results.map((c, i) => (
          <button id={`command-${c.key}`} key={c.key} role="option" aria-selected={i === selected} className="command-item" type="button" onClick={() => choose(c)}>
            <Icon name={c.icon} size={17} />
            <span>{c.label}</span>
            <small>{c.group}</small>
            <Icon name="arrowRight" size={14} />
          </button>
        ))}
      </div>
      {!results.length && <p className="helper">{t("No matching pages or agents. Try another name.")}</p>}
    </Dialog>
  );
}
