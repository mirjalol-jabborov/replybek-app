import { useEffect, useRef, useState } from "react";
import { t, tk, getLang } from "../i18n.js";
import { Icon } from "../icons.jsx";
import { api, needsTrial } from "../api.js";
import { useSession } from "../session.jsx";
import { useWorkspace } from "../workspace.jsx";
import { go } from "../hooks.js";
import { PLANS } from "../constants.js";
import { Button, TextInput, Textarea, Callout, useToast, fmt, initialsOf } from "../ui.jsx";
import { BrandMark, Wordmark } from "../components/brand.jsx";
import { LogoPicker } from "./widgetPreview.jsx";
import { Snippet } from "./install.jsx";
import { fileSize } from "./knowledge.jsx";
import "../onboarding.css";

const STEPS = [
  { id: "site", label: tk("Website") },
  { id: "brand", label: tk("Brand") },
  { id: "train", label: tk("Training") },
  { id: "test", label: tk("Try it") },
  { id: "live", label: tk("Go live") },
];
const READING = [tk("Opening your website"), tk("Finding your logo and colours"), tk("Finding your pages")];
// The chat colours from replybek.uz; ink is the default.
const COLORS = ["#111215", "#1f3d36", "#2d5bd2", "#a63d17", "#334155", "#0f766e"];
const isHex = (c) => /^#[0-9a-f]{6}$/i.test(c || "");
// Documents instead of a website, for businesses without one yet. Same rules as the Knowledge page.
const DOC_TYPES = /\.(pdf|docx|txt|md|csv)$/i;
const DOC_MAX = 20 * 1024 * 1024;

/** A heading that ends with the brand's blue full stop. */
const Title = ({ children }) => (
  <h1 className="onb-title">
    {children}
    <span className="onb-dot">.</span>
  </h1>
);

/**
 * First-run setup, like Chatbase: the owner enters their website; Replybek reads its name, logo,
 * colours and pages, creates the first agent from them, trains it on the site, lets the owner try it,
 * then starts the free trial (card on Polar) and hands over the embed code.
 */
