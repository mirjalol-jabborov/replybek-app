import { useEffect, useRef, useState } from "react";
import { t, tk, locale } from "../i18n.js";
import { Icon } from "../icons.jsx";
import { api, apiUrl } from "../api.js";
import { useWorkspace } from "../workspace.jsx";
import { useResource, go } from "../hooks.js";
import { onTyping } from "../live.js";
import { Avatar, StatusBadge, Drawer, EmptyState, Sim, Button, IconButton, TextInput, Tabs, tabPanel, Select, ActionMenu, shortAge, timeAgo, clock, useToast, initialsOf, toneOf } from "../ui.jsx";
import { AgentSelect, Loading } from "./shared.jsx";

const VIEWS = [
  { value: "all", label: tk("All"), test: () => true },
  { value: "needs_human", label: tk("Needs human"), test: (c) => c.status === "needs_human" },
  { value: "ai", label: tk("AI"), test: (c) => c.status === "ai" },
  { value: "mine", label: tk("Mine"), test: (c, me) => c.assignee_id === me && c.status !== "resolved" },
  { value: "resolved", label: tk("Resolved"), test: (c) => c.status === "resolved" },
];
const wide = () => window.matchMedia("(min-width: 1261px)").matches;
const firstName = (n = "") => n.split(" ")[0];
const visitorName = (c) => c.visitor?.name || t("Website visitor");

// Files in messages: photos show inline, documents download. Up to 10 MB; the server checks the bytes.
const MAX_FILE = 10 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,application/pdf,.pdf,.txt,.csv,.docx,.xlsx";
const okFile = (f) => /^image\/(jpeg|png|webp|gif)$/.test(f.type) || /\.(jpe?g|png|webp|gif|pdf|txt|csv|docx|xlsx)$/i.test(f.name);
const sizeText = (n) => (n < 1024 * 1024 ? t("{n} KB", { n: Math.max(1, Math.round(n / 1024)) }) : t("{n} MB", { n: (n / 1048576).toFixed(1) }));

function Attachments({ files }) {
  const { base } = useWorkspace();
  if (!files?.length) return null;
  return (
    <div className="tfiles">
      {files.map((a) => {
        const href = apiUrl(`${base}/files/${a.id}`);
        return a.type.startsWith("image/") ? (
          <a key={a.id} className="tfile-img" href={href} target="_blank" rel="noopener noreferrer" aria-label={t("Open {name}", { name: a.name })}>
            <img src={href} alt={a.name} loading="lazy" />
          </a>
        ) : (
          <a key={a.id} className="tfile-doc" href={href} download={a.name}>
            <span className="tfile-ic">
              <Icon name="file" size={16} />
            </span>
            <span className="tfile-name">
              <b>{a.name}</b>
              <small>{sizeText(a.size)}</small>
            </span>
          </a>
        );
      })}
    </div>
  );
}

/** Sources open/closed under an AI message. */
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

// ───── Is the visitor there? ─────
// The widget checks in every 30 s while its page is open, so a check-in in the last 75 s means
// they're in the chat now. Ages are measured on the server's clock: `skew` is this browser's
// clock minus the server's, updated whenever conversations load.
let skew = 0;
const HERE_MS = 75000;
const seenAgo = (c) => (c.visitor_seen_at ? Date.now() - skew - Date.parse(c.visitor_seen_at) : Infinity);
function presenceOf(c) {
  if (c.left_at) return { state: "left", label: c.continued_in ? t("Started a new chat") : t("Left the chat") };
  if (seenAgo(c) < HERE_MS) return { state: "here", label: t("In the chat now") };
  if (c.visitor_seen_at) return { state: "away", label: t("Last seen {ago}", { ago: timeAgo(Date.parse(c.visitor_seen_at) + skew) }) };
  return null;
}

/** The visitor's avatar, with a green dot while they're in the chat. */
function VisitorAvatar({ c, size }) {
  const here = presenceOf(c)?.state === "here";
  return (
    <span className="av-wrap">
      <Avatar initials={initialsOf(visitorName(c))} tone={toneOf(c.id)} size={size} />
      {here && <span className="online-dot" title={t("In the chat now")} />}
    </span>
  );
}

