import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useSession } from "./session.jsx";
import { useResource, useStored } from "./hooks.js";
import { connectLive, disconnectLive } from "./live.js";
import { t } from "./i18n.js";

const Ctx = createContext(null);
export const useWorkspace = () => useContext(Ctx);

/**
 * Data most screens share: the workspace summary (plan, usage, waiting count), agents and
 * members. The summary refreshes on live updates (every 15 s without them) so the Inbox badge stays current.
 */
export function WorkspaceProvider({ children }) {
  const { workspace, user } = useSession();
  const base = `/w/${workspace.id}`;
  const summary = useResource(base, { poll: 15000, live: true });
  useEffect(() => {
    connectLive(base);
    return disconnectLive;
  }, [base]);
  const agents = useResource(`${base}/agents`);
  const members = useResource(`${base}/members`);
  const [storedAgent, setActiveAgent] = useStored(`replybek.agent.${workspace.id}`, null);
  const [dialog, setDialog] = useState(null);

  const list = agents.data || [];
  const roleAdmin = ["owner", "admin"].includes(summary.data?.role || workspace.role);
  // Before the free trial (or after the subscription ends) the workspace is read-only, like the API
  // makes it: onboarding is done, so there's nothing to add or change until billing is sorted.
  const access = summary.data?.billing?.access;
  const locked = Boolean(summary.data?.settings?.onboarded) && (access === "none" || access === "ended");
  const activeAgent = list.find((a) => a.id === storedAgent) || list[0] || null;
  useEffect(() => {
    if (activeAgent && activeAgent.id !== storedAgent) setActiveAgent(activeAgent.id);
  }, [activeAgent?.id]);

  const value = useMemo(
    () => ({
      base,
      user,
      workspace: { ...workspace, ...(summary.data || {}) },
      role: summary.data?.role || workspace.role,
      // Can add and change things. `roleAdmin` is the role alone, for what admins may see.
      isAdmin: roleAdmin && !locked,
      roleAdmin,
      locked,
      summary,
      agents: list,
      agentsLoaded: !agents.loading || Boolean(agents.data),
      reloadAgents: agents.reload,
      members: members.data || [],
      reloadMembers: members.reload,
      memberName: (id) => (members.data || []).find((m) => m.id === id)?.name || t("Former teammate"),
      activeAgent,
      setActiveAgent,
      openDialog: (name, props = {}) => setDialog({ name, ...props }),
      closeDialog: () => setDialog(null),
      dialog,
    }),
    [base, summary.data, agents.data, agents.loading, members.data, activeAgent, dialog, user, workspace]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
