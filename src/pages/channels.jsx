import { useEffect, useRef, useState } from "react";
import { t } from "../i18n.js";
import { api } from "../api.js";
import { go } from "../hooks.js";
import { Icon } from "../icons.jsx";
import { useWorkspace } from "../workspace.jsx";
import { useResource } from "../hooks.js";
import { Button, Confirm, PageHeader, StatusBadge, TextInput, Textarea, SwitchField, Callout, EmptyState, useToast, initialsOf } from "../ui.jsx";
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
      status: businessBadge(telegram),
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
          ) : open?.id === "telegram-business" ? (
            <div className="box channel-detail">
              {channels.loading && !channels.data ? (
                <Loading />
              ) : telegram?.status === "active" ? (
                <TelegramBusiness agent={agent} bot={telegram} channels={channels} canEdit={isAdmin} />
              ) : (
                <BusinessNeedsBot telegram={telegram} />
              )}
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
                      {(c.id === "telegram" && !telegram) || (c.id === "telegram-business" && telegram?.business?.state !== "connected") ? t("Set up") : t("Manage")}
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
      <div className="channel-head">
        <div className="stack-xs" style={{ minWidth: 0 }}>
          <span className="channel-account">
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
      {channel.status === "active" && <BotSettings agent={agent} channel={channel} channels={channels} canEdit={canEdit} />}
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
  const { base, openDialog } = useWorkspace();
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
      <div className="row" style={{ flexWrap: "wrap" }}>
        <Button variant="primary" disabled={!token.trim()} loading={busy} onClick={connect}>
          {t("Connect")}
        </Button>
        {agent.status !== "active" && <span className="helper">{t("{name} is a draft, so the bot stays quiet until you publish it.", { name: agent.name })}</span>}
      </div>
      <GuideHint onWatch={() => openDialog("help", { guide: "channels/telegram" })} />
    </div>
  );
}

/** The Telegram Business card's badge: where its setup stands. */
function businessBadge(telegram) {
  const state = telegram?.status === "active" ? telegram.business?.state : null;
  if (state === "connected") return <StatusBadge status="active" label={t("Connected")} />;
  if (state === "no_reply") return <StatusBadge status="error" label={t("Can't reply")} />;
  if (state === "linked") return <span className="badge">{t("Setting up")}</span>;
  return <span className="badge">{t("Not connected")}</span>;
}

/** Telegram Business answers through the workspace's bot, so that comes first. */
function BusinessNeedsBot({ telegram }) {
  return (
    <div className="stack" style={{ gap: 14, alignItems: "flex-start" }}>
      <p className="helper" style={{ margin: 0 }}>
        {telegram
          ? t("Your Telegram bot is disconnected. Connect it again, then come back here.")
          : t("Telegram Business answers through your Telegram bot: customers write to your own account, and the bot replies for you. Connect a bot first.")}
      </p>
      <Button variant="primary" onClick={() => go("channels", "telegram")}>
        {telegram ? t("Reconnect the bot") : t("Connect a Telegram bot")}
      </Button>
    </div>
  );
}

/** Opens the walkthrough of the Telegram screens, for whoever isn't sure where to tap. */
function GuideHint({ onWatch }) {
  return (
    <div className="guide-hint">
      <span className="guide-hint-icon" aria-hidden="true">
        <Icon name="phone" size={16} />
      </span>
      <span className="guide-hint-text">
        <strong>{t("Not sure where to tap?")}</strong>
        <span className="helper">{t("See each step as it looks in Telegram.")}</span>
      </span>
      <Button size="sm" onClick={onWatch}>
        {t("Watch")}
      </Button>
    </div>
  );
}

/** One step of the setup: a number until it is done, then a tick. */
function SetupStep({ n, done, warn, title, children }) {
  return (
    <li className={"setup-step" + (done ? " done" : "") + (warn ? " warn" : "")}>
      <span className="setup-step-mark" aria-hidden="true">
        {done ? <Icon name="check" size={13} /> : warn ? <Icon name="alert" size={13} /> : n}
      </span>
      <div className="setup-step-body">
        <span className="setup-step-title">
          <strong>
            {title}
            {done && <span className="sr-only"> ({t("done")})</span>}
          </strong>
        </span>
        {children}
      </div>
    </li>
  );
}

