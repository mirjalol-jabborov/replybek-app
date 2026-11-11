import { useState } from "react";
import { t } from "../i18n.js";
import { api } from "../api.js";
import { Icon } from "../icons.jsx";
import { useWorkspace } from "../workspace.jsx";
import { useResource } from "../hooks.js";
import { Button, Confirm, Section, StatusBadge, TextInput, Callout, EmptyState, useToast } from "../ui.jsx";
import { Loading } from "./shared.jsx";

/**
 * Where an agent answers. The same agent, its knowledge and its actions are behind every channel:
 * only the way customers reach it differs, so a channel is connected and disconnected on its own.
 */
export function ChannelsTab() {
  const { base, activeAgent: agent, isAdmin, openDialog } = useWorkspace();
  const channels = useResource(agent ? `${base}/agents/${agent.id}/channels` : null);
  if (!agent) {
    return (
      <div className="box">
        <EmptyState
          icon="bot"
          title={t("Create an agent first")}
          action={
            <Button size="sm" variant="primary" onClick={() => openDialog("createAgent")}>
              {t("Create agent")}
            </Button>
          }
        >
          {t("Each agent answers on its own channels.")}
        </EmptyState>
      </div>
    );
  }
  const telegram = (channels.data || []).find((c) => c.type === "telegram");
  return (
    <div className="stack">
      <Section title={t("Website widget")} description={t("The chat on your own site. Always on for a published agent.")}>
        <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
          <div className="stack-xs" style={{ minWidth: 0 }}>
            <span className="row" style={{ gap: 8 }}>
              <Icon name="code" size={15} />
              <strong>{agent.name}</strong>
              <StatusBadge status={agent.status} />
            </span>
            <span className="helper">{t("One script tag on your pages. Visitors chat without signing in.")}</span>
          </div>
          <Button onClick={() => openDialog("install", { agentId: agent.id })}>{t("Install widget")}</Button>
        </div>
      </Section>
      <Section title={t("Telegram")} description={t("The same agent answering inside a Telegram bot of your own.")}>
        {channels.loading && !channels.data ? <Loading /> : telegram ? <Connected agent={agent} channel={telegram} channels={channels} canEdit={isAdmin} /> : <ConnectTelegram agent={agent} channels={channels} canEdit={isAdmin} />}
      </Section>
    </div>
  );
}

function Connected({ agent, channel, channels, canEdit }) {
  const { base } = useWorkspace();
  const toast = useToast();
  const [disconnecting, setDisconnecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const disconnect = async () => {
    setBusy(true);
    try {
      await api(`${base}/agents/${agent.id}/channels/${channel.id}`, { method: "DELETE" });
      await channels.reload();
      toast(t("Telegram disconnected"), { sub: t("The bot stops answering right away.") });
    } catch (e) {
      toast(e.message, { tone: "error" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
        <div className="stack-xs" style={{ minWidth: 0 }}>
          <span className="row" style={{ gap: 8 }}>
            <Icon name="send" size={15} />
            <strong>{channel.account_name}</strong>
            {channel.status === "active" ? <StatusBadge status="active" /> : <StatusBadge status="error" label={t("Disconnected")} />}
          </span>
          <span className="helper">{t("Customers who write to this bot are answered by {name}.", { name: agent.name })}</span>
        </div>
        {canEdit && (
          <Button variant="danger" loading={busy} onClick={() => setDisconnecting(true)}>
            {t("Disconnect")}
          </Button>
        )}
      </div>
      {channel.status !== "active" && <Callout tone="warn">{channel.disabled_reason || t("Telegram stopped accepting this bot. Connect it again.")}</Callout>}
      {agent.status !== "active" && <Callout tone="warn">{t("{name} is a draft, so the bot stays quiet until you publish it.", { name: agent.name })}</Callout>}
      <Callout>{t("Actions that run inside your own system's browser session work on the website widget only. Everything else, including confirmations, works here too.")}</Callout>
      {disconnecting && (
        <Confirm
          title={t("Disconnect {name}?", { name: channel.account_name })}
          body={t("The bot stops answering immediately. Conversations already in your inbox are kept.")}
          confirmLabel={t("Disconnect")}
          danger
          onConfirm={disconnect}
          onClose={() => setDisconnecting(false)}
        />
      )}
    </div>
  );
}

function ConnectTelegram({ agent, channels, canEdit }) {
  const { base } = useWorkspace();
  const toast = useToast();
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const connect = async () => {
    setBusy(true);
    setError("");
    try {
      const channel = await api(`${base}/agents/${agent.id}/channels/telegram`, { method: "POST", body: { bot_token: token.trim() } });
      setToken("");
      await channels.reload();
      toast(t("{name} is connected", { name: channel.account_name }), { sub: t("Write to the bot to try it.") });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  if (!canEdit) return <span className="helper">{t("Ask an admin to connect a Telegram bot.")}</span>;
  return (
    <div className="stack" style={{ gap: 12 }}>
      <ol className="helper" style={{ margin: 0, paddingInlineStart: 18, display: "grid", gap: 4 }}>
        <li>{t("Open @BotFather in Telegram and send /newbot.")}</li>
        <li>{t("Choose a name and a username for your bot.")}</li>
        <li>{t("Paste the token it gives you here.")}</li>
      </ol>
      <TextInput
        id="telegram-token"
        label={t("Bot token")}
        placeholder="123456789:AA..."
        value={token}
        error={error}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => (setToken(e.target.value), setError(""))}
        onKeyDown={(e) => e.key === "Enter" && token.trim() && connect()}
      />
      <div className="row">
        <Button variant="primary" disabled={!token.trim()} loading={busy} onClick={connect}>
          {t("Connect")}
        </Button>
        {agent.status !== "active" && <span className="helper">{t("{name} is a draft, so the bot stays quiet until you publish it.", { name: agent.name })}</span>}
      </div>
    </div>
  );
}
