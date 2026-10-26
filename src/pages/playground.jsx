import { useEffect, useRef, useState } from "react";
import { t, tk, getLang } from "../i18n.js";
import { Icon } from "../icons.jsx";
import { api } from "../api.js";
import { questionLists, questionsFor } from "../suggestions.js";
import { SuggestionEditor } from "./suggestion-editor.jsx";
import { useWorkspace } from "../workspace.jsx";
import { go } from "../hooks.js";
import { TextInput, Textarea, SwitchField, SegmentedControl, Button, PageHeader, Field, EmptyState, StatusBadge, useToast, clock } from "../ui.jsx";

const TONES = [
  {
    value: "professional",
    label: tk("Professional"),
    hint: tk("Clear and formal. Avoids casual phrasing."),
  },
  {
    value: "friendly",
    label: tk("Friendly"),
    hint: tk("Warm and conversational, still to the point."),
  },
  {
    value: "concise",
    label: tk("Concise"),
    hint: tk("The shortest complete answer."),
  },
];
const FIELDS = ["name", "purpose", "instructions", "tone", "welcome", "welcome_i18n", "fallback", "handoff", "suggested_questions_i18n", "suggestion_default_language"];
const welcomes = (a) => ({ uz: a.welcome_i18n?.uz || "", ru: a.welcome_i18n?.ru || "" });
const pick = (a) => Object.fromEntries(FIELDS.map((k) => [k, k === "suggested_questions_i18n" ? questionLists(a) : k === "welcome_i18n" ? welcomes(a) : k === "suggestion_default_language" ? a[k] || "en" : a[k]]));

