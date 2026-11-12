import React, { useEffect, useRef, useState } from "react";
import { t } from "../i18n.js";
import { Icon } from "../icons.jsx";
import { Button, IconButton, SegmentedControl, Field } from "./controls.jsx";
import { Dialog } from "./overlay.jsx";
import { ActionMenu } from "./menus.jsx";

/**
 * Markdown for an agent's instructions: a small reader that turns it into React elements (never
 * raw HTML, so nothing typed can run), and a full-size editor with a toolbar, ready-made sections
 * and a preview. The agent reads the Markdown as written; headings and lists just make long
 * instructions easier for people to keep in order.
 */

/** **bold**, *italic*, `code` and [links](https://…) inside one line. */
function inline(text, key = "i") {
  const out = [];
  const re = /(\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\s][^*]*)\*|_([^_\s][^_]*)_|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))/g;
  let last = 0;
  let m;
  let n = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${key}-${n++}`;
    if (m[2] || m[3]) out.push(<strong key={k}>{inline(m[2] || m[3], k)}</strong>);
    else if (m[4] || m[5]) out.push(<em key={k}>{inline(m[4] || m[5], k)}</em>);
    else if (m[6]) out.push(<code key={k}>{m[6]}</code>);
    else if (m[7])
      out.push(
        <a key={k} href={m[8]} target="_blank" rel="noopener noreferrer">
          {m[7]}
        </a>
      );
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** The whole text as headings, paragraphs, lists, quotes, code blocks and dividers. */
export function MarkdownView({ text }) {
  const lines = String(text || "").replace(/\r/g, "").split("\n");
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (/^```/.test(line)) {
      const body = [];
      for (i++; i < lines.length && !/^```/.test(lines[i]); i++) body.push(lines[i]);
      i++;
      blocks.push(<pre key={blocks.length}>{body.join("\n")}</pre>);
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      const Tag = `h${h[1].length + 2}`;
      blocks.push(<Tag key={blocks.length}>{inline(h[2])}</Tag>);
      i++;
      continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      blocks.push(<hr key={blocks.length} />);
      i++;
      continue;
    }
    if (/^>\s?/.test(line)) {
      const body = [];
      for (; i < lines.length && /^>\s?/.test(lines[i]); i++) body.push(lines[i].replace(/^>\s?/, ""));
      blocks.push(<blockquote key={blocks.length}>{inline(body.join(" "))}</blockquote>);
      continue;
    }
    const list = /^\s*([-*+]|\d+[.)])\s+/.exec(line);
    if (list) {
      const ordered = /\d/.test(list[1]);
      const items = [];
      for (; i < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[i]); i++) items.push(lines[i].replace(/^\s*([-*+]|\d+[.)])\s+/, ""));
      const Tag = ordered ? "ol" : "ul";
      blocks.push(
        <Tag key={blocks.length}>
          {items.map((it, j) => (
            <li key={j}>{inline(it, `l${j}`)}</li>
          ))}
        </Tag>
      );
      continue;
    }
    const para = [];
    for (; i < lines.length && lines[i].trim() && !/^(#{1,3}\s|>|```|\s*([-*+]|\d+[.)])\s)/.test(lines[i]); i++) para.push(lines[i]);
    blocks.push(<p key={blocks.length}>{inline(para.join(" "))}</p>);
  }
  return blocks.length ? <div className="md-view">{blocks}</div> : <p className="helper">{t("Nothing to preview yet.")}</p>;
}

/**
 * Puts text into the box the way typing would, so Undo takes it back. Falls back to setting the
 * value where the browser has no insertText command.
 */