/**
 * Telegram Business on the workspace's bot: Secretary Mode (once Business Mode) in BotFather, the owner's one-time link
 * (so only their account counts), and the bot added in Telegram's own settings. Each step ticks over
 * by itself while the page is open, since the last two happen in Telegram.
 */
function TelegramBusiness({ agent, bot, channels, canEdit }) {
  const { base, openDialog } = useWorkspace();
  const show = (step) => openDialog("help", { guide: "channels/telegram-business", step });
  const toast = useToast();
  const path = `${base}/agents/${agent.id}/channels/${bot.id}/business`;
  const status = useResource(path, { poll: 4000, pollWhile: (d) => d.state !== "connected" });
  const [link, setLink] = useState(null);
  const [busy, setBusy] = useState(false);
  const [turningOff, setTurningOff] = useState(false);
  const s = status.data;
  // The card on the Channels page shows the same state, so it follows along.
  useEffect(() => {
    if (s && s.state !== bot.business?.state) channels.reload();
  }, [s?.state]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (s?.owner) setLink(null);
  }, [s?.owner?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  if (status.loading && !s) return <Loading />;
  if (status.error && !s) return <Callout tone="warn">{status.error.message}</Callout>;
  if (!s) return null;

  const getLink = async () => {
    setBusy(true);
    try {
      setLink(await api(`${path}/link`, { method: "POST" }));
    } catch (e) {
      toast(e.message, { tone: "error" });
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link.url);
      toast(t("Link copied"), { sub: t("Open it in the Telegram account your customers write to.") });
    } catch {
      toast(link.url);
    }
  };
  const turnOff = async () => {
    try {
      await api(path, { method: "DELETE" });
      await Promise.all([status.reload(), channels.reload()]);
      toast(t("Telegram Business turned off"), { sub: t("Also remove the bot in Telegram, under Telegram Business › Chatbots.") });
    } catch (e) {
      toast(e.message, { tone: "error" });
    }
  };

  const connected = s.state === "connected";
  const ownerName = s.owner ? (s.owner.username ? `${s.owner.name} (@${s.owner.username})` : s.owner.name) : "";
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="channel-head">
        <div className="stack-xs" style={{ minWidth: 0 }}>
          <span className="channel-account">
            <Icon name="user" size={15} />
            <strong>{s.owner ? ownerName : t("Telegram Business")}</strong>
            {businessBadge({ status: "active", business: s })}
          </span>
          <span className="helper">{t("Answers through {bot}.", { bot: bot.account_name })}</span>
        </div>
        {canEdit && s.owner && (
          <Button variant="danger" onClick={() => setTurningOff(true)}>
            {t("Turn off")}
          </Button>
        )}
      </div>

      {connected && <Callout tone="ok">{t("{agent} answers customers who write to {owner}. When you write in a chat yourself, it steps back there until you hand the chat back in the inbox.", { agent: agent.name, owner: s.owner.name })}</Callout>}
      {agent.status !== "active" && <Callout tone="warn">{t("{name} is a draft, so it stays out of your chats until you publish it.", { name: agent.name })}</Callout>}

      {!connected && <GuideHint onWatch={() => show(!s.business_mode ? 0 : !s.owner ? 1 : 2)} />}

      <ol className="setup-steps">
        <SetupStep n={1} done={s.business_mode} title={t("Turn on Secretary Mode for the bot")}>
          <p className="helper">{t("In @BotFather, send /mybots, choose {bot}, then Bot Settings › Secretary Mode, and turn it on. Older Telegram versions call it Business Mode.", { bot: bot.account_name })}</p>
          {!s.business_mode && (
            <div className="setup-step-actions">
              <Button size="sm" onClick={() => status.reload()}>
                {t("Check again")}
              </Button>
            </div>
          )}
        </SetupStep>

        <SetupStep n={2} done={Boolean(s.owner)} title={t("Confirm it's your Telegram account")}>
          {s.owner ? (
            <p className="helper">{t("Linked to {name}.", { name: ownerName })}</p>
          ) : (
            <p className="helper">{t("Open the link in the Telegram account your customers write to, and press Start. It works once, within 30 minutes.")}</p>
          )}
          {canEdit && !s.owner && (
            <div className="setup-step-actions">
              {link ? (
                <>
                  <a className="btn btn-primary btn-sm" href={link.url} target="_blank" rel="noreferrer">
                    <Icon name="send" size={14} />
                    <span className="btn-label">{t("Open in Telegram")}</span>
                  </a>
                  <Button size="sm" onClick={copy}>
                    {t("Copy link")}
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="primary" loading={busy} onClick={getLink}>
                  {t("Get the link")}
                </Button>
              )}
            </div>
          )}
          {!canEdit && !s.owner && <p className="helper">{t("Ask an admin to finish the setup.")}</p>}
        </SetupStep>

        <SetupStep n={3} done={connected} warn={s.state === "no_reply"} title={t("Connect the bot to your account")}>
          <p className="helper">{t("In Telegram, open Settings › Telegram Business › Chatbots and enter {bot}. Choose which chats it can access, and keep Manage Messages on. Without Telegram Premium, it's Settings › Chat Automation. An account can have one such bot at a time.", { bot: bot.account_name })}</p>
          {s.state === "no_reply" && <p className="helper setup-step-warn">{t("The bot was added, but it isn't allowed to reply. Turn on Manage Messages in the same place.")}</p>}
        </SetupStep>
      </ol>

      <ul className="helper setup-notes">
        <li>{t("Telegram lets the bot reply only within 24 hours of a customer's last message.")}</li>
        <li>{t("Chats show up in your inbox as Telegram Business, next to the rest.")}</li>
      </ul>

      {turningOff && (
        <Confirm
          title={t("Turn off Telegram Business?")}
          body={t("The AI agent stops answering your chats right away. To take the bot off your account completely, also remove it in Telegram, under Telegram Business › Chatbots.")}
          confirmLabel={t("Turn off")}
          danger
          onConfirm={turnOff}
          onClose={() => setTurningOff(false)}
        />
      )}
    </div>
  );
}

