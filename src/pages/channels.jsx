import { useState } from "react";
import { t } from "../i18n.js";
import { api } from "../api.js";
import { go } from "../hooks.js";
import { Icon } from "../icons.jsx";
import { useWorkspace } from "../workspace.jsx";
import { useResource } from "../hooks.js";
import { Button, Confirm, PageHeader, StatusBadge, TextInput, Callout, EmptyState, useToast } from "../ui.jsx";
import { Loading } from "./shared.jsx";
import { WidgetTab } from "./settings.jsx";

/**
 * Where an agent answers. The same agent, its knowledge and its actions are behind every channel:
 * only the way customers reach it differs. The page lists them as cards; `id` opens one
 * ("website", "telegram"). Channels still to come are shown, but can't be opened yet.
 */
export function Channels({ id }) {
  const { base, activeAgent: agent, isAdmin, openDialog } = useWorkspace();
  const channels = useResource(agent ? `${base}/agents/${agent.id}/channels` : null);
  const telegram = (channels.data || []).find((c) => c.type === "telegram");
  const CARDS = [
    {
      id: "website",
      icon: "code",
      title: t("Website widget"),
      text: t("The chat on your own site. One script tag; visitors chat without signing in."),
      status: agent && <StatusBadge status={agent.status} />,
    },
    {
      id: "telegram",
      icon: "send",
      title: t("Telegram bot"),
      text: t("The same agent answering inside a Telegram bot of your own."),
      status: telegram ? (telegram.status === "active" ? <StatusBadge status="active" label={t("Connected")} /> : <StatusBadge status="error" label={t("Disconnected")} />) : <span className="badge">{t("Not connected")}</span>,
    },
    {
      id: "telegram-business",
      icon: "user",
      title: t("Telegram Business"),
      text: t("Answer from your own Telegram account, not a bot. Customers write to you as usual."),
      soon: true,
    },
    { id: "instagram", icon: "message", title: "Instagram Direct", text: t("Answer Direct messages on your business Instagram account."), soon: true },
    { id: "whatsapp", icon: "phone", title: "WhatsApp Business", text: t("Answer customers on your WhatsApp Business number."), soon: true },
    { id: "amocrm", group: "systems", icon: "users", title: "amoCRM", text: t("Answer chats that come into amoCRM, with leads and deals kept up to date."), soon: true },
    { id: "bitrix24", group: "systems", icon: "building", title: "Bitrix24", text: t("Answer Open Channel chats in Bitrix24 and work with its leads and deals."), soon: true },
    { id: "billz", group: "systems", icon: "bag", title: "Billz", text: t("Look up products, stock and customers in Billz while answering."), soon: true },
  ];
  // Where customers write in, and the systems the agent works in while it answers.
  const GROUPS = [
    { id: "messaging", title: t("Messaging"), text: t("Places customers write to you. The AI agent answers there.") },
    { id: "systems", title: t("CRM and business systems"), text: t("Systems your team already works in. The AI agent answers inside them and keeps their records up to date.") },
  ];
  const open = CARDS.find((c) => c.id === id && !c.soon);
  const back = open && (
    <button type="button" className="channel-back" onClick={() => go("channels")}>
      <Icon name="arrowLeft" size={14} />
      {t("Channels")}
    </button>
  );

  if (open?.id === "website") {
    return (
      <>
        <PageHeader title={t("Website widget")} description={t("Make the chat yours, then add it to your website.")} before={back} />
        <div className="page-body">
          <div className="page-inner">
            <WidgetTab standalone onDirty={() => {}} />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title={open ? open.title : t("Channels")} description={open ? open.text : t("Where customers reach your AI agent. The same knowledge and actions answer on each.")} before={back} />
      <div className="page-body">
        <div className="page-inner">
          {!agent ? (
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
          ) : open?.id === "telegram" ? (
            <div className="box channel-detail">
              {channels.loading && !channels.data ? <Loading /> : telegram ? <Connected agent={agent} channel={telegram} channels={channels} canEdit={isAdmin} /> : <ConnectTelegram agent={agent} channels={channels} canEdit={isAdmin} />}
            </div>
          ) : (
            <div className="channels-groups">
              {GROUPS.map((g) => (
                <section key={g.id} className="channels-group" aria-labelledby={`channels-${g.id}`}>
                  <div className="channels-group-head">
                    <h2 className="section-title" id={`channels-${g.id}`}>{g.title}</h2>
                    <p className="helper">{g.text}</p>
                  </div>
                  <div className="channels-grid">
              {CARDS.filter((c) => (c.group || "messaging") === g.id).map((c) => (
                <button type="button" key={c.id} className={`channel-card${c.soon ? " soon" : ""}`} disabled={c.soon} onClick={() => go("channels", c.id)} aria-label={c.soon ? `${c.title}, ${t("Coming soon")}` : c.title}>
                  <span className="channel-card-top">
                    <span className="channel-icon">
                      <Icon name={c.icon} size={18} />
                    </span>
                    {c.soon ? <span className="badge">{t("Coming soon")}</span> : c.status}
                  </span>
                  <strong>{c.title}</strong>
                  <span className="helper">{c.text}</span>
                  {!c.soon && (
                    <span className="channel-card-foot">
                      {c.id === "telegram" && !telegram ? t("Set up") : t("Manage")}
                      <Icon name="chevronRight" size={14} />
                    </span>
                  )}
                </button>
              ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
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
