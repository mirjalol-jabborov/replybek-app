import { useRef, useState } from "react";
import { t } from "../i18n.js";
import { useWorkspace } from "../workspace.jsx";
import { go } from "../hooks.js";
import { Dialog, Button, Callout, copyText, useToast } from "../ui.jsx";
import { AgentSelect } from "./shared.jsx";

export const WIDGET_SRC = import.meta.env.VITE_WIDGET_SRC || "http://localhost:5174/replybek-widget.js";
export const PUBLIC_API = import.meta.env.VITE_PUBLIC_API || "http://localhost:3100";
export const snippetFor = (agent) => `<script src="${WIDGET_SRC}"
  data-key="${agent.public_key}"
  data-api="${PUBLIC_API}"
  defer></script>`;

/** The embed code for one agent, with a copy button that reports what actually happened. */
export function Snippet({ agent }) {
  const toast = useToast();
  const ref = useRef(null);
  const [copied, setCopied] = useState(false);
  const snippet = snippetFor(agent);
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="label">{t("Embed code")}</span>
        <Button
          size="sm"
          icon={copied ? "check" : "copy"}
          onClick={async () => {
            if (await copyText(snippet, ref.current)) {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } else toast(t("Couldn't copy automatically"), { tone: "error", sub: t("The code is selected. Press Ctrl+C or ⌘C.") });
          }}
        >
          {copied ? t("Copied") : t("Copy code")}
        </Button>
      </div>
      <pre className="code" ref={ref} tabIndex={0} aria-label={t("Widget embed code")}>
        {snippet}
      </pre>
      <span className="sr-only" role="status">
        {copied ? t("Embed code copied") : ""}
      </span>
    </div>
  );
}

export function InstallDialog({ onClose, agentId: initial }) {
  const { agents, activeAgent } = useWorkspace();
  const [agentId, setAgentId] = useState(initial || activeAgent?.id);
  const agent = agents.find((a) => a.id === agentId);
  return (
    <Dialog
      title={t("Install the chat widget")}
      description={t("Paste one script tag into your website.")}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button
            variant="ghost"
            style={{ marginRight: "auto" }}
            onClick={() => {
              onClose();
              go("settings", "widget");
            }}
          >
            {t("Appearance and allowed websites")}
          </Button>
          <Button variant="primary" onClick={onClose}>
            {t("Done")}
          </Button>
        </>
      }
    >
      <div className="field">
        <span className="field-label">{t("Agent")}</span>
        <AgentSelect value={agentId} onChange={setAgentId} prefix={null} width="100%" />
      </div>
      {agent && agent.status !== "active" && <Callout tone="warn">{t("{name} is a draft. The widget shows “This chat isn't available” until you publish it from the Playground or the Agents page.", { name: agent.name })}</Callout>}
      {agent && <Snippet agent={agent} />}
      <div className="stack-xs">
        <span className="label">{t("Where to paste it")}</span>
        <span className="helper">Before the closing &lt;/body&gt; tag on every page that should show the chat, or once in your site's shared footer template.</span>
      </div>
      {agent && !agent.allowed_origins?.length && <Callout>{t("Any website can load this widget right now. Add your domains under Settings › Widget to limit it.")}</Callout>}
    </Dialog>
  );
}
