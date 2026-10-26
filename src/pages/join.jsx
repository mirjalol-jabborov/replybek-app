import { useEffect, useState } from "react";
import { api } from "../api.js";
import { t } from "../i18n.js";
import { useSession } from "../session.jsx";
import { Button, TextInput, Callout } from "../ui.jsx";
import { BrandMark, Wordmark } from "../components/brand.jsx";
import { AuthToolbar } from "./auth.jsx";
import { Loading } from "./shared.jsx";

const ROLE = { admin: () => t("Admin"), agent: () => t("Agent") };

function Shell({ title, desc, children, onSubmit }) {
  return (
    <div className="auth auth-solo">
      <div className="auth-main">
        <AuthToolbar />
        <form className="auth-card" onSubmit={onSubmit} noValidate>
          <a href="#/overview" className="row" style={{ gap: 10, marginBottom: 4, textDecoration: "none", color: "inherit" }}>
            <BrandMark size={26} />
            <Wordmark />
          </a>
          <div>
            <h1 className="page-title">{title}</h1>
            {desc && <p className="page-desc">{desc}</p>}
          </div>
          {children}
        </form>
      </div>
    </div>
  );
}

/** Opens the workspace someone just joined, in the inbox. */
async function enter(session, workspaceId) {
  await session.refresh();
  if (workspaceId) session.setWorkspace(workspaceId);
  window.location.hash = "#/inbox";
}

/** #/invite/<token>: join a workspace from an emailed invitation. */
export function InvitePage({ token }) {
  const session = useSession();
  const [info, setInfo] = useState(null);
  const [fail, setFail] = useState("");
  const [f, setF] = useState({ name: "", password: "" });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api(`/invites/${token}`)
      .then(setInfo)
      .catch((e) => setFail(e.status === 410 ? t("This invitation expired or was already used. Ask the person who invited you to send a new one.") : t("This invitation link isn't valid. Ask for a new one.")));
  }, [token]);

  if (fail)
    return (
      <Shell title={t("Invitation unavailable")}>
        <Callout tone="bad">{fail}</Callout>
        <a className="btn btn-secondary" href="#/overview">
          {t("Go to sign in")}
        </a>
      </Shell>
    );
  if (!info || session.status === "loading") return <Loading label={t("Loading Replybek…")} />;

  const vars = { workspace: info.workspace, inviter: info.inviter || t("A teammate"), role: ROLE[info.role]() };
  const title = t("Join {workspace}", vars);
  const desc = t("{inviter} invited you to the team. Role: {role}.", vars);
  const signedIn = session.status === "in";
  const sameEmail = signedIn && session.user.email.toLowerCase() === info.email.toLowerCase();

  const accept = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api(`/invites/${token}/accept`, { method: "POST" });
      await enter(session, r.workspace_id);
    } catch (err) {
      setError(t(err.message));
      setBusy(false);
    }
  };
  const join = async (e) => {
    e.preventDefault();
    const v = {};
    if (!f.name.trim()) v.name = t("Add your name.");
    if (f.password.length < 10) v.password = t("Use at least 10 characters.");
    setErrors(v);
    if (Object.keys(v).length) return;
    setBusy(true);
    setError("");
    try {
      const r = await api(`/invites/${token}/join`, { method: "POST", body: { name: f.name.trim(), password: f.password } });
      await enter(session, r.workspace_id);
    } catch (err) {
      setError(t(err.message));
      setBusy(false);
    }
  };

  // Signed in with the invited address: one click.
  if (sameEmail)
    return (
      <Shell title={title} desc={desc} onSubmit={accept}>
        {error && <Callout tone="bad">{error}</Callout>}
        <p className="helper">{t("You're signed in as {email}.", { email: session.user.email })}</p>
        <Button variant="primary" type="submit" loading={busy}>
          {t("Accept invitation")}
        </Button>
      </Shell>
    );
  // Signed in as someone else: the invitation is for another address.
  if (signedIn)
    return (
      <Shell title={title} desc={desc}>
        <Callout>{t("This invitation is for {email}, but you're signed in as {current}. Sign out, then open the link again.", { email: info.email, current: session.user.email })}</Callout>
        <Button variant="primary" onClick={() => session.signOut()}>
          {t("Sign out")}
        </Button>
      </Shell>
    );
  // Has an account: sign in first; this page then shows the one-click accept.
  if (info.has_account) return <SignInToAccept title={title} desc={desc} email={info.email} />;
  // New here: an account for the invited address.
  return (
    <Shell title={title} desc={desc} onSubmit={join}>
      {error && <Callout tone="bad">{error}</Callout>}
      <TextInput id="jn-email" label={t("Work email")} value={info.email} readOnly disabled />
      <TextInput id="jn-name" label={t("Your name")} autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} error={errors.name} />
      <TextInput
        id="jn-pass"
        label={t("Password")}
        type="password"
        autoComplete="new-password"
        hint={t("At least 10 characters.")}
        value={f.password}
        onChange={(e) => setF({ ...f, password: e.target.value })}
        error={errors.password}
      />
      <Button variant="primary" type="submit" loading={busy}>
        {t("Join the team")}
      </Button>
    </Shell>
  );
}