// System messages with fixed wording are translated; ones with names in them stay as written.
tk("Visitor started a new chat");
tk("AI handed off to the team");
tk("Visitor asked for a teammate");
tk("Unassigned");

function ConversationRow({ c, selected, me, typing }) {
  const { memberName, members } = useWorkspace();
  const last = c.last_message;
  const who = !last ? "" : last.role === "ai" ? `${t("AI")}: ` : last.role === "human" ? (last.author_id === me ? `${t("You")}: ` : `${firstName(memberName(last.author_id))}: `) : "";
  const assignee = c.assignee_id && members.find((m) => m.id === c.assignee_id);
  return (
    <button type="button" className={"ib-row" + (c.unread ? " unread" : "")} aria-current={selected ? "true" : undefined} onClick={() => go("inbox", c.id)}>
      {c.unread && <span className="unread-dot" />}
      <VisitorAvatar c={c} />
      <span style={{ minWidth: 0 }}>
        <span className="ib-top">
          <span className="ib-name truncate">
            {visitorName(c)}
            {c.unread && <span className="sr-only">{t(", unread")}</span>}
          </span>
          <span className="ib-time">{shortAge(c.last_message_at)}</span>
        </span>
        <span className={"ib-prev truncate" + (typing ? " typing-now" : "")} style={{ display: "block" }}>
          {typing ? t("Typing…") : last ? `${who}${last.body || (last.files ? t("Sent a file") : "")}` : t("No messages yet")}
        </span>
        <span className="ib-foot">
          <StatusBadge status={c.status} />
          {assignee && (
            <span className="ib-assignee">
              <Avatar initials={initialsOf(assignee.name)} tone={toneOf(assignee.id)} size="xs" />
              <span className="truncate">{assignee.id === me ? t("You") : firstName(assignee.name)}</span>
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

function Transcript({ c, onHideSummary, showSummary }) {
  const { agents, memberName } = useWorkspace();
  const agent = agents.find((a) => a.id === c.agent_id);
  const ref = useRef(null);
  const count = c.messages.length;
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [c.id, count, showSummary]);
  let prev = null;
  return (
    <div className="transcript" ref={ref} tabIndex={0} aria-label={t("Conversation with {name}", { name: visitorName(c) })}>
      <div className="transcript-inner">
        {showSummary && c.summary?.length > 0 && (
          <div className="tsummary">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="row" style={{ gap: 8 }}>
                <span className="strong">{t("Summary so far")}</span>
                <Sim>{t("Written by AI")}</Sim>
              </span>
              <IconButton icon="x" size="sm" label={t("Hide summary")} onClick={onHideSummary} />
            </div>
            <ul>
              {c.summary.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        )}
        {count === 0 && <p className="helper">{t("No messages yet.")}</p>}
        {c.messages.map((m) => {
          const at = new Date(m.created_at).getTime();
          const author = m.role + (m.author_id || "");
          const grouped = prev && prev.author === author && at - prev.at < 5 * 60000 && !["system", "note"].includes(m.role);
          prev = { author, at };
          if (m.role === "system")
            return (
              <div className="tevent" key={m.id}>
                {t(m.body)} · {clock(m.created_at)}
              </div>
            );
          if (m.role === "note")
            return (
              <div className="tnote" key={m.id}>
                <div className="tmeta">
                  <Icon name="lock" size={12} />
                  <span className="who">{t("Internal note · {name}", { name: memberName(m.author_id) })}</span>
                  <span>{clock(m.created_at)}</span>
                </div>
                {m.body}
                <Attachments files={m.attachments} />
              </div>
            );
          const cls = m.role === "visitor" ? "customer" : m.role;
          const name = m.role === "visitor" ? visitorName(c) : m.role === "ai" ? `${t("AI")} · ${agent?.name || t("Agent")}` : memberName(m.author_id);
          return (
            <div className={"tmsg " + cls} key={m.id}>
              {!grouped && (
                <div className="tmeta">
                  {m.role === "ai" && <Icon name="bot" size={12} />}
                  <span className="who">{name}</span>
                  <span>{clock(m.created_at)}</span>
                  {m.role === "ai" && m.kind === "fallback" && <span>{t("· fallback")}</span>}
                </div>
              )}
              {m.body && <div className="tbody">{m.body}</div>}
              <Attachments files={m.attachments} />
              {m.role === "ai" && <SourcesUsed sources={m.sources} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Handling({ c, me }) {
  const { memberName } = useWorkspace();
  if (c.status === "ai")
    return (
      <span className="handling ai">
        <span className="dot" />
        {t("AI replying")}
      </span>
    );
  if (c.status === "needs_human")
    return (
      <span className="handling waiting">
        <Icon name="pause" size={12} />
        {t("Waiting for a teammate")}
      </span>
    );
  if (c.status === "human")
    return (
      <span className="handling paused">
        <Icon name="pause" size={12} />
        {t("AI paused")}<span className="hide-sm"> · {c.assignee_id === me ? t("you're replying") : t("{name} replying", { name: firstName(memberName(c.assignee_id)) })}</span>
      </span>
    );
  return (
    <span className="handling done">
      <Icon name="checkCircle" size={13} />
      {t("Resolved")}
    </span>
  );
}

function Composer({ c, me, forceNote, onCancelNote, act }) {
  const { base } = useWorkspace();
  const canReply = c.status === "human" && c.assignee_id === me;
  const typedAt = useRef(0);
  const [mode, setMode] = useState(canReply && !forceNote ? "reply" : "note");
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  const picker = useRef(null);
  const toast = useToast();
  const choose = (f) => {
    if (!f) return;
    if (!okFile(f)) return toast(t("Send a photo, a PDF or a document (TXT, CSV, DOCX, XLSX)."), { tone: "error" });
    if (f.size > MAX_FILE) return toast(t("Files can be up to 10 MB."), { tone: "error" });
    setFile(f);
    ref.current && ref.current.focus();
  };
  useEffect(() => {
    setMode(canReply && !forceNote ? "reply" : "note");
  }, [c.id, canReply]);
  useEffect(() => {
    setText("");
    setFile(null);
  }, [c.id]);
  useEffect(() => {
    ref.current && ref.current.focus();
  }, [c.id, canReply, forceNote]);
  const note = mode === "note";
  const submit = async () => {
    const body = text.trim();
    if ((!body && !file) || busy) return;
    setBusy(true);
    let payload = { text: body };
    if (file) {
      payload = new FormData();
      payload.append("text", body);
      payload.append("file", file, file.name);
    }
    const ok = await act(note ? "note" : "reply", payload, note ? t("Note added") : null);
    setBusy(false);
    if (ok) {
      setText("");
      setFile(null);
      if (note && !canReply) onCancelNote && onCancelNote();
    }
  };
  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className={"comp-box" + (note ? " note" : "")}>
        <div className="comp-head" role="tablist" aria-label={t("Message type")}>
          <button type="button" role="tab" aria-selected={!note} disabled={!canReply} title={canReply ? undefined : t("Take over the conversation to reply")} onClick={() => setMode("reply")}>
            {t("Reply")}
          </button>
          <button type="button" role="tab" className="note-tab" aria-selected={note} onClick={() => setMode("note")}>
            <Icon name="lock" size={12} /> {t("Internal note")}
          </button>
          {note && <span className="comp-hint">{t("Only your team sees this")}</span>}
        </div>
        <label htmlFor="ib-compose" className="sr-only">
          {note ? t("Internal note") : t("Reply to {name}", { name: visitorName(c) })}
        </label>
        <textarea
          id="ib-compose"
          ref={ref}
          className="comp-input"
          rows={3}
          placeholder={note ? t("Write a note for your team…") : t("Reply to {name}…", { name: firstName(visitorName(c)) })}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            // The visitor sees "<name> is typing" while you write a reply (never a note): at most every 3 s.
            if (!note && canReply && e.target.value.trim() && Date.now() - typedAt.current > 3000) {
              typedAt.current = Date.now();
              api(`${base}/conversations/${c.id}/typing`, { method: "POST" }).catch(() => {});
            }
          }}
          onPaste={(e) => {
            const f = e.clipboardData?.files?.[0];
            if (f) {
              e.preventDefault();
              choose(f);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        {file && (
          <div className="comp-file">
            <Icon name="file" size={14} />
            <span className="truncate">{file.name}</span>
            <span className="helper">{sizeText(file.size)}</span>
            <IconButton icon="x" size="sm" label={t("Remove file")} onClick={() => setFile(null)} />
          </div>
        )}
        <div className="comp-foot">
          <input
            ref={picker}
            type="file"
            accept={ACCEPT}
            hidden
            onChange={(e) => {
              choose(e.target.files[0]);
              e.target.value = "";
            }}
          />
          <IconButton icon="clip" size="sm" label={t("Attach a file")} onClick={() => picker.current.click()} />
          <span className="helper">{note ? t("Enter to add · Shift+Enter for a new line") : t("Sent to the visitor's chat · Enter to send")}</span>
          {!canReply && (
            <Button size="sm" variant="ghost" onClick={onCancelNote}>
              {t("Cancel")}
            </Button>
          )}
          <Button size="sm" variant="primary" type="submit" disabled={!text.trim() && !file} loading={busy}>
            {note ? t("Add note") : t("Send reply")}
          </Button>
        </div>
      </div>
    </form>
  );
}

function BottomBar({ c, me, act }) {
  const { memberName, agents } = useWorkspace();
  const [noting, setNoting] = useState(false);
  useEffect(() => setNoting(false), [c.id, c.status]);
  const canReply = c.status === "human" && c.assignee_id === me;
  if (canReply || noting) return <Composer c={c} me={me} forceNote={noting} onCancelNote={() => setNoting(false)} act={act} />;
  const take = () => act("takeover", null, t("You're handling this conversation"), t("AI replies are paused until you hand it back."));
  let text;
  let action;
  if (c.status === "ai") {
    text = (
      <>
        <strong>{t("AI is replying")}</strong> {t("with {agent}. Take over to answer yourself; the AI pauses until you hand it back.", { agent: agents.find((a) => a.id === c.agent_id)?.name || t("the agent") })}
      </>
    );
    action = (
      <Button variant="primary" icon="hand" onClick={take}>
        {t("Take over")}
      </Button>
    );
  } else if (c.status === "needs_human") {
    text = (
      <>
        <strong>{t("{name} is waiting for a teammate.", { name: firstName(visitorName(c)) })}</strong> {t("The AI paused after the handoff.")}
      </>
    );
    action = (
      <Button variant="primary" icon="hand" onClick={take}>
        {t("Take over")}
      </Button>
    );
  } else if (c.status === "human") {
    text = (
      <>
        <strong>{t("{name} is replying.", { name: memberName(c.assignee_id) })}</strong> {t("Take over to reply yourself.")}
      </>
    );
    action = <Button onClick={take}>{t("Take over")}</Button>;
  } else {
    text = (
      <>
        <strong>{c.resolved_by ? t("Resolved by {name}.", { name: c.resolved_by }) : t("Resolved.")}</strong> {t("Reopen it to continue.")}
      </>
    );
    action = <Button onClick={() => act("reopen")}>{t("Reopen")}</Button>;
  }
  return (
    <div className="takeover-bar">
      <div className="tb-text">{text}</div>
      <Button variant="ghost" icon="note" onClick={() => setNoting(true)}>
        {t("Add note")}
      </Button>
      {action}
    </div>
  );
}

function Details({ c, me, act }) {
  const { agents, members } = useWorkspace();
  const agent = agents.find((a) => a.id === c.agent_id);
  const cited = [...new Map(c.messages.flatMap((m) => m.sources || []).map((s) => [s.source_id, s])).values()];
  const v = c.visitor || {};
  return (
    <>
      <div className="side-sec">
        <div className="row" style={{ gap: 10 }}>
          <VisitorAvatar c={c} size="lg" />
          <div style={{ minWidth: 0 }}>
            <div className="strong truncate">{visitorName(c)}</div>
            <div className="helper truncate">{v.email || t("No email given")}</div>
          </div>
        </div>
        <dl className="dl">
          {presenceOf(c) && (
            <>
              <dt>{t("Visitor")}</dt>
              <dd className={"presence " + presenceOf(c).state}>{presenceOf(c).label}</dd>
            </>
          )}
          {c.continued_in && (
            <>
              <dt>{t("New chat")}</dt>
              <dd>
                <button type="button" className="link" onClick={() => go("inbox", c.continued_in)}>
                  {t("Open")}
                </button>
              </dd>
            </>
          )}
          {c.previous_id && (
            <>
              <dt>{t("Earlier chat")}</dt>
              <dd>
                <button type="button" className="link" onClick={() => go("inbox", c.previous_id)}>
                  {t("Open")}
                </button>
              </dd>
            </>
          )}
          <dt>{t("Started")}</dt>
          <dd>{new Date(c.created_at).toLocaleString(locale(), { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</dd>
          {v.page && (
            <>
              <dt>{t("Page")}</dt>
              <dd className="mono">{v.page}</dd>
            </>
          )}
          {v.user_agent && (
            <>
              <dt>{t("Browser")}</dt>
              <dd className="truncate" title={v.user_agent}>
                {/Mobile/.test(v.user_agent) ? t("Mobile") : t("Desktop")} · {(v.user_agent.match(/(Firefox|Edg|Chrome|Safari)\/[\d.]+/) || [t("Unknown")])[0].replace("Edg", "Edge")}
              </dd>
            </>
          )}
        </dl>
      </div>
      <div className="side-sec">
        <div className="eyebrow">{t("Conversation")}</div>
        <dl className="dl">
          <dt>{t("Status")}</dt>
          <dd>
            <StatusBadge status={c.status} />
          </dd>
          <dt>{t("Agent")}</dt>
          <dd className="truncate">{agent?.name || "—"}</dd>
          <dt>{t("Channel")}</dt>
          <dd>{t("Website widget")}</dd>
        </dl>
        <Select
          id={"assign-" + c.id}
          label={t("Assignee")}
          value={c.assignee_id || ""}
          onChange={(v) => act("assign", { user_id: v || null }, v ? t("Assigned to {name}", { name: members.find((m) => m.id === v)?.name }) : t("Conversation unassigned"))}
          options={[{ value: "", label: t("Unassigned"), icon: "user" }, ...members.map((m) => ({ value: m.id, label: m.id === me ? `${m.name} (you)` : m.name, lead: <Avatar initials={initialsOf(m.name)} tone={toneOf(m.id)} size="xs" src={m.avatar || undefined} cover /> }))]}
          size="sm"
        />
      </div>
      <div className="side-sec">
        <div className="eyebrow">{t("Sources referenced")}</div>
        {cited.length ? (
          cited.map((s) => (
            <div key={s.source_id} className="row text-sm" style={{ gap: 8 }}>
              <Icon name="book" size={14} className="muted" />
              <span className="truncate">{s.name}</span>
            </div>
          ))
        ) : (
          <span className="helper">{t("The AI didn't cite knowledge in this conversation.")}</span>
        )}
      </div>
      <div className="side-sec">
        {c.status !== "resolved" ? (
          <Button icon="check" onClick={() => act("resolve", null, t("Conversation resolved"))}>
            {t("Mark resolved")}
          </Button>
        ) : (
          <Button onClick={() => act("reopen")}>{t("Reopen conversation")}</Button>
        )}
      </div>
    </>
  );
}

export function Inbox({ id }) {
  const { base, user, summary } = useWorkspace();
  const toast = useToast();
  const me = user.id;
  const [view, setView] = useState("all");
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [agentFilter, setAgentFilter] = useState("all");
  const [showDetails, setShowDetails] = useState(true);
  const [detailsDrawer, setDetailsDrawer] = useState(false);
  const [hiddenSummary, setHiddenSummary] = useState({});
  useEffect(() => {
    const timer = setTimeout(() => setQ(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const params = new URLSearchParams({ view: "all", ...(agentFilter !== "all" ? { agent: agentFilter } : {}), ...(q ? { q } : {}) });
  const list = useResource(`${base}/conversations?${params}`, { poll: 5000, live: true });
  const conv = useResource(id ? `${base}/conversations/${id}` : null, { poll: 4000, live: (e) => e.c?.includes(id) });
  // Visitors typing right now: conversation id → until when to show it.
  const [typing, setTyping] = useState({});
  useEffect(() => onTyping((d) => d.c && d.who === "visitor" && setTyping((x) => ({ ...x, [d.c]: Date.now() + 6000 }))), []);
  const typingIn = (cid) => typing[cid] > Date.now();
  useEffect(() => {
    if (!Object.values(typing).some((until) => until > Date.now())) return;
    const timer = setTimeout(() => setTyping((x) => ({ ...x })), 1000);
    return () => clearTimeout(timer);
  }, [typing]);
  // Whatever just loaded carries the server's clock.
  const serverNow = conv.data?.server_now || list.data?.[0]?.server_now;
  if (serverNow) skew = Date.now() - Date.parse(serverNow);
  const all = list.data || [];
  const counts = Object.fromEntries(VIEWS.map((v) => [v.value, all.filter((c) => v.test(c, me)).length]));
  const rows = all.filter((c) => VIEWS.find((v) => v.value === view).test(c, me));
  const sel = id && conv.data?.id === id ? conv.data : null;

  // Desktop opens the newest conversation; phones start on the list.
  useEffect(() => {
    if (!id && rows[0] && window.matchMedia("(min-width: 861px)").matches) go("inbox", rows[0].id);
  }, [id, rows[0]?.id]);
  // Opening a conversation marks it read; refresh the list and the badge.
  useEffect(() => {
    if (sel) {
      list.reload();
      summary.reload();
    }
  }, [sel?.id]);

  /** Runs an inbox action, refreshes, and reports the outcome. Returns true on success. */
  const act = async (action, body, success, sub) => {
    try {
      const updated = await api(`${base}/conversations/${sel.id}/${action}`, body instanceof FormData ? { method: "POST", form: body } : { method: "POST", body: body || undefined });
      if (updated) conv.setData(updated);
      else await conv.reload();
      list.reload();
      summary.reload();
      if (success) toast(success, { sub });
      return true;
    } catch (e) {
      toast(e.message, { tone: "error" });
      return false;
    }
  };

  const toggleDetails = () => (wide() ? setShowDetails((s) => !s) : setDetailsDrawer(true));
  const moreItems = sel
    ? [
        sel.assignee_id !== me && { label: t("Assign to me"), icon: "user", onSelect: () => act("assign", { user_id: me }, t("Assigned to you")) },
        sel.status === "human" && { label: t("Hand back to AI"), icon: "bot", description: t("The AI answers new messages again"), onSelect: () => act("hand-back", null, t("Handed back to AI")) },
        sel.status !== "resolved" ? { label: t("Mark resolved"), icon: "check", onSelect: () => act("resolve", null, t("Conversation resolved")) } : { label: t("Reopen"), icon: "reset", onSelect: () => act("reopen") },
        { separator: true },
        {
          label: t("Mark as unread"),
          icon: "message",
          // Reloading the conversation would mark it read again, so leave it first.
          onSelect: async () => {
            try {
              await api(`${base}/conversations/${sel.id}/unread`, { method: "POST" });
              go("inbox");
              list.reload();
              summary.reload();
            } catch (e) {
              toast(e.message, { tone: "error" });
            }
          },
        },
      ].filter(Boolean)
    : [];

  return (
    <div className={"inbox" + (id ? " has-sel" : "") + (showDetails ? "" : " details-hidden")}>
      <div className="ib-list">
        <div className="ib-list-head">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h1 className="page-title">{t("Inbox")}</h1>
            <AgentSelect allowAll value={agentFilter} onChange={setAgentFilter} size="sm" prefix={null} width={164} />
          </div>
          <TextInput id="ib-search" aria-label={t("Search conversations")} icon="search" size="sm" placeholder={t("Search name or message")} value={query} onChange={(e) => setQuery(e.target.value)} />
          <Tabs idBase="ibv" label={t("Conversation views")} value={view} onChange={setView} tabs={VIEWS.map((v) => ({ value: v.value, label: t(v.label), count: counts[v.value] }))} />
        </div>
        <div className="ib-items" {...tabPanel("ibv", view)}>
          {list.loading && !list.data ? (
            <Loading />
          ) : list.error && !list.data ? (
            <EmptyState icon="alertCircle" title={t("Couldn't load conversations")} action={<Button size="sm" onClick={list.reload}>{t("Try again")}</Button>}>
              {list.error.message}
            </EmptyState>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={q ? "search" : "inbox"}
              title={q ? t("No matching conversations") : all.length ? t("Nothing in this view") : t("No conversations yet")}
              action={
                (q || agentFilter !== "all") && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setQuery("");
                      setAgentFilter("all");
                    }}
                  >
                    {t("Clear filters")}
                  </Button>
                )
              }
            >
              {q ? t("Try a different name or phrase.") : all.length ? t("Try another view.") : t("Conversations from your website widget appear here.")}
            </EmptyState>
          ) : (
            rows.map((c) => <ConversationRow key={c.id} c={c} selected={c.id === id} me={me} typing={typingIn(c.id)} />)
          )}
        </div>
      </div>

      {id && !sel ? (
        <div className="ib-conv ib-empty">{conv.error ? <EmptyState icon="alertCircle" title={t("Conversation not found")} action={<Button size="sm" onClick={() => go("inbox")}>{t("Back to inbox")}</Button>}>{t("It may have been deleted.")}</EmptyState> : <Loading />}</div>
      ) : sel ? (
        <section className="ib-conv" aria-label={t("Conversation with {name}", { name: visitorName(sel) })}>
          <div className="ib-conv-head">
            <IconButton icon="arrowLeft" label={t("Back to conversations")} className="show-sm" tooltip={false} onClick={() => go("inbox")} />
            <VisitorAvatar c={sel} />
            <div className="who">
              <div className="who-name truncate">{visitorName(sel)}</div>
              <div className="who-sub truncate">
                {typingIn(sel.id) ? (
                  <span className="presence here">{t("Typing…")}</span>
                ) : (
                  <>
                    {presenceOf(sel) && <span className={"presence " + presenceOf(sel).state}>{presenceOf(sel).label}</span>}
                    {presenceOf(sel) && sel.subject ? " · " : ""}
                    {sel.subject || (presenceOf(sel) ? "" : t("New conversation"))}
                  </>
                )}
              </div>
            </div>
            <Handling c={sel} me={me} />
            <ActionMenu label={t("Conversation actions")} items={moreItems} trigger={(p) => <IconButton icon="more" label={t("Conversation actions")} {...p} />} />
            <IconButton icon="panel" label={wide() && showDetails ? t("Hide details") : t("Show details")} onClick={toggleDetails} aria-pressed={wide() ? showDetails : undefined} />
          </div>
          <Transcript c={sel} showSummary={sel.status === "human" && !hiddenSummary[sel.id]} onHideSummary={() => setHiddenSummary({ ...hiddenSummary, [sel.id]: true })} />
          {typingIn(sel.id) && (
            <div className="ib-typing" role="status">
              <span className="typing-dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              {t("{name} is typing…", { name: visitorName(sel) })}
            </div>
          )}
          <BottomBar c={sel} me={me} act={act} />
        </section>
      ) : (
        <div className="ib-conv ib-empty">
          <EmptyState icon="message" title={t("Select a conversation")}>
            {t("Read the transcript, take over from the AI or leave a note for your team.")}
          </EmptyState>
        </div>
      )}

      {sel && showDetails && (
        <aside className="ib-side" aria-label={t("Visitor details")}>
          <Details c={sel} me={me} act={act} />
        </aside>
      )}
      {sel && detailsDrawer && (
        <Drawer title={t("Details")} description={visitorName(sel)} onClose={() => setDetailsDrawer(false)} width={360} flush>
          <Details c={sel} me={me} act={act} />
        </Drawer>
      )}
    </div>
  );
}