export function Onboarding() {
  const { user } = useSession();
  const { base, workspace, summary, activeAgent, setActiveAgent, reloadAgents } = useWorkspace();
  const toast = useToast();
  // Back from Polar checkout, or reopened after the agent exists: continue at "Go live".
  const [step, setStep] = useState(activeAgent ? "live" : "site");
  const [url, setUrl] = useState(workspace.website || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(0);
  const [found, setFound] = useState(null);
  const [draft, setDraft] = useState(() => (activeAgent ? fromAgent(activeAgent, workspace) : null));
  const [agent, setAgent] = useState(activeAgent);
  const [docs, setDocs] = useState([]);
  const docsInput = useRef(null);
  // The agent and uploaded files, once saved, so a failed upload can be retried without doubling anything.
  const made = useRef(null);
  const uploaded = useRef(new Set());
  const fromDocs = !found && docs.length > 0;
  const lang = found?.language || activeAgent?.suggestion_default_language || (fromDocs ? getLang() : "en");

  const finish = async () => {
    try {
      await api(`${base}/onboarding/complete`, { method: "POST", body: found ? { website: found.host } : {} });
    } catch {
      // Not worth blocking on: the worst case is seeing onboarding again.
    }
    await summary.reload();
    go("overview");
  };

  const analyze = async (e) => {
    e.preventDefault();
    if (!url.trim()) return setError(t("Enter your website address."));
    setError("");
    setBusy(true);
    setReading(0);
    const timer = setInterval(() => setReading((n) => Math.min(n + 1, READING.length - 1)), 1100);
    try {
      const r = await api(`${base}/onboarding/analyze`, { method: "POST", body: { url: url.trim() } });
      clearInterval(timer);
      setReading(READING.length);
      await new Promise((done) => setTimeout(done, 450)); // let the last tick land
      setFound(r);
      setDocs([]);
      setDraft({ display_name: r.name, agent_name: r.agent_name, accent: r.accent || COLORS[0], logo: r.logo || "", welcome: r.welcome });
      setStep("brand");
    } catch (e) {
      setError(e.message);
    } finally {
      clearInterval(timer);
      setBusy(false);
    }
  };

  const pickDocs = (list) => {
    const picked = [...list];
    const bad = picked.filter((f) => !DOC_TYPES.test(f.name) || f.size > DOC_MAX);
    if (bad.length) return setError(t("{names}: use PDF, DOCX, TXT, MD or CSV up to 20 MB.", { names: bad.map((f) => f.name).join(", ") }));
    if (!picked.length) return;
    const name = workspace.name;
    setError("");
    setFound(null);
    setDocs(picked);
    setDraft({ display_name: name, agent_name: t("{name} AI agent", { name }), accent: COLORS[0], logo: "", welcome: t("Hi! I'm the {name} AI agent. How can I help you today?", { name }) });
    setStep("brand");
  };

  const create = async () => {
    setBusy(true);
    try {
      const name = draft.display_name.trim() || workspace.name;
      const purpose = found ? found.purpose : `Answers visitors' questions about ${name} using its documents.`;
      const a = made.current || (await api(`${base}/agents`, { method: "POST", body: { name: draft.agent_name.trim() || found?.agent_name || t("{name} AI agent", { name }), purpose, welcome: draft.welcome.trim(), tone: "friendly" } }));
      made.current = a;
      const saved = await api(`${base}/agents/${a.id}`, {
        method: "PATCH",
        body: { widget: { accent: draft.accent, display_name: draft.display_name.trim(), logo: draft.logo }, suggestion_default_language: lang },
      });
      if (found) await api(`${base}/agents/${a.id}/sources/website`, { method: "POST", body: { url: found.url, mode: "site", include_paths: found.site?.suggested_paths || [] } });
      else {
        for (const file of docs) {
          if (uploaded.current.has(file)) continue;
          const form = new FormData();
          form.append("file", file);
          await api(`${base}/agents/${a.id}/sources/file`, { method: "POST", form });
          uploaded.current.add(file);
        }
      }
      // A Google sign-up's workspace was named provisionally; the business name from the site is better.
      if (workspace.settings?.auto_named && draft.display_name.trim()) await api(base, { method: "PATCH", body: { name: draft.display_name.trim() } }).catch(() => {});
      setAgent(saved);
      setActiveAgent(saved.id);
      reloadAgents();
      setStep("train");
    } catch (e) {
      toast(e.message, { tone: "error", duration: 8000 });
    } finally {
      setBusy(false);
    }
  };

  const index = STEPS.findIndex((s) => s.id === step);
  const widget = draft && {
    accent: isHex(draft.accent) ? draft.accent : COLORS[0],
    title: draft.display_name.trim() || workspace.name,
    agentName: draft.agent_name.trim() || t("AI agent"),
    welcome: draft.welcome,
    logo: draft.logo,
  };

  return (
    <div className="onb">
      <div className="onb-progress" aria-hidden="true">
        <span style={{ width: `${((index + 1) / STEPS.length) * 100}%` }} />
      </div>
      <header className="onb-top">
        <span className="onb-logo">
          <BrandMark size={26} />
          <Wordmark />
        </span>
        <ol className="onb-steps" aria-label={t("Setup steps")}>
          {STEPS.map((s, i) => (
            <li key={s.id} className={i < index ? "done" : i === index ? "current" : ""} aria-current={i === index ? "step" : undefined}>
              <span className="onb-step-dot">{i < index ? <Icon name="check" size={10} /> : null}</span>
              <span className="onb-step-label">{t(s.label)}</span>
            </li>
          ))}
        </ol>
        <button type="button" className="onb-skip" onClick={finish}>
          {step === "site" || step === "brand" ? t("Skip for now") : t("Finish later")}
        </button>
      </header>

      <main className="onb-stage">
        {step === "site" && (
          <form className="onb-scene onb-hero" key="site" onSubmit={analyze} noValidate>
            <p className="onb-hello">{t("Welcome, {name}", { name: user.name.split(" ")[0] })}</p>
            <Title>{t("Let's build your AI agent")}</Title>
            <p className="onb-lead">{t("Enter your website. We'll do the rest.")}</p>
            <div className={"onb-urlbar" + (error ? " invalid" : "") + (busy ? " busy" : "")}>
              <Icon name="globe" size={18} />
              <input
                id="onb-url"
                type="text"
                inputMode="url"
                autoComplete="url"
                autoCapitalize="none"
                spellCheck="false"
                placeholder="yourbusiness.com"
                value={url}
                onChange={(e) => (setUrl(e.target.value), setError(""))}
                aria-label={t("Your website")}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "onb-url-error" : undefined}
                autoFocus
                disabled={busy}
              />
              <Button variant="primary" type="submit" className="btn-lg" loading={busy} iconRight={busy ? undefined : "arrowRight"}>
                {t("Build my agent")}
              </Button>
            </div>
            <p className="onb-error" id="onb-url-error" role="alert">
              {error}
            </p>
            {/* The reading steps appear in the link's place, out of the flow, so the centred form doesn't jump. */}
            <div className="onb-below">
              <p className="onb-alt" aria-hidden={busy || undefined}>
                <span>{t("No website yet?")}</span>
                <button type="button" className="onb-alt-btn" onClick={() => docsInput.current.click()} disabled={busy}>
                  <Icon name="upload" size={14} />
                  {t("Upload documents")}
                </button>
                <input ref={docsInput} id="onb-docs" type="file" multiple accept=".pdf,.docx,.txt,.md,.csv" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => (pickDocs(e.target.files), (e.target.value = ""))} />
              </p>
              {busy && (
                <ol className="onb-scan" aria-live="polite">
                  {READING.map((label, i) => (
                    <li key={label} className={i < reading ? "done" : i === reading ? "now" : ""}>
                      <span className="onb-tick">{i < reading ? <Icon name="check" size={12} /> : <span className="onb-pulse" />}</span>
                      {t(label)}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </form>
        )}

        {step === "brand" && draft && (
          <div className="onb-scene onb-split" key="brand">
            <div className="onb-copy">
              <p className="onb-hello onb-site">
                {draft.logo ? <img src={draft.logo} alt="" /> : <Icon name={found ? "globe" : "file"} size={14} />}
                {found ? found.host : docs.length === 1 ? docs[0].name : t("{count} documents", { count: fmt(docs.length) })}
              </p>
              <Title>{found ? t("Here's what we found") : t("Make it yours")}</Title>
              <p className="onb-lead">{t("Change anything you like. You can edit it later too.")}</p>
              <div className="onb-fields">
                <div className="onb-field">
                  <span className="onb-label">{t("Logo")}</span>
                  <LogoPicker id="onb-logo" value={draft.logo} name={draft.display_name} onChange={(logo) => setDraft({ ...draft, logo })} onError={(m) => toast(m, { tone: "error" })} />
                </div>
                <TextInput id="onb-name" label={t("Business name")} value={draft.display_name} maxLength={80} onChange={(e) => setDraft({ ...draft, display_name: e.target.value })} />
                <div className="onb-field">
                  <span className="onb-label">{t("Chat colour")}</span>
                  <div className="onb-colors" role="radiogroup" aria-label={t("Chat colour")}>
                    {[...new Set([found?.accent, ...COLORS].filter(Boolean))].map((c) => (
                      <button type="button" key={c} role="radio" aria-checked={draft.accent.toLowerCase() === c} aria-label={c === found?.accent ? t("From your website") : c} title={c === found?.accent ? t("From your website") : c} style={{ "--c": c }} onClick={() => setDraft({ ...draft, accent: c })} />
                    ))}
                    <input id="onb-hex" className="onb-hex" aria-label={t("Custom hex color")} value={draft.accent} maxLength={7} onChange={(e) => setDraft({ ...draft, accent: e.target.value })} aria-invalid={!isHex(draft.accent) || undefined} />
                  </div>
                </div>
                <Textarea id="onb-welcome" label={t("Welcome message")} rows={2} value={draft.welcome} maxLength={500} onChange={(e) => setDraft({ ...draft, welcome: e.target.value })} />
              </div>
              {!found ? (
                <ul className="onb-docs" aria-label={t("Documents to learn from")}>
                  {docs.map((f) => (
                    <li key={f.name}>
                      <Icon name="file" size={15} />
                      <span className="truncate">{f.name}</span>
                      <span className="num">{fileSize(f.size)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
              <p className="onb-knowledge">
                <Icon name="book" size={15} />
                {found.site?.total
                  ? found.site.total > found.site.page_limit
                    ? t("{count} pages found. Your plan learns from the first {limit}.", { count: fmt(found.site.total), limit: fmt(found.site.page_limit) })
                    : t("{count} pages found in your sitemap.", { count: fmt(found.site.total) })
                  : t("We'll follow links from your home page, up to {limit} pages.", { limit: fmt(found.site?.page_limit || 500) })}
              </p>
              )}
              <div className="onb-actions">
                <Button variant="primary" className="btn-lg" onClick={create} loading={busy} disabled={!draft.welcome.trim() || !isHex(draft.accent) || (!found && !fromDocs)} iconRight="arrowRight">
                  {t("Create my agent")}
                </Button>
                <button type="button" className="onb-back" onClick={() => (setStep("site"), setDocs([]))} disabled={busy || Boolean(made.current)}>
                  {t("Back")}
                </button>
              </div>
            </div>
            <div className="onb-device">
              <ChatWidget {...widget} />
            </div>
          </div>
        )}

        {step === "train" && agent && <Training key="train" base={base} agent={agent} language={lang} host={found?.host} widget={widget} fromDocs={fromDocs} onDone={(a) => (setAgent(a), setStep("test"))} />}

        {step === "test" && agent && (
          <div className="onb-scene onb-split" key="test">
            <div className="onb-copy">
              <Title>{t("Try your agent")}</Title>
              <p className="onb-lead">{!fromDocs ? t("Ask what a customer would ask. It answers only from your website.") : t("Ask what a customer would ask. It answers only from your documents.")}</p>
              <ul className="onb-points">
                <li>
                  <strong>{t("Shows its sources")}</strong>
                  <span>{t("Answers link to the page they came from.")}</span>
                </li>
                <li>
                  <strong>{t("Knows its limits")}</strong>
                  <span>{t("When it doesn't know, it says so and offers a person.")}</span>
                </li>
                <li>
                  <strong>{t("Keeps learning")}</strong>
                  <span>{t("You can add files, Q&A and more knowledge later.")}</span>
                </li>
              </ul>
              <div className="onb-actions">
                <Button variant="primary" className="btn-lg" onClick={() => setStep("live")} iconRight="arrowRight">
                  {t("Looks good")}
                </Button>
              </div>
            </div>
            <div className="onb-device">
              <LiveChat base={base} agent={agent} widget={widget} language={lang} onTrial={() => setStep("live")} />
            </div>
          </div>
        )}

        {step === "live" && agent && <GoLive key="live" base={base} agent={agent} host={found?.host} onFinish={finish} />}
      </main>
    </div>
  );
}

function fromAgent(agent, workspace) {
  return {
    display_name: agent.widget?.display_name || workspace.name,
    agent_name: agent.name,
    accent: agent.widget?.accent || COLORS[0],
    logo: agent.widget?.logo || "",
    welcome: agent.welcome,
  };
}
const questionsOf = (agent, lang) => agent?.suggested_questions_i18n?.[lang] || agent?.suggested_questions || [];

/**
 * The chat widget as visitors will see it (replybek.uz's widget design). Live when `onSend` is given;
 * `learning` shows it thinking while the agent trains.
 */
function ChatWidget({ accent, title, agentName, welcome, logo, suggestions = [], messages = [], typing = false, learning = false, learningText, onSend, onTrial, note }) {
  const [text, setText] = useState("");
  const body = useRef(null);
  useEffect(() => {
    if (body.current) body.current.scrollTop = body.current.scrollHeight;
  }, [messages.length, typing]);
  const live = Boolean(onSend);
  const send = (q) => {
    if (!q.trim() || typing) return;
    onSend(q.trim());
    setText("");
  };
  return (
    <section className="owg" style={{ "--w": accent }} aria-label={live ? t("Chat with your agent") : t("Widget preview")}>
      <header className="owg-head">
        <span className={"owg-av" + (logo ? " has-logo" : "")} aria-hidden="true">
          {logo ? <img src={logo} alt="" /> : initialsOf(title).slice(0, 1)}
        </span>
        <div className="owg-who">
          <div className="owg-name">{title}</div>
          <div className="owg-st">{learning ? learningText || t("Learning your website…") : agentName}</div>
        </div>
      </header>
      <div className="owg-note">{t("Answers are generated by AI. A person can help if you need one.")}</div>
      <div className="owg-body" ref={body} aria-live={live ? "polite" : undefined}>
        <div className="bub ai">{welcome || "…"}</div>
        {learning && (
          <>
            <div className="bub sk me" />
            <div className="bub sk ai" />
            <div className="bub sk ai short" />
          </>
        )}
        {!learning && suggestions.length > 0 && messages.length === 0 && (
          <div className="owg-chips">
            {suggestions.map((q, i) =>
              live ? (
                <button type="button" className="chip" key={i} onClick={() => send(q)} style={{ "--i": i }}>
                  {q}
                </button>
              ) : (
                <span className="chip" key={i} style={{ "--i": i }}>
                  {q}
                </span>
              )
            )}
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "error" ? (
            <div className="owg-alert" key={i} role="alert">
              {m.text}
              {m.trial && onTrial && (
                <button type="button" className="owg-alert-btn" onClick={onTrial}>
                  {t("Start free trial")}
                </button>
              )}
            </div>
          ) : (
            <div className={"bub " + (m.role === "visitor" ? "me" : "ai")} key={i}>
              {m.text}
            </div>
          )
        )}
        {typing && (
          <div className="owg-typing" role="status" aria-label={t("Agent is answering")}>
            <i />
            <i />
            <i />
          </div>
        )}
      </div>
      <div className="owg-foot">
        <form
          className="owg-input"
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
        >
          <input disabled={!live} placeholder={t("Ask a question")} aria-label={live ? t("Message") : t("Message (preview)")} value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} />
          <button type="submit" aria-label={t("Send")} disabled={!live || !text.trim() || typing}>
            <Icon name="send" size={15} />
          </button>
        </form>
        {note && <div className="owg-free">{note}</div>}
        <div className="owg-links">
          <span>
            <Icon name="headset" size={13} /> {t("Talk to a person")}
          </span>
          <span>{t("Powered by Replybek")}</span>
        </div>
      </div>
    </section>
  );
}

/** Waits for the website (or the uploaded documents) to be learned, then writes starter questions from it. */
function Training({ base, agent, language, host, widget, fromDocs, onDone }) {
  const [source, setSource] = useState(null);
  const [files, setFiles] = useState({ done: 0, total: 0 });
  const [stage, setStage] = useState("reading"); // reading → questions → ready | error
  const started = useRef(false);
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const list = await api(`${base}/agents/${agent.id}/sources`);
        if (stop) return;
        let s = list.find((x) => x.type === "website") || list[0];
        if (fromDocs && list.length) {
          // Documents: done when none is still being read; it worked if at least one was learned.
          const settled = list.filter((x) => x.status === "ready" || x.status === "error");
          const ready = list.find((x) => x.status === "ready");
          setFiles({ done: settled.length, total: list.length });
          s = settled.length < list.length ? { status: "processing" } : ready || list.find((x) => x.status === "error");
        }
        setSource(s);
        if (s?.status === "ready" && !started.current) {
          started.current = true;
          setStage("questions");
          let questions = [];
          try {
            questions = (await api(`${base}/agents/${agent.id}/suggestions/generate`, { method: "POST", body: { language } })).questions;
          } catch {
            // Starter questions are a nicety; the agent works without them.
          }
          const saved = questions.length
            ? await api(`${base}/agents/${agent.id}`, { method: "PATCH", body: { suggested_questions: questions, suggested_questions_i18n: { [language]: questions } } }).catch(() => agent)
            : agent;
          if (!stop) (setStage("ready"), setTimeout(() => !stop && onDone(saved), 1100));
          return;
        }
        if (s?.status === "error") return setStage("error");
      } catch {
        // A failed poll is retried on the next tick.
      }
      if (!stop) setTimeout(tick, 1500);
    };
    tick();
    return () => {
      stop = true;
    };
  }, [agent.id]);
  const done = fromDocs ? files.done : source?.progress?.done || 0;
  const total = fromDocs ? files.total : source?.progress?.total || 0;
  const pct = stage === "ready" ? 100 : stage === "questions" ? 92 : total ? Math.max(6, Math.round((done / total) * 85)) : 6;
  return (
    <div className="onb-scene onb-split">
      <div className="onb-copy">
        <Title>{stage === "ready" ? t("Your agent is ready") : t("Training your agent")}</Title>
        <p className="onb-lead">{fromDocs ? t("It's reading your documents and learning your products, prices and policies.") : t("It's reading {host} and learning your products, prices and policies.", { host: host || source?.name || t("your website") })}</p>
        <div className="onb-meter" aria-live="polite">
          <div className="onb-pct">
            <span className="num">{pct}</span>%
          </div>
          <div className="onb-bar" role="progressbar" aria-label={t("Training progress")} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: pct + "%" }} />
          </div>
          <ol className="onb-scan">
            <li className={stage === "reading" ? "now" : "done"}>
              <span className="onb-tick">{stage === "reading" ? <span className="onb-pulse" /> : <Icon name="check" size={12} />}</span>
              {fromDocs
                ? stage === "reading"
                  ? t("Reading documents: {done} of {total}", { done: fmt(done), total: fmt(total) })
                  : t("Learned from {count} documents", { count: fmt(total) })
                : total
                  ? t("Reading pages: {done} of {total}", { done: fmt(done), total: fmt(total) })
                  : stage === "reading"
                    ? t("Finding pages")
                    : t("Learned from {count} pages", { count: fmt(source?.pages || 0) })}
            </li>
            <li className={stage === "questions" ? "now" : stage === "ready" ? "done" : ""}>
              <span className="onb-tick">{stage === "ready" ? <Icon name="check" size={12} /> : <span className="onb-pulse" />}</span>
              {t("Writing starter questions")}
            </li>
          </ol>
        </div>
        {stage === "error" && (
          <Callout tone="bad" action={<Button size="sm" onClick={() => onDone(agent)}>{t("Continue anyway")}</Button>}>
            {source?.error || (fromDocs ? t("We couldn't read your documents.") : t("We couldn't read your website."))} {t("You can add knowledge later from the Knowledge page.")}
          </Callout>
        )}
        {stage === "reading" && (
          <div className="onb-actions">
            <button type="button" className="onb-back" onClick={() => onDone(agent)}>
              {t("Continue while it learns")}
            </button>
          </div>
        )}
      </div>
      <div className="onb-device">{widget && <ChatWidget {...widget} learning={stage !== "ready"} learningText={fromDocs ? t("Learning your documents…") : undefined} />}</div>
    </div>
  );
}

/** The new agent's real answers, in its own branded widget. Before the trial only a few are free. */
function LiveChat({ base, agent, widget, language, onTrial }) {
  const { workspace, summary } = useWorkspace();
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState(false);
  const billing = workspace.billing || {};
  const freeLeft = billing.access === "none" ? Math.max(0, (billing.preview_messages || 0) - (workspace.usage?.messages || 0)) : null;
  const send = async (question) => {
    if (freeLeft === 0) return setMessages((m) => [...m, { role: "error", trial: true, text: t("You've used the free test messages. Start your 7-day free trial to keep testing.") }]);
    const history = messages.filter((m) => m.role !== "error").map((m) => ({ role: m.role, body: m.text })).slice(-20);
    setMessages((m) => [...m, { role: "visitor", text: question }]);
    setTyping(true);
    try {
      const r = await api(`${base}/agents/${agent.id}/test`, { method: "POST", body: { question, history } });
      setMessages((m) => [...m, { role: "ai", text: r.text }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "error", trial: needsTrial(e), text: e.message }]);
    } finally {
      setTyping(false);
      if (freeLeft !== null) summary.reload();
    }
  };
  return (
    <ChatWidget
      {...widget}
      suggestions={questionsOf(agent, language)}
      messages={messages}
      typing={typing}
      onSend={send}
      onTrial={onTrial}
      note={freeLeft !== null && freeLeft > 0 ? t("{count} of {total} free test messages left", { count: freeLeft, total: billing.preview_messages }) : null}
    />
  );
}

