import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, setUnauthorizedHandler } from "./api.js";
import { useStored } from "./hooks.js";
import { resetSupportChat } from "./support.js";

const Ctx = createContext(null);
export const useSession = () => useContext(Ctx);

// Until a new account's email is confirmed (user.email_verified), `verification` says where the
// code went and when a new one may be sent: { email, until } (until: a Date.now() time).
const pending = (v) => (v ? { email: v.email, until: Date.now() + (v.resend_in || 0) * 1000 } : null);

/** Who is signed in, their workspaces, and the one they're working in. */
export function SessionProvider({ children }) {
  const [state, setState] = useState({ status: "loading", user: null, workspaces: [], verification: null });
  const [wid, setWid] = useStored("replybek.workspace", null);

  const accept = ({ user, workspaces, verification }) => {
    setState({ status: "in", user, workspaces, verification: pending(verification) });
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
      // An answer that signs in or changes the account (confirming the email, a new address).
      accept,
      // A new code went out: { email, resend_in }.
      codeSent: (v) => setState((s) => ({ ...s, verification: pending(v) })),
      signOut: async () => {
        await api("/auth/logout", { method: "POST" }).catch(() => {});
        resetSupportChat();
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