function insert(el, text, selectFrom, selectTo) {
  el.focus();
  const ok = document.execCommand && document.execCommand("insertText", false, text);
  if (!ok) el.setRangeText(text, el.selectionStart, el.selectionEnd, "end");
  if (selectFrom != null) el.setSelectionRange(selectFrom, selectTo ?? selectFrom);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Wraps the selection (or a placeholder word) in `before`…`after`, leaving the inner text selected. */
function wrap(el, before, after, placeholder) {
  const { selectionStart: a, selectionEnd: b, value } = el;
  const inner = value.slice(a, b) || placeholder;
  insert(el, before + inner + after, a + before.length, a + before.length + inner.length);
}

/** Puts `prefix` at the start of each selected line ("- ", "1. ", "## ", "> "), or takes it off again. */
function prefixLines(el, prefix) {
  const { value } = el;
  const start = value.lastIndexOf("\n", el.selectionStart - 1) + 1;
  let end = value.indexOf("\n", el.selectionEnd);
  if (end === -1) end = value.length;
  const lines = value.slice(start, end).split("\n");
  const numbered = prefix === "1. ";
  const has = (l) => (numbered ? /^\d+\.\s/.test(l) : l.startsWith(prefix));
  const off = lines.every(has);
  const next = lines.map((l, i) => (off ? l.replace(numbered ? /^\d+\.\s/ : prefix, "") : (numbered ? `${i + 1}. ` : prefix) + l.replace(/^(#{1,3}\s|>\s|[-*]\s|\d+\.\s)/, ""))).join("\n");
  el.setSelectionRange(start, end);
  insert(el, next, start, start + next.length);
}

/** Ready-made sections, in the dashboard's language; the agent understands any language. */
const sections = () => [
  { label: t("About the business"), icon: "building", text: `## ${t("About the business")}\n${t("What we sell, where we are, and who our customers are.")}\n` },
  { label: t("Do"), icon: "check", text: `## ${t("Do")}\n- ${t("Greet customers by name when you know it.")}\n- \n` },
  { label: t("Don't"), icon: "x", text: `## ${t("Don't")}\n- ${t("Don't promise discounts or delivery dates you can't see in the knowledge.")}\n- \n` },
  { label: t("When to hand over to a person"), icon: "hand", text: `## ${t("When to hand over to a person")}\n- ${t("The customer asks for a refund or reports a damaged item.")}\n- \n` },
  { label: t("Tone and style"), icon: "message", text: `## ${t("Tone and style")}\n- ${t("Short, friendly answers. One question at a time.")}\n` },
  { label: t("Policies"), icon: "book", text: `## ${t("Policies")}\n- ${t("Returns:")} \n- ${t("Delivery:")} \n- ${t("Payment:")} \n` },
  { label: t("Example answer"), icon: "qa", text: `## ${t("Example answer")}\n> ${t("Customer: Do you deliver to Samarkand?")}\n> ${t("Agent: Yes, in 2 to 3 days. Delivery is free over 500,000 so'm.")}\n` },
];

/**
 * The instructions in a big editor. Edits stay here until Done, so Cancel leaves the agent as it was.
 */
export function InstructionsEditor({ value, maxLength = 8000, onSave, onClose }) {
  const [text, setText] = useState(value || "");
  const [view, setView] = useState(() => (window.matchMedia?.("(max-width: 760px)").matches ? "write" : "split"));
  const box = useRef(null);
  const narrow = useRef(window.matchMedia?.("(max-width: 760px)").matches);
  useEffect(() => {
    box.current?.focus();
  }, []);

  const run = (fn) => () => {
    if (view === "preview") setView("write");
    requestAnimationFrame(() => box.current && fn(box.current));
  };
  const addSection = (s) =>
    run((el) => {
      const before = el.value.slice(0, el.selectionStart);
      const gap = !before ? "" : before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
      insert(el, gap + s.text);
    })();
  const link = run((el) => {
    const { selectionStart: a, selectionEnd: b, value: v } = el;
    const label = v.slice(a, b) || t("link text");
    const md = `[${label}](https://)`;
    insert(el, md, a + label.length + 3, a + md.length - 1);
  });
  const tools = [
    { icon: "heading", label: t("Heading"), keys: null, fn: run((el) => prefixLines(el, "## ")) },
    { icon: "bold", label: t("Bold"), keys: "⌘B", fn: run((el) => wrap(el, "**", "**", t("bold text"))) },
    { icon: "italic", label: t("Italic"), keys: "⌘I", fn: run((el) => wrap(el, "*", "*", t("italic text"))) },
    "sep",
    { icon: "listBullet", label: t("Bulleted list"), fn: run((el) => prefixLines(el, "- ")) },
    { icon: "listNumber", label: t("Numbered list"), fn: run((el) => prefixLines(el, "1. ")) },
    { icon: "quote", label: t("Quote"), fn: run((el) => prefixLines(el, "> ")) },
    "sep",
    { icon: "code", label: t("Code"), fn: run((el) => wrap(el, "`", "`", "code")) },
    { icon: "link", label: t("Link"), keys: "⌘K", fn: link },
    { icon: "minus", label: t("Divider"), fn: run((el) => insert(el, (el.value.slice(0, el.selectionStart).endsWith("\n") || !el.selectionStart ? "" : "\n") + "\n---\n\n")) },
  ];
  const onKey = (e) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    const k = e.key.toLowerCase();
    if (k === "b") (e.preventDefault(), wrap(e.currentTarget, "**", "**", t("bold text")));
    else if (k === "i") (e.preventDefault(), wrap(e.currentTarget, "*", "*", t("italic text")));
    else if (k === "k") (e.preventDefault(), link());
    else if (k === "enter") (e.preventDefault(), done());
  };
  const done = () => {
    onSave(text.slice(0, maxLength));
    onClose();
  };
  const left = maxLength - text.length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <Dialog
      title={t("Instructions")}
      description={t("How the agent should behave. Markdown works: headings, lists and bold help keep long instructions in order.")}
      size="editor"
      onClose={onClose}
      footNote={
        <span className={"md-count" + (left < 200 ? " low" : "")}>
          {t("{words} words · {chars} of {max} characters", { words: words.toLocaleString(), chars: text.length.toLocaleString(), max: maxLength.toLocaleString() })}
        </span>
      }
      footer={
        <>
          <Button onClick={onClose}>{t("Cancel")}</Button>
          <Button variant="primary" onClick={done}>
            {t("Done")}
          </Button>
        </>
      }
    >
      <div className="md-toolbar" role="toolbar" aria-label={t("Formatting")}>
        {/* Pressing a tool keeps the focus, and so the selection, in the text. */}
        <div className="md-tools" onMouseDown={(e) => e.target.closest("button") && e.preventDefault()}>
          {tools.map((tool, i) =>
            tool === "sep" ? <span key={i} className="md-sep" aria-hidden="true" /> : <IconButton key={tool.icon} icon={tool.icon} size="sm" label={tool.keys ? `${tool.label} (${tool.keys})` : tool.label} onClick={tool.fn} />
          )}
          <span className="md-sep" aria-hidden="true" />
          <ActionMenu
            label={t("Insert a section")}
            placement="bottom-start"
            minWidth={250}
            items={sections().map((s) => ({ label: s.label, icon: s.icon, onSelect: () => addSection(s) }))}
            trigger={(p) => (
              <Button size="sm" variant="ghost" icon="plus" iconRight="chevronDown" {...p}>
                {t("Section")}
              </Button>
            )}
          />
        </div>
        <SegmentedControl
          label={t("View")}
          value={view}
          onChange={setView}
          options={[
            { value: "write", label: t("Write") },
            ...(narrow.current ? [] : [{ value: "split", label: t("Both") }]),
            { value: "preview", label: t("Preview") },
          ]}
        />
      </div>
      <div className={"md-panes " + view}>
        {view !== "preview" && (
          <textarea
            ref={box}
            className="md-input"
            value={text}
            maxLength={maxLength}
            spellCheck
            aria-label={t("Instructions")}
            placeholder={t("Start writing, or add a section from the toolbar.")}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKey}
          />
        )}
        {view !== "write" && (
          <div className="md-preview" aria-label={t("Preview")}>
            <MarkdownView text={text} />
          </div>
        )}
      </div>
    </Dialog>
  );
}

/** The instructions field on the page: its label row has the button that opens the big editor. */
export function InstructionsField({ id, label, hint, value, onChange, disabled, maxLength = 8000, children }) {
  const [open, setOpen] = useState(false);
  const action = !disabled && (
    <Button size="sm" variant="ghost" icon="expand" onClick={() => setOpen(true)}>
      {t("Open editor")}
    </Button>
  );
  return (
    <>
      <Field id={id} label={label} hint={hint} action={action}>
        {children}
      </Field>
      {open && <InstructionsEditor value={value} maxLength={maxLength} onSave={(v) => onChange({ target: { value: v, id } })} onClose={() => setOpen(false)} />}
    </>
  );
}

export default React.memo(MarkdownView);
