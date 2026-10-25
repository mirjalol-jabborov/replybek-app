import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, setUnauthorizedHandler } from "./api.js";
import { useStored } from "./hooks.js";

const Ctx = createContext(null);
export const useSession = () => useContext(Ctx);

/** Who is signed in, their workspaces, and the one they're working in. */
export function SessionProvider({ children }) {
  const [state, setState] = useState({ status: "loading", user: null, workspaces: [] });
  const [wid, setWid] = useStored("replybek.workspace", null);

  const accept = ({ user, workspaces }) => {
    setState({ status: "in", user, workspaces });
    if (!workspaces.some((w) => w.id === wid)) setWid(workspaces[0]?.id || null);
  };
  useEffect(() => {
    setUnauthorizedHandler(() => setState({ status: "out", user: null, workspaces: [] }));
    api("/auth/me")
      .then(accept)
      .catch(() => setState({ status: "out", user: null, workspaces: [] }));
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      workspace: state.workspaces.find((w) => w.id === wid) || state.workspaces[0] || null,
      setWorkspace: setWid,
      signIn: async (email, password) => accept(await api("/auth/login", { method: "POST", body: { email, password } })),
      signUp: async (body) => accept(await api("/auth/register", { method: "POST", body })),
      signOut: async () => {
        await api("/auth/logout", { method: "POST" }).catch(() => {});
        setState({ status: "out", user: null, workspaces: [] });
      },
      refresh: async () => accept(await api("/auth/me")),
    }),
    [state, wid]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Workspace-scoped API path: w("/agents") → /w/<id>/agents */
export function useW() {
  const { workspace } = useSession();
  return (p = "") => `/w/${workspace.id}${p}`;
}
