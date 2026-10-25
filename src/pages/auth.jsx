import { useState } from "react";
import { t, LANGS, getLang, setLang } from "../i18n.js";
import { useSession } from "../session.jsx";
import { Button, TextInput, Callout, SegmentedControl } from "../ui.jsx";

/** Sign in and create-account screens. */
export function AuthPage() {
  const { signIn, signUp } = useSession();
  const [mode, setMode] = useState("signin");
  const [f, setF] = useState({ name: "", email: "", password: "", workspace_name: "", website: "" });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
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
      if (signup) await signUp({ name: f.name.trim(), email: f.email.trim(), password: f.password, workspace_name: f.workspace_name.trim(), website: f.website.trim() || undefined });
      else await signIn(f.email.trim(), f.password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <form className="auth-card" onSubmit={submit} noValidate>
        <div className="row" style={{ gap: 10, marginBottom: 4 }}>
          <span className="ws-mark" aria-hidden="true">R</span>
          <span className="brand-name">{t("Replybek")}</span>
        </div>
        <div>
          <h1 className="page-title">{signup ? t("Create your workspace") : t("Sign in")}</h1>
          <p className="page-desc">{signup ? t("Set up an AI support agent for your business.") : t("Welcome back.")}</p>
        </div>
        {error && <Callout tone="bad">{error}</Callout>}
        {signup && <TextInput id="au-name" label={t("Your name")} autoComplete="name" value={f.name} onChange={set("name")} error={errors.name} />}
        <TextInput id="au-email" label={t("Work email")} type="email" autoComplete="email" value={f.email} onChange={set("email")} error={errors.email} />
        <TextInput id="au-pass" label={t("Password")} type="password" autoComplete={signup ? "new-password" : "current-password"} hint={signup ? t("At least 10 characters.") : undefined} value={f.password} onChange={set("password")} error={errors.password} />
        {signup && (
          <>
            <TextInput id="au-biz" label={t("Business name")} placeholder={t("e.g. Northstar Outfitters")} value={f.workspace_name} onChange={set("workspace_name")} error={errors.workspace_name} />
            <TextInput id="au-site" label={t("Website")} optional placeholder="northstar.example" value={f.website} onChange={set("website")} />
          </>
        )}
        <Button variant="primary" type="submit" loading={busy} style={{ width: "100%" }}>
          {signup ? t("Create workspace") : t("Sign in")}
        </Button>
        <p className="helper" style={{ textAlign: "center" }}>
          {signup ? t("Already have an account?") : t("New to Replybek?")}{" "}
          <button
            type="button"
            className="link"
            onClick={() => {
              setMode(signup ? "signin" : "signup");
              setErrors({});
              setError("");
            }}
          >
            {signup ? t("Sign in") : t("Create a workspace")}
          </button>
        </p>
      </form>
      <SegmentedControl className="auth-lang" label={t("Language")} options={LANGS.map((l) => ({ value: l.code, label: l.label }))} value={getLang()} onChange={setLang} />
    </div>
  );
}