function SignInToAccept({ title, desc, email }) {
  const { signIn } = useSession();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await signIn(email, password);
    } catch (err) {
      setError(t(err.message));
      setBusy(false);
    }
  };
  return (
    <Shell title={title} desc={desc} onSubmit={submit}>
      {error && <Callout tone="bad">{error}</Callout>}
      <p className="helper">{t("Sign in to accept the invitation.")}</p>
      <TextInput id="ja-email" label={t("Work email")} value={email} readOnly disabled />
      <TextInput id="ja-pass" label={t("Password")} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <Button variant="primary" type="submit" loading={busy}>
        {t("Sign in")}
      </Button>
      <a className="link helper" href="#/reset" style={{ textAlign: "center" }}>
        {t("Forgot password?")}
      </a>
    </Shell>
  );
}

/** #/reset asks for a link by email; #/reset/<token> sets the new password. */
export function ResetPage({ token }) {
  const session = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!token) {
    const ask = async (e) => {
      e.preventDefault();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError(t("Enter a valid email address."));
      setBusy(true);
      setError("");
      try {
        await api("/auth/password/forgot", { method: "POST", body: { email: email.trim() } });
        setSent(true);
      } catch (err) {
        setError(t(err.message));
      } finally {
        setBusy(false);
      }
    };
    return (
      <Shell title={t("Reset your password")} desc={sent ? null : t("We'll email you a link to choose a new one.")} onSubmit={ask}>
        {sent ? (
          <Callout tone="ok">{t("If {email} has an account, a link is on its way. It works for 1 hour.", { email: email.trim() })}</Callout>
        ) : (
          <>
            {error && <Callout tone="bad">{error}</Callout>}
            <TextInput id="rs-email" label={t("Work email")} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button variant="primary" type="submit" loading={busy}>
              {t("Send reset link")}
            </Button>
          </>
        )}
        <a className="link helper" href="#/overview" style={{ textAlign: "center" }}>
          {t("Back to sign in")}
        </a>
      </Shell>
    );
  }

  const reset = async (e) => {
    e.preventDefault();
    if (password.length < 10) return setError(t("Use at least 10 characters."));
    setBusy(true);
    setError("");
    try {
      await api("/auth/password/reset", { method: "POST", body: { token, password } });
      await enter(session, null);
      window.location.hash = "#/overview";
    } catch (err) {
      setError(t(err.message));
      setBusy(false);
    }
  };
  return (
    <Shell title={t("Choose a new password")} desc={t("You'll be signed out on your other devices.")} onSubmit={reset}>
      {error && <Callout tone="bad">{error}</Callout>}
      <TextInput id="rs-pass" label={t("New password")} type="password" autoComplete="new-password" hint={t("At least 10 characters.")} value={password} onChange={(e) => setPassword(e.target.value)} />
      <Button variant="primary" type="submit" loading={busy}>
        {t("Save password")}
      </Button>
    </Shell>
  );
}