function SourcesUsed({ sources }) {
  const [open, setOpen] = useState(false);
  if (!sources?.length) return null;
  return (
    <div className="stack-xs" style={{ alignItems: "flex-end", alignSelf: "stretch" }}>
      <button type="button" className="src-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Icon name={open ? "chevronDown" : "chevronRight"} size={13} />
        {t("{count} sources used", { count: sources.length })}
      </button>
      {open && (
        <div className="src-list">
          {sources.map((s, i) => (
            <div className="src-item" key={i}>
              <div className="src-name">
                <Icon name={s.url ? "globe" : "book"} size={13} />
                {s.url ? (
                  <a className="src-link truncate" href={s.url} target="_blank" rel="noopener noreferrer" title={s.url}>
                    {s.name}
                    <Icon name="external" size={11} />
                  </a>
                ) : (
                  <span className="truncate">{s.name}</span>
                )}
              </div>
              {s.heading && <div className="src-head">{s.heading}</div>}
              <div className="src-text">{s.text}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const KIND_NOTE = {
  fallback: tk("fallback"),
  handoff: tk("would hand off to the team"),
  blocked: tk("blocked by moderation"),
};

export function Playground() {
  const { base, activeAgent: agent, agentsLoaded, reloadAgents, openDialog, isAdmin, workspace, summary } = useWorkspace();
  // Before the free trial: a few free test answers, then the trial prompt (the API enforces the same count).
  const billing = workspace.billing || {};
  const freeLeft = billing.access === "none" ? Math.max(0, (billing.preview_messages || 0) - (workspace.usage?.messages || 0)) : null;
  const toast = useToast();
  const [draft, setDraft] = useState(() => (agent ? pick(agent) : null));
  const [draftFor, setDraftFor] = useState(agent?.id);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");
  const scroll = useRef(null);
  const [questionLanguage, setQuestionLanguage] = useState(getLang);

  useEffect(() => {
    if (agent && draftFor !== agent.id) {
      setDraft(pick(agent));
      setDraftFor(agent.id);
      setErrors({});
      setMessages([]);
    } else if (agent && !draft) setDraft(pick(agent));
  }, [agent?.id, agent]);
  useEffect(() => {
    if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [messages.length, typing]);

  if (agentsLoaded && !agent) {
    return (
      <>
        <PageHeader title={t("Playground")} description={t("Test answers before visitors see them.")} />
        <div className="page-body">
          <div className="page-inner">
            <div className="box">
              <EmptyState
                icon="bot"
                title={t("Create an agent first")}
                action={
                  <Button variant="primary" size="sm" onClick={() => openDialog("createAgent")}>
                    {t("Create agent")}
                  </Button>
                }
              >
                {t("Then come back to ask it questions.")}
              </EmptyState>
            </div>
          </div>
        </div>
      </>
    );
  }
  if (!agent || !draft) return <PageHeader title={t("Playground")} />;

  const dirty = FIELDS.some((k) => JSON.stringify(draft[k]) !== JSON.stringify(pick(agent)[k]));
  const set = (k) => (v) => setDraft((d) => ({ ...d, [k]: v && v.target ? v.target.value : v }));

  async function send(q) {
    const question = q.trim();
    if (!question || typing) return;
    if (freeLeft === 0) return openDialog("trial");
    const history = messages
      .filter((m) => m.role === "visitor" || m.role === "ai")
      .map((m) => ({ role: m.role, body: m.text }))
      .slice(-10);
    setMessages((m) => [...m, { role: "visitor", text: question, at: Date.now() }]);
    setText("");
    setTyping(true);
    try {
      const r = await api(`${base}/agents/${agent.id}/test`, {
        method: "POST",
        body: {
          question,
          history,
          draft: {
            name: draft.name,
            instructions: draft.instructions,
            tone: draft.tone,
            fallback: draft.fallback,
            handoff: draft.handoff,
          },
        },
      });
      setMessages((m) => [
        ...m,
        {
          role: "ai",
          text: r.text,
          kind: r.kind,
          sources: r.sources,
          at: Date.now(),
        },
      ]);
      try {
        localStorage.setItem(`replybek.tested.${agent.id}`, new Date().toISOString());
      } catch {
        /* Setup progress is optional. */
      }
    } catch (e) {
      setMessages((m) => [...m, { role: "error", text: e.message, at: Date.now() }]);
    } finally {
      setTyping(false);
      if (freeLeft !== null) summary.reload();
    }
  }

  async function save() {
    const e = {};
    if (!draft.name.trim()) e.name = t("Add an agent name.");
    if (!draft.welcome.trim()) e.welcome = t("Add a welcome message.");
    if (!draft.fallback.trim()) e.fallback = t("Add a fallback message.");
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      const lists = Object.fromEntries(Object.entries(draft.suggested_questions_i18n).map(([lang, questions]) => [lang, questions.map(q => q.trim()).filter(Boolean)]));
      const savedDraft = { ...draft, name: draft.name.trim(), suggested_questions_i18n: lists };
      await api(`${base}/agents/${agent.id}`, {
        method: "PATCH",
        body: { ...savedDraft, suggested_questions: lists[draft.suggestion_default_language] || [] },
      });
      setDraft(savedDraft);
      await reloadAgents();
      toast(t("Agent settings saved"), {
        sub: agent.status === "active" ? t("The website widget uses them now.") : undefined,
      });
    } catch (err) {
      toast(err.message, { tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function setPublished(on) {
    try {
      await api(`${base}/agents/${agent.id}/${on ? "publish" : "unpublish"}`, {
        method: "POST",
      });
      await reloadAgents();
      toast(on ? t("{name} is published", { name: agent.name }) : t("{name} is a draft again", { name: agent.name }));
    } catch (err) {
      toast(err.message, { tone: "error" });
    }
  }

  return (
    <>
      <h1 className="sr-only">{t("Playground")}</h1>
      <div className="page-body pg-scroll" style={{ overflow: "hidden auto" }}>
        <div className="pg">
          <section className="pg-chat" aria-labelledby="pg-chat-title">
            <div className="pg-chat-head">
              <h2 className="section-title" id="pg-chat-title">
                {t("Test conversation")}
              </h2>
              <span className="helper hide-sm">{t("Real answers from {name}'s knowledge · not shown to customers", { name: agent.name })}</span>
              <span className="spacer" />
              <Button size="sm" variant="ghost" icon="reset" onClick={() => setMessages([])} disabled={!messages.length || typing}>
                {t("Reset")}
              </Button>
            </div>
            <div className="transcript" ref={scroll} aria-live="polite">
              <div className="transcript-inner">
                <div className="tmsg ai">
                  <div className="tmeta">
                    <Icon name="bot" size={12} />
                    <span className="who">{draft.name || t("Agent")}</span>
                    <span>{t("Welcome message")}</span>
                  </div>
                  <div className="tbody">{draft.welcome || <span className="muted">{t("No welcome message")}</span>}</div>
                </div>
                {messages.length === 0 && (
                  <div className="stack-xs">
                    <span className="helper">
                      {agent.source_count ? t("Try a question a customer might ask") : t("This agent has no knowledge yet, so it will use its fallback. ")}
                      {!agent.source_count && (
                        <button type="button" className="link" onClick={() => go("knowledge")}>
                          {t("Add knowledge")}
                        </button>
                      )}
                    </span>
                    <div className="chips" aria-label={t("Suggested questions")}>
                      {questionsFor(draft, questionLanguage).filter((q) => q.trim()).map((q, index) => (
                        <button type="button" key={index} className="chip" onClick={() => send(q)}>
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map((m, i) =>
                  m.role === "error" ? (
                    <div className="callout bad" key={i} role="alert">
                      <Icon name="alertCircle" size={15} />
                      <div className="callout-body">{m.text}</div>
                    </div>
                  ) : m.role === "visitor" ? (
                    <div className="tmsg customer" key={i}>
                      <div className="tmeta">
                        <span className="who">{t("You (as a customer)")}</span>
                        <span>{clock(m.at)}</span>
                      </div>
                      <div className="tbody">{m.text}</div>
                    </div>
                  ) : (
                    <div className="tmsg ai" key={i}>
                      <div className="tmeta">
                        <Icon name="bot" size={12} />
                        <span className="who">{draft.name || t("Agent")}</span>
                        <span>{clock(m.at)}</span>
                        {KIND_NOTE[m.kind] && <span>· {t(KIND_NOTE[m.kind])}</span>}
                      </div>
                      <div className="tbody">{m.text}</div>
                      <SourcesUsed sources={m.sources} />
                    </div>
                  ),
                )}
                {typing && (
                  <div className="typing" role="status" aria-label={t("Agent is answering")}>
                    <span />
                    <span />
                    <span />
                  </div>
                )}
              </div>
            </div>
            {freeLeft !== null && (
              <p className={"pg-free" + (freeLeft === 0 ? " out" : "")} role="status">
                {freeLeft > 0 ? t("{count} of {total} free test messages left", { count: freeLeft, total: billing.preview_messages }) : t("Free test messages used")}
                <button type="button" onClick={() => go("settings", "billing")}>
                  {t("Start free trial")}
                </button>
              </p>
            )}
            <form
              className="pg-composer"
              onSubmit={(e) => {
                e.preventDefault();
                send(text);
              }}
            >
              <label htmlFor="pg-input" className="sr-only">
                {t("Test message")}
              </label>
              <textarea
                id="pg-input"
                className="textarea"
                rows={1}
                placeholder={t("Ask a test question")}
                value={text}
                maxLength={2000}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(text);
                  }
                }}
              />
              <Button variant="primary" type="submit" icon="send" disabled={!text.trim() || typing}>
                {t("Send")}
              </Button>
            </form>
          </section>

          <aside className="pg-config" aria-label={t("Agent settings")}>
            <div className="config-heading">
              <Icon name="settings" size={18} />
              <div>
                <h2>{t("Agent settings")}</h2>
                <p>{t("Adjust, test, then save.")}</p>
              </div>
            </div>
            <div className="pg-config-scroll">
              <div className="cfg-sec">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <h2 className="cfg-sec-title">{t("Status")}</h2>
                  <StatusBadge status={agent.status} label={agent.status === "active" ? t("Published") : t("Draft")} />
                </div>
                <p className="helper">
                  {agent.status === "active" ? t("The website widget answers visitors with this agent.") : t("Only you can test it here. Publish to let the website widget answer visitors.")}{" "}
                  {t("{count} sources", { count: agent.source_count })}
                  {agent.source_errors ? `, ${t("{count} failed", { count: agent.source_errors })}` : ""} ·{" "}
                  <button type="button" className="link" onClick={() => go("knowledge")}>
                    {t("Manage")}
                  </button>
                </p>
                {isAdmin && (
                  <Button size="sm" variant={agent.status === "active" ? "secondary" : "primary"} onClick={() => setPublished(agent.status !== "active")}>
                    {agent.status === "active" ? t("Unpublish") : t("Publish agent")}
                  </Button>
                )}
              </div>
              <div className="cfg-sec">
                <h2 className="cfg-sec-title">{t("Identity")}</h2>
                <TextInput id="pg-name" label={t("Agent name")} value={draft.name} onChange={set("name")} error={errors.name} maxLength={80} disabled={!isAdmin} />
                <TextInput
                  id="pg-purpose"
                  label={t("Short description")}
                  hint={t("For your team. Visitors don't see this.")}
                  value={draft.purpose}
                  onChange={set("purpose")}
                  maxLength={500}
                  disabled={!isAdmin}
                />
              </div>
              <div className="cfg-sec">
                <h2 className="cfg-sec-title">{t("Behavior")}</h2>
                <Textarea
                  id="pg-ins"
                  label={t("Instructions")}
                  hint={t("Plain-language guidance the agent follows alongside its knowledge. Test questions use your unsaved changes.")}
                  rows={7}
                  value={draft.instructions}
                  onChange={set("instructions")}
                  maxLength={8000}
                  disabled={!isAdmin}
                />
                <Field id="pg-tone" label={t("Tone")} hint={t(TONES.find((x) => x.value === draft.tone)?.hint)}>
                  <SegmentedControl
                    full
                    label={t("Tone")}
                    value={draft.tone}
                    onChange={set("tone")}
                    options={TONES.map((x) => ({
                      value: x.value,
                      label: t(x.label),
                      disabled: !isAdmin,
                    }))}
                  />
                </Field>
              </div>
              <SuggestionEditor key={agent.id} base={base} agent={agent} value={draft.suggested_questions_i18n} onChange={set("suggested_questions_i18n")} disabled={!isAdmin} language={questionLanguage} onLanguage={setQuestionLanguage} defaultLanguage={draft.suggestion_default_language} onDefaultLanguage={set("suggestion_default_language")} />
              <div className="cfg-sec">
                <h2 className="cfg-sec-title">{t("Messages")}</h2>
                <Textarea
                  id="pg-welcome"
                  label={t("Welcome message")}
                  hint={t("The first message visitors see in the widget.")}
                  rows={2}
                  value={draft.welcome}
                  onChange={set("welcome")}
                  error={errors.welcome}
                  maxLength={500}
                  disabled={!isAdmin}
                />
                {/* The same welcome for pages in Uzbek and Russian; empty shows the one above. */}
                {[
                  ["uz", t("In Uzbek")],
                  ["ru", t("In Russian")],
                ].map(([lang, label], i) => (
                  <Textarea
                    key={lang}
                    id={`pg-welcome-${lang}`}
                    label={label}
                    optional
                    hint={i === 1 ? t("Shown on pages in that language. If empty, visitors see the message above.") : undefined}
                    rows={2}
                    value={draft.welcome_i18n[lang]}
                    onChange={(e) => setDraft((d) => ({ ...d, welcome_i18n: { ...d.welcome_i18n, [lang]: e.target.value } }))}
                    maxLength={500}
                    disabled={!isAdmin}
                  />
                ))}
                <Textarea
                  id="pg-fallback"
                  label={t("Fallback message")}
                  hint={t("Used when the knowledge doesn't answer the question.")}
                  rows={2}
                  value={draft.fallback}
                  onChange={set("fallback")}
                  error={errors.fallback}
                  maxLength={500}
                  disabled={!isAdmin}
                />
              </div>
              <div className="cfg-sec">
                <h2 className="cfg-sec-title">{t("Handoff")}</h2>
                <SwitchField
                  id="pg-handoff"
                  label={t("Offer human handoff")}
                  hint={t("When a visitor asks for a person or reports a damaged item, the conversation moves to the Inbox and the AI pauses.")}
                  checked={draft.handoff}
                  onChange={set("handoff")}
                  disabled={!isAdmin}
                />
              </div>
            </div>
            {isAdmin && (
              <div className="save-bar">
                <span className={"save-state" + (dirty ? " dirty" : "")} aria-live="polite">
                  {dirty ? (
                    <>
                      <span className="dirty-dot" /> {t("Unsaved changes")}
                    </>
                  ) : (
                    <>
                      <Icon name="check" size={13} /> {t("Saved")}
                    </>
                  )}
                </span>
                {dirty && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setDraft(pick(agent));
                      setErrors({});
                    }}
                  >
                    {t("Discard")}
                  </Button>
                )}
                <Button size="sm" variant="primary" onClick={save} disabled={!dirty} loading={saving}>
                  {t("Save changes")}
                </Button>
              </div>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}
