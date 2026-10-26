import { Icon } from "../icons.jsx";
import { useEffect, useState } from "react";
import { api, apiUrl } from "../api.js";
import { t, tk, LANGS, getLang, setLang } from "../i18n.js";
import { useSession } from "../session.jsx";
import { Button, TextInput, Callout, ActionMenu, IconButton } from "../ui.jsx";
import { getTheme, setTheme } from "../theme.js";
import { BrandMark, Wordmark } from "../components/brand.jsx";

/** Sign in and create-account screens. */
export function AuthPage() {
  const { signIn, signUp } = useSession();
  // replybek.uz's "Start free trial" links to #/signup.
  const [mode, setMode] = useState(() => (window.location.hash.startsWith("#/signup") ? "signup" : "signin"));
  const [f, setF] = useState({
    name: "",
    email: "",
    password: "",
    workspace_name: "",
    website: "",
  });
  const [errors, setErrors] = useState({});
  // Google sends failures back as ?auth_error=…; show it once and tidy the address.
  const [error, setError] = useState(() => new URLSearchParams(window.location.search).get("auth_error") || "");
  const [busy, setBusy] = useState(false);
  const [google, setGoogle] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("auth_error")) window.history.replaceState(null, "", window.location.pathname + window.location.hash);
    api("/auth/providers")
      .then((p) => setGoogle(Boolean(p.google)))
      .catch(() => {});
  }, []);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const signup = mode === "signup";

  async function submit(e) {
    e.preventDefault();
    const v = {};
    if (signup && !f.name.trim()) v.name = t("Add your name.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) v.email = t("Enter a valid email address.");
    if (signup ? f.password.length < 10 : !f.password) v.password = signup ? t("Use at least 10 characters.") : t("Enter your password.");
    if (signup && !f.workspace_name.trim()) v.workspace_name = t("Add your business name.");
    setErrors(v);
    setError("");
    if (Object.keys(v).length) return;
    setBusy(true);
    try {
      if (signup)
        await signUp({
          name: f.name.trim(),
          email: f.email.trim(),
          password: f.password,
          workspace_name: f.workspace_name.trim(),
          website: f.website.trim() || undefined,
        });
      else await signIn(f.email.trim(), f.password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <aside className="auth-story">
        <a href="#/overview" className="app-brand">
          <BrandMark />
          <Wordmark />
        </a>
        <div className="auth-story-content">
          <span className="eyebrow">{t("Your support workspace")}</span>
          <h2>{t("Helpful answers. Connected systems. Happier customers.")}</h2>
          <p>{t("Bring your knowledge, tools and team together in one place.")}</p>
          <div className="auth-story-steps">
            {[
              ["book", t("Teach it your business")],
              ["link", t("Connect the tools you use")],
              ["message", t("Be there when customers need you")],
            ].map(([icon, label]) => (
              <div key={icon}>
                <Icon name={icon} size={20} />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>
      <div className="auth-main">
        <AuthToolbar />
        <form className="auth-card" onSubmit={submit} noValidate>
          <div className="row" style={{ gap: 10, marginBottom: 4 }}>
            <BrandMark size={26} />
            <Wordmark />
          </div>
          <div>
            <h1 className="page-title">{signup ? t("Create your workspace") : t("Sign in")}</h1>
            <p className="page-desc">{signup ? t("Set up an AI support agent for your business.") : t("Welcome back.")}</p>
          </div>
          {error && <Callout tone="bad">{t(error)}</Callout>}
          {google && (
            <>
              <a className="btn btn-secondary google-btn" href={apiUrl("/auth/google")}>
                <GoogleMark />
                <span className="btn-label">{t("Continue with Google")}</span>
              </a>
              <div className="auth-or" role="separator">
                <span>{t("or")}</span>
              </div>
            </>
          )}
          {signup && <TextInput id="au-name" label={t("Your name")} autoComplete="name" value={f.name} onChange={set("name")} error={errors.name} />}
          <TextInput id="au-email" label={t("Work email")} type="email" autoComplete="email" value={f.email} onChange={set("email")} error={errors.email} />
          <TextInput
            id="au-pass"
            label={t("Password")}
            type="password"
            autoComplete={signup ? "new-password" : "current-password"}
            hint={signup ? t("At least 10 characters.") : undefined}
            value={f.password}
            onChange={set("password")}
            error={errors.password}
          />
          {!signup && (
            <a className="link helper auth-forgot" href="#/reset">
              {t("Forgot password?")}
            </a>
          )}
          {signup && (
            <>
              <TextInput id="au-biz" label={t("Business name")} placeholder={t("e.g. Northstar Outfitters")} value={f.workspace_name} onChange={set("workspace_name")} error={errors.workspace_name} />
              <TextInput id="au-site" label={t("Website")} optional placeholder="northstar.example" value={f.website} onChange={set("website")} />
            </>
          )}
          <Button variant="primary" type="submit" loading={busy} style={{ width: "100%" }}>
            {signup ? t("Create workspace") : t("Sign in")}
          </Button>
          {signup && <AgreeLine />}
          <p className="helper" style={{ textAlign: "center" }}>
            {signup ? t("Already have an account?") : t("New to Replybek?")}{" "}
            <button
              type="button"
              className="link"
              onClick={() => {
                setMode(signup ? "signin" : "signup");
                window.history.replaceState(null, "", signup ? "#/" : "#/signup");
                setErrors({});
                setError("");
              }}
            >
              {signup ? t("Sign in") : t("Create a workspace")}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}

const LEGAL = { terms: [tk("Terms of Service"), "https://replybek.uz/terms/"], privacy: [tk("Privacy Policy"), "https://replybek.uz/privacy/"] };

/** Creating a workspace accepts the Terms and the Privacy Policy, both linked inside the sentence. */
function AgreeLine() {
  return (
    <p className="helper auth-agree">
      {t("By creating a workspace, you accept: {terms} and {privacy}.")
        .split(/(\{\w+\})/)
        .map((part, i) => {
          const doc = LEGAL[part.slice(1, -1)];
          return doc ? (
            <a key={i} className="link" href={doc[1]} target="_blank" rel="noopener noreferrer">
              {t(doc[0])}
            </a>
          ) : (
            part
          );
        })}
    </p>
  );
}

/** Google's "G", in Google's colours as its sign-in branding guidelines require. */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/** Language menu and light/dark toggle, top right of the auth screen. */
export function AuthToolbar() {
  const [theme, setThemeState] = useState(getTheme);
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const toggleTheme = () => {
    const next = dark ? "light" : "dark";
    setTheme(next);
    setThemeState(next);
  };
  const current = LANGS.find((l) => l.code === getLang());
  return (
    <div className="auth-toolbar">
      <ActionMenu
        label={t("Language")}
        minWidth={160}
        items={LANGS.map((l) => ({ label: l.label, checked: getLang() === l.code, onSelect: () => setLang(l.code) }))}
        trigger={(p) => (
          <button type="button" className="btn btn-ghost btn-sm auth-lang" {...p} aria-label={t("Language")}>
            <Icon name="globe" size={15} />
            <span>{current.label}</span>
            <Icon name="chevronDown" size={13} className="muted" />
          </button>
        )}
      />
      <IconButton icon={dark ? "sun" : "moon"} label={dark ? t("Switch to light mode") : t("Switch to dark mode")} onClick={toggleTheme} />
    </div>
  );
}