/**
 * Any image as the square JPEG Telegram wants for a profile photo: cropped to fill, on white
 * (JPEG has no transparency), 640 px.
 */
function toProfileJpeg(src) {
  return new Promise((done, fail) => {
    const img = new Image();
    img.onload = () => {
      const size = 640;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, size, size);
      const w = img.naturalWidth || size;
      const h = img.naturalHeight || size;
      const scale = Math.max(size / w, size / h);
      ctx.drawImage(img, (size - w * scale) / 2, (size - h * scale) / 2, w * scale, h * scale);
      done(canvas.toDataURL("image/jpeg", 0.88));
    };
    img.onerror = () => fail(new Error(t("Couldn't read that image.")));
    img.src = src;
  });
}

const readFile = (file) =>
  new Promise((done, fail) => {
    const reader = new FileReader();
    reader.onload = () => done(String(reader.result));
    reader.onerror = () => fail(new Error(t("Couldn't read that image.")));
    reader.readAsDataURL(file);
  });

/**
 * The bot as customers see it in Telegram (photo, name, the text before Start, the profile line) and
 * the buttons under its greeting. The profile lives in Telegram, so it is read from there each time.
 */
function BotSettings({ agent, channel, channels, canEdit }) {
  const { base } = useWorkspace();
  const toast = useToast();
  const path = `${base}/agents/${agent.id}/channels/${channel.id}/bot`;
  const bot = useResource(path);
  const [draft, setDraft] = useState(null);
  const [photo, setPhoto] = useState(undefined); // undefined: unchanged · null: remove · string: new JPEG
  const [busy, setBusy] = useState(false);
  const input = useRef(null);
  const profile = bot.data?.profile;
  const settings = bot.data?.settings || channel.settings;
  useEffect(() => {
    if (profile && !draft) setDraft({ name: profile.name, short_description: profile.short_description, description: profile.description, ...settings });
  }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  if (bot.loading && !bot.data) return <Loading />;
  if (bot.error) return <Callout tone="warn">{bot.error.message}</Callout>;
  if (!profile || !draft) return null;

  const changes = {};
  for (const k of ["name", "short_description", "description"]) if (draft[k].trim() !== profile[k]) changes[k] = draft[k].trim();
  for (const k of ["suggestions", "person_button"]) if (draft[k] !== settings[k]) changes[k] = draft[k];
  if (photo) changes.photo = photo;
  if (photo === null) changes.remove_photo = true;
  const dirty = Object.keys(changes).length > 0;
  const shownPhoto = photo === undefined ? profile.photo : photo;
  const set = (k) => (e) => setDraft({ ...draft, [k]: e.target.value });

  const pick = async (src) => {
    try {
      setPhoto(await toProfileJpeg(src));
    } catch (e) {
      toast(e.message, { tone: "error" });
    }
  };
  const save = async () => {
    setBusy(true);
    try {
      const saved = await api(path, { method: "PATCH", body: changes });
      setDraft({ name: saved.profile.name, short_description: saved.profile.short_description, description: saved.profile.description, ...saved.settings });
      setPhoto(undefined);
      await Promise.all([bot.reload(), channels.reload()]);
      toast(t("Bot updated"), { sub: t("Customers see the changes the next time they open the chat.") });
    } catch (e) {
      toast(e.message, { tone: "error", duration: 8000 });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="channel-section" aria-labelledby="bot-profile">
        <div className="channel-section-head">
          <h2 className="section-title" id="bot-profile">{t("Profile")}</h2>
          <p className="helper">{t("How the bot looks in Telegram. Its username, @{username}, can only be changed in BotFather.", { username: profile.username })}</p>
        </div>
        <div className="logo-picker">
          <span className={"logo-thumb bot-photo" + (shownPhoto ? " has-logo" : "")} aria-hidden="true">
            {shownPhoto ? <img src={shownPhoto} alt="" /> : initialsOf(draft.name || "?")}
          </span>
          {canEdit && (
            <div className="bot-photo-actions">
              <Button size="sm" onClick={() => input.current.click()}>
                {shownPhoto ? t("Replace photo") : t("Upload photo")}
              </Button>
              {agent.widget?.logo && (
                <Button size="sm" onClick={() => pick(agent.widget.logo)}>
                  {t("Use the widget logo")}
                </Button>
              )}
              {shownPhoto && (
                <Button size="sm" variant="ghost" onClick={() => setPhoto(null)}>
                  {t("Remove")}
                </Button>
              )}
              <input
                ref={input}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                onChange={async (e) => {
                  const file = e.target.files[0];
                  e.target.value = "";
                  if (!file) return;
                  if (file.size > 5 * 1024 * 1024) return toast(t("Use an image smaller than 5 MB."), { tone: "error" });
                  try {
                    await pick(await readFile(file));
                  } catch (err) {
                    toast(err.message, { tone: "error" });
                  }
                }}
              />
            </div>
          )}
        </div>
        <TextInput id="bot-name" label={t("Name")} value={draft.name} maxLength={64} onChange={set("name")} disabled={!canEdit} />
        <TextInput id="bot-about" label={t("About")} hint={t("On the bot's profile, and next to the link when someone shares it.")} value={draft.short_description} maxLength={120} onChange={set("short_description")} disabled={!canEdit} />
        <Textarea id="bot-description" label={t("What can this bot do?")} hint={t("Shown in an empty chat, before the customer presses Start.")} rows={3} value={draft.description} maxLength={512} onChange={set("description")} disabled={!canEdit} />
      </section>

      <section className="channel-section" aria-labelledby="bot-buttons">
        <div className="channel-section-head">
          <h2 className="section-title" id="bot-buttons">{t("Buttons under the greeting")}</h2>
          <p className="helper">{t("Shown after /start, in place of the keyboard. Customers can always type instead.")}</p>
        </div>
        <SwitchField id="bot-suggestions" label={t("Suggested questions")} hint={t("The agent's suggested questions, translated for each customer.")} checked={draft.suggestions} onChange={(v) => setDraft({ ...draft, suggestions: v })} disabled={!canEdit} />
        <SwitchField
          id="bot-person"
          label={t("Talk to a person")}
          hint={agent.handoff ? t("Hands the chat to your team. /operator does the same.") : t("Turn on human handoff in the Playground to offer it.")}
          checked={draft.person_button && agent.handoff}
          onChange={(v) => setDraft({ ...draft, person_button: v })}
          disabled={!canEdit || !agent.handoff}
        />
      </section>

      {canEdit && (
        <div className="row" style={{ gap: 10 }}>
          <Button variant="primary" onClick={save} loading={busy} disabled={!dirty || !draft.name.trim()}>
            {t("Save changes")}
          </Button>
          {dirty && !busy && (
            <Button variant="ghost" onClick={() => (setDraft({ name: profile.name, short_description: profile.short_description, description: profile.description, ...settings }), setPhoto(undefined))}>
              {t("Discard")}
            </Button>
          )}
        </div>
      )}
    </>
  );
}
