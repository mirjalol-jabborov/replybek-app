// Confirming a new account's email, before any workspace opens. Both products show these pages
// (the CRM imports them as @app): "Check your email" with the 6-digit code, and #/verify/<token>,
// where the link in the email lands.
import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { t } from "../i18n.js";
import { useSession } from "../session.jsx";
import { Button, TextInput, Callout } from "../ui.jsx";
import { BrandMark, Wordmark } from "../components/brand.jsx";
import { AuthToolbar } from "./auth.jsx";
import { Loading } from "./shared.jsx";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
// The code reads large and evenly spaced; 16px or more, so a phone doesn't zoom in.
const CODE_STYLE = { height: 48, fontSize: 22, letterSpacing: "0.32em", fontVariantNumeric: "tabular-nums", textAlign: "center", paddingLeft: "0.32em" };
const EMAIL_STYLE = { fontSize: 16 };
const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function Card({ title, desc, children, onSubmit }) {
  return (
    <div className="auth auth-solo">
      <div className="auth-main">
        <AuthToolbar />
        <form className="auth-card" onSubmit={onSubmit} noValidate>
          <div className="row" style={{ gap: 10, marginBottom: 4 }}>
            <BrandMark size={26} />
            <Wordmark />
          </div>
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

/** Seconds until a new code may be sent, counting down. */
function useWait(until) {
  const left = () => Math.max(0, Math.ceil(((until || 0) - Date.now()) / 1000));
  const [wait, setWait] = useState(left);
  useEffect(() => {
    setWait(left());
    if (left() <= 0) return undefined;
    const timer = setInterval(() => {
      const s = left();
      setWait(s);
      if (s <= 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [until]);
  return wait;
}

/** "Check your email": the signed-in person types the code from the email, or asks for a new one. */
export function VerifyEmailPage() {
  const session = useSession();
  const email = session.verification?.email || session.user.email;
  const wait = useWait(session.verification?.until);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [changing, setChanging] = useState(false);
  const [next, setNext] = useState("");
  const [nextError, setNextError] = useState("");
  const input = useRef(null);

  // A refusal reads as the app's own sentence; "wait" refusals restart the countdown instead.
  const refused = (err) => {
    if (err.body?.code === "resend_wait") return session.codeSent({ email, resend_in: err.body.retry_in });
    setError(t(err.message));
  };

  const confirm = async (typed) => {
    if (busy) return;
    if (typed.length !== 6) return setError(t("Enter the 6-digit code from the email."));
    setBusy("confirm");
    setError("");
    setNotice("");
    try {
      session.accept(await api("/auth/verify", { method: "POST", body: { code: typed } }));
    } catch (err) {
      refused(err);
      setCode("");
      input.current?.focus();
      setBusy("");
    }
  };
  // Digits only; a pasted "123 456" works, and the sixth digit sends the code.
  const type = (e) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
    setCode(digits);
    if (error) setError("");
    if (digits.length === 6 && code.length !== 6) confirm(digits);
  };

  const resend = async () => {
    setBusy("resend");
    setError("");
    setNotice("");
    try {
      session.codeSent(await api("/auth/verify/resend", { method: "POST" }));
      setNotice(t("A new code is on its way to {email}.", { email }));
      setCode("");
      input.current?.focus();
    } catch (err) {
      refused(err);
    } finally {
      setBusy("");
    }
  };

  const change = async (e) => {
    e.preventDefault();
    if (!EMAIL.test(next.trim())) return setNextError(t("Enter a valid email address."));
    setBusy("change");
    setNextError("");
    setError("");
    setNotice("");
    try {
      const answer = await api("/auth/email", { method: "POST", body: { email: next.trim() } });
      session.accept(answer);
      setChanging(false);
      setNext("");
      setCode("");
      setNotice(t("A new code is on its way to {email}.", { email: answer.user.email }));
    } catch (err) {
      if (err.body?.code === "resend_wait") setNextError(t("Too many codes for now. Try again in {time}.", { time: clock(err.body.retry_in) }));
      else setNextError(t(err.message));
    } finally {
      setBusy("");
    }
  };

  if (changing)
    return (
      <Card title={t("Change email")} desc={t("We'll send a new code to the new address.")} onSubmit={change}>
        <TextInput
          id="vf-email"
          label={t("New email")}
          type="email"
          autoComplete="email"
          autoFocus
          value={next}
          onChange={(e) => setNext(e.target.value)}
          error={nextError}
          style={EMAIL_STYLE}
        />
        <Button variant="primary" type="submit" loading={busy === "change"} style={{ width: "100%" }}>
          {t("Send code")}
        </Button>
        <button type="button" className="link helper" style={{ textAlign: "center" }} onClick={() => (setChanging(false), setNextError(""))}>
          {t("Back")}
        </button>
      </Card>
    );

  return (
    <Card title={t("Check your email")} desc={t("We sent a 6-digit code to {email}. Enter it here, or open the link in the email.", { email })} onSubmit={(e) => (e.preventDefault(), confirm(code))}>
      {error && <Callout tone="bad">{error}</Callout>}
      {notice && !error && <Callout tone="ok">{notice}</Callout>}
      <TextInput
        ref={input}
        id="vf-code"
        label={t("Code")}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        autoFocus
        value={code}
        onChange={type}
        aria-invalid={error ? true : undefined}
        style={CODE_STYLE}
      />
      <Button variant="primary" type="submit" loading={busy === "confirm"} style={{ width: "100%" }}>
        {t("Confirm")}
      </Button>
      <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <button type="button" className="link helper" disabled={wait > 0 || Boolean(busy)} onClick={resend} style={wait > 0 ? { color: "var(--fg-3)" } : undefined}>
          {wait > 0 ? t("Send a new code in {time}", { time: clock(wait) }) : t("Send a new code")}
        </button>
        <button type="button" className="link helper" onClick={() => (setChanging(true), setNext(""), setError(""))}>
          {t("Change email")}
        </button>
      </div>
      <p className="helper" style={{ textAlign: "center" }}>
        {t("Not you?")}{" "}
        <button type="button" className="link" onClick={() => session.signOut()}>
          {t("Sign out")}
        </button>
      </p>
    </Card>
  );
}

// A link opened twice at once (a double render) is confirmed once.
const opening = new Map();

/** #/verify/<token>: the link in the email. Confirms, signs in and opens the app. */
export function VerifyLinkPage({ token }) {
  const session = useSession();
  const [fail, setFail] = useState("");
  // Waits for the session's first answer, so it can't land after this sign-in and undo it.
  const ready = session.status !== "loading";
  useEffect(() => {
    if (!ready) return undefined;
    if (!opening.has(token)) opening.set(token, api("/auth/verify/link", { method: "POST", body: { token } }));
    let live = true;
    opening
      .get(token)
      .then((answer) => {
        if (!live) return;
        session.accept(answer);
        window.location.hash = "#/";
      })
      .catch((err) => live && setFail(t(err.message)));
    return () => {
      live = false;
    };
  }, [token, ready]);

  if (!fail) return <Loading label={t("Confirming your email…")} />;
  const confirmed = session.status === "in" && session.user.email_verified;
  return (
    <Card title={t("Confirm your email")}>
      <Callout tone="bad">{fail}</Callout>
      <a className="btn btn-primary" href="#/">
        {confirmed ? t("Open Replybek") : session.status === "in" ? t("Enter the code") : t("Go to sign in")}
      </a>
    </Card>
  );
}