/** Start the free trial (card on Polar) if billing needs it, then publish and show the embed code. */
function GoLive({ base, agent, host, onFinish }) {
  const { workspace, summary, role, reloadAgents } = useWorkspace();
  const toast = useToast();
  const billing = workspace.billing || {};
  const needsTrial = billing.provider === "polar" && !["trial", "paid"].includes(billing.access);
  const [later, setLater] = useState(false);
  const [starting, setStarting] = useState(null);
  const [published, setPublished] = useState(agent);
  // Back from Polar: the webhook usually lands within seconds.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("checkout") !== "done") return;
    window.history.replaceState(null, "", window.location.pathname + window.location.hash);
    toast(t("Card added on Polar"), { sub: t("Your free trial starts as soon as Polar confirms it.") });
    let n = 0;
    const timer = setInterval(() => (++n >= 8 ? clearInterval(timer) : summary.reload()), 2000);
    return () => clearInterval(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const showInstall = !needsTrial || later;
  useEffect(() => {
    if (!showInstall || published.status === "active") return;
    api(`${base}/agents/${agent.id}/publish`, { method: "POST" })
      .then((a) => (setPublished(a?.public_key ? a : { ...published, status: "active" }), reloadAgents()))
      .catch((e) => toast(e.message, { tone: "error" }));
  }, [showInstall]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async (plan) => {
    setStarting(plan.id);
    try {
      const { url } = await api(`${base}/billing/checkout`, { method: "POST", body: { plan: plan.id, return_to: "onboarding" } });
      window.location.assign(url);
    } catch (e) {
      toast(e.message, { tone: "error", duration: 8000 });
      setStarting(null);
    }
  };

  if (!showInstall) {
    return (
      <div className="onb-scene onb-wide" key="trial">
        <Title>{t("Start your 7-day free trial")}</Title>
        <p className="onb-lead">{t("Add a card on Polar. Nothing is charged for 7 days, and you can cancel any time.")}</p>
        {role !== "owner" && <Callout tone="info">{t("Only the workspace owner can start the trial.")}</Callout>}
        <div className="onb-plans">
          {PLANS.map((p) => (
            <div className={"onb-plan" + (p.id === "growth" ? " featured" : "")} key={p.id}>
              <div className="onb-plan-name">
                {p.name}
                {p.id === "growth" && <span className="onb-pill">{t("Recommended")}</span>}
              </div>
              <div className="onb-price">
                ${p.price}
                <small> {t("/ month")}</small>
              </div>
              <span className="onb-free">{t("Free for 7 days")}</span>
              <ul>
                {p.features.slice(0, 4).map((x) => (
                  <li key={x}>
                    <Icon name="check" size={14} />
                    {t(x)}
                  </li>
                ))}
              </ul>
              <Button variant={p.id === "growth" ? "primary" : "secondary"} onClick={() => start(p)} loading={starting === p.id} disabled={Boolean(starting) || role !== "owner"}>
                {t("Start free trial")}
              </Button>
            </div>
          ))}
        </div>
        {/* Kept out of the way: starting the trial is the step we want people to take. */}
        <details className="onb-more">
          <summary>
            {t("Other options")}
            <Icon name="chevronDown" size={14} />
          </summary>
          <div className="onb-more-body">
            <p>{t("You can look around first. Your agent won't answer visitors and the workspace stays read-only until the trial starts.")}</p>
            <button type="button" className="onb-back" onClick={() => setLater(true)}>
              {t("I'll start the trial later")}
            </button>
          </div>
        </details>
      </div>
    );
  }
  return (
    <div className="onb-scene onb-center" key="install">
      <span className="onb-success" aria-hidden="true">
        <svg viewBox="0 0 52 52">
          <circle cx="26" cy="26" r="24" />
          <path d="M15 27l7 7 15-16" />
        </svg>
      </span>
      <Title>{t("Add the chat to your website")}</Title>
      <p className="onb-lead">{t("Paste this code before the closing </body> tag on {host}. The chat appears in the corner of every page.", { host: host || t("your website") })}</p>
      {billing.access === "trial" && <Callout tone="ok">{t("Your free trial is running. Your agent answers visitors as soon as the code is on your site.")}</Callout>}
      {needsTrial && <Callout tone="warn">{t("Your agent won't answer visitors until you start the free trial in Settings → Plan & billing.")}</Callout>}
      <div className="onb-code">
        <Snippet agent={published} />
      </div>
      <div className="onb-actions center">
        <Button variant="primary" className="btn-lg" onClick={onFinish} iconRight="arrowRight">
          {t("Go to my dashboard")}
        </Button>
      </div>
    </div>
  );
}
