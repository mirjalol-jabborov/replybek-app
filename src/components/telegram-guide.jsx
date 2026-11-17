import { useEffect, useRef, useState } from "react";
import { t } from "../i18n.js";
import { Icon } from "../icons.jsx";
import { Button, IconButton } from "./controls.jsx";

/**
 * Short walkthroughs of what to do inside Telegram, played on a small phone like a looping GIF: each
 * step is a few screens, and a tap mark shows where to press before the next one appears. Drawn
 * here rather than recorded, so they follow the dashboard's language and theme and show the
 * workspace's own bot.
 *
 * A screen is { view, ms, tap, ...view fields }. `tap` names the button pressed at the end of it.
 *   chat        title, sub, messages [{ me, text, buttons: [[label]] }], typing, start
 *   list        title, items [{ label, icon }]
 *   automation  bot (typed so far), found, reply, added
 */

// Read when a guide is built, so they follow the dashboard's language.
const botFather = () => ({ title: "BotFather", sub: t("bot") });
const settingsItems = () => [
  [
    { label: t("Notifications and Sounds"), icon: "bell", c: "red" },
    { label: t("Privacy and Security"), icon: "lock", c: "gray" },
    { label: t("Data and Storage"), icon: "server", c: "green" },
    { label: t("Appearance"), icon: "sun", c: "blue" },
    { label: t("Language"), icon: "globe", c: "violet" },
  ],
  [
    { label: "Telegram Premium", icon: "sparkCheck", c: "purple" },
    { label: t("My Stars"), icon: "activity", c: "orange" },
    { label: "Telegram Business", icon: "building", c: "pink" },
    { label: t("Send a Gift"), icon: "package", c: "teal" },
  ],
];
const businessItems = () => [
  [
    { label: t("Opening Hours"), icon: "clock", c: "red" },
    { label: t("Quick Replies"), icon: "reset", c: "red" },
    { label: t("Greeting Messages"), icon: "hand", c: "pink" },
    { label: t("Away Messages"), icon: "moon", c: "violet" },
    { label: t("Links to Chat"), icon: "link", c: "violet" },
    { label: t("Start Page"), icon: "info", c: "indigo" },
    { label: t("Chatbots"), sub: t("Add any third-party chatbots that will process customer interactions."), icon: "bot", c: "blue" },
  ],
];

/** Telegram Business on the workspace's bot: Secretary Mode, the one-time link, then Chat Automation. */
export function businessGuide(bot) {
  const name = bot || "@your_bot";
  const BOTFATHER_ = botFather();
  const settingsButtons = [["Inline Mode"], ["Secretary Mode"], ["Allow Groups?", "Group Privacy"], ["Payments", "Domain"], ["Menu Button"], ["« Back to Bot"]];
  return [
    {
      title: t("Turn on Secretary Mode"),
      caption: t("In @BotFather: /mybots, your bot, Bot Settings, Secretary Mode, Turn on."),
      screens: [
        { view: "chat", ...BOTFATHER_, messages: [], typing: "/mybots", tap: "send", ms: 1500 },
        { view: "chat", ...BOTFATHER_, messages: [{ me: true, text: "/mybots" }, { text: "Choose a bot from the list below:", buttons: [[name]] }], tap: name, ms: 1700 },
        { view: "chat", ...BOTFATHER_, messages: [{ text: `Here it is: ${name}. What do you want to do with the bot?`, buttons: [["Edit Bot"], ["Bot Settings"], ["Payments"], ["« Back to Bots List"]] }], tap: "Bot Settings", ms: 1700 },
        { view: "chat", ...BOTFATHER_, messages: [{ text: `Settings for ${name}.`, buttons: settingsButtons }], tap: "Secretary Mode", ms: 1900 },
        { view: "chat", ...BOTFATHER_, messages: [{ text: `Secretary Mode is disabled for ${name}.`, buttons: [["Turn on"], ["« Back to Settings"]] }], tap: "Turn on", ms: 1700 },
        { view: "chat", ...BOTFATHER_, messages: [{ text: `Success! Secretary Mode is enabled for ${name}.`, buttons: [["Turn off"], ["« Back to Settings"]] }], done: true, ms: 2200 },
      ],
    },
    {
      title: t("Open the link and press Start"),
      caption: t("Get the link on this page, open it in the Telegram account customers write to, and press Start."),
      screens: [
        { view: "chat", title: name, sub: t("bot"), messages: [], start: true, tap: "start", ms: 2000 },
        { view: "chat", title: name, sub: t("bot"), messages: [{ me: true, text: "/start" }], ms: 900 },
        { view: "chat", title: name, sub: t("bot"), messages: [{ me: true, text: "/start" }, { text: t("Your Telegram account is linked. Now add the bot in Settings › Telegram Business › Chatbots.") }], done: true, ms: 2600 },
      ],
    },
    {
      title: t("Add the bot in Chatbots"),
      caption: t("Settings › Telegram Business › Chatbots: enter your bot and keep Manage Messages on. Without Premium, it's Settings › Chat Automation."),
      screens: [
        { view: "list", title: t("Settings"), groups: settingsItems(), tap: "Telegram Business", ms: 2000 },
        { view: "list", title: "Telegram Business", back: true, groups: businessItems(), tap: t("Chatbots"), ms: 2000 },
        { view: "automation", bot: "", ms: 900 },
        { view: "automation", bot: name.replace(/^@/, ""), typing: true, ms: 1500 },
        { view: "automation", bot: name.replace(/^@/, ""), found: true, ms: 1700 },
        { view: "automation", bot: name.replace(/^@/, ""), found: true, scrolled: true, tap: "manage", ms: 1800 },
        { view: "automation", bot: name.replace(/^@/, ""), found: true, scrolled: true, manage: true, done: true, ms: 2600 },
      ],
    },
  ];
}

/** A Telegram bot of the business's own: BotFather's /newbot, then the token pasted here. */
export function botGuide() {
  const token = "7400000001:AAH3kq9Zt2...";
  const BOTFATHER_ = botFather();
  return [
    {
      title: t("Create a bot in BotFather"),
      caption: t("In @BotFather, send /newbot, then a name and a username ending in bot."),
      screens: [
        { view: "chat", ...BOTFATHER_, messages: [], typing: "/newbot", tap: "send", ms: 1500 },
        { view: "chat", ...BOTFATHER_, messages: [{ me: true, text: "/newbot" }, { text: "Alright, a new bot. How are we going to call it? Please choose a name for your bot." }], typing: "Northstar Support", tap: "send", ms: 2200 },
        { view: "chat", ...BOTFATHER_, messages: [{ me: true, text: "Northstar Support" }, { text: "Good. Now let's choose a username for your bot. It must end in `bot`." }], typing: "northstar_help_bot", tap: "send", ms: 2200 },
        { view: "chat", ...BOTFATHER_, messages: [{ me: true, text: "northstar_help_bot" }, { text: "Done! Congratulations on your new bot. Use this token to access the HTTP API:", token }], tap: "token", ms: 2400 },
        { view: "chat", ...BOTFATHER_, messages: [{ me: true, text: "northstar_help_bot" }, { text: "Done! Congratulations on your new bot. Use this token to access the HTTP API:", token, copied: true }], done: true, ms: 1800 },
      ],
    },
    {
      title: t("Paste the token here"),
      caption: t("Back on this page, paste the token and press Connect."),
      screens: [
        { view: "token", value: "", ms: 900 },
        { view: "token", value: token, ms: 1300 },
        { view: "token", value: token, tap: "connect", ms: 1300 },
        { view: "token", value: token, connected: true, done: true, ms: 2400 },
      ],
    },
  ];
}

/** The steps as tabs and the selected one playing on a loop. `start`: the step to open on. */
export function TelegramGuide({ steps, start = 0 }) {
  const [step, setStep] = useState(Math.min(start, steps.length - 1));
  const [screen, setScreen] = useState(0);
  const [tapping, setTapping] = useState(false);
  const [paused, setPaused] = useState(false);
  const reduced = useRef(typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  const current = steps[step];
  const shown = current.screens[screen];

  useEffect(() => {
    setScreen(0);
    setTapping(false);
  }, [step]);

  useEffect(() => {
    if (paused) return;
    const ms = reduced.current ? Math.max(shown.ms, 2600) : shown.ms;
    // The tap shows in the last part of a screen, so the eye has time to find it.
    const tapTimer = shown.tap ? setTimeout(() => setTapping(true), ms * 0.55) : null;
    const next = setTimeout(() => {
      setTapping(false);
      // At the end of a step, hold the last screen a moment and play it again.
      setScreen((n) => (n + 1 < current.screens.length ? n + 1 : 0));
    }, ms);
    return () => {
      clearTimeout(tapTimer);
      clearTimeout(next);
    };
  }, [step, screen, paused]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="tg-guide">
      <ol className="tg-guide-steps">
        {steps.map((s, i) => (
          <li key={s.title}>
            <button type="button" aria-current={i === step ? "step" : undefined} onClick={() => setStep(i)}>
              <span className="tg-guide-n">{i + 1}</span>
              <span>{s.title}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="tg-guide-stage">
        <div className="tg-phone" aria-hidden="true">
          <Screen screen={shown} tap={tapping ? shown.tap : null} />
        </div>
        <div className="tg-guide-side">
          <p className="tg-guide-caption">{current.caption}</p>
          <div className="tg-guide-dots" aria-hidden="true">
            {current.screens.map((_, i) => (
              <span key={i} className={i === screen ? "on" : i < screen ? "past" : ""} />
            ))}
          </div>
          <div className="tg-guide-controls">
            <IconButton icon={paused ? "play" : "pause"} label={paused ? t("Play") : t("Pause")} variant="outline" onClick={() => setPaused((p) => !p)} />
            {step + 1 < steps.length && (
              <Button size="sm" iconRight="arrowRight" onClick={() => setStep(step + 1)}>
                {t("Next step")}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Marks the element the tap lands on. */
const tapped = (tap, id) => (tap === id ? " tg-tap" : "");

/** A round Telegram avatar: a coloured gradient with the first letter. */
const Avatar = ({ name, tone = "blue" }) => <span className={"tg-ava " + tone}>{(name || "?").replace(/^@/, "")[0].toUpperCase()}</span>;

/** The phone's status bar, as on an iPhone. */
const StatusBar = () => (
  <div className="tg-status">
    <span>9:41</span>
    <span className="tg-island" />
    <span className="tg-status-icons">
      <span className="tg-signal" />
      <span className="tg-battery" />
    </span>
  </div>
);

/** A bubble's time, and for one's own message the two ticks of a read message. */
const Meta = ({ me }) => (
  <span className="tg-meta">
    16:12
    {me && <span className="tg-ticks">✓✓</span>}
  </span>
);

function Screen({ screen: s, tap }) {
  if (s.view === "list") {
    return (
      <div className="tg-ios">
        <StatusBar />
        {s.back ? (
          <div className="tg-ios-nav">
            <span className="tg-ios-round">‹</span>
            <span className="tg-ios-title">{s.title}</span>
          </div>
        ) : (
          <div className="tg-ios-big">{s.title}</div>
        )}
        {s.groups.map((group, g) => (
          <div className="tg-group" key={g}>
            {group.map((it) => (
              <div key={it.label} className={"tg-cell" + (it.sub ? " tall" : "") + tapped(tap, it.label)}>
                <span className={"tg-cell-icon " + it.c}>
                  <Icon name={it.icon} size={11} />
                </span>
                <span className="tg-cell-label">
                  <span className="tg-cell-name">{it.label}</span>
                  {it.sub && <span className="tg-cell-sub tg-wrap">{it.sub}</span>}
                </span>
                <span className="tg-chev">›</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }
  if (s.view === "automation") {
    return (
      <div className="tg-ios">
        <StatusBar />
        <div className="tg-ios-nav">
          <span className="tg-ios-round">‹</span>
        </div>
        <div className="tg-scroll">
        <div className={"tg-auto" + (s.scrolled ? " scrolled" : "")}>
          <div className="tg-auto-hero">
            <span className="tg-auto-art">
              <Icon name="bot" size={26} />
            </span>
            <span className="tg-auto-title">{t("Chat Automation")}</span>
            <span className="tg-auto-lead">{t("Add a bot to reply to messages on your behalf.")}</span>
          </div>
          <div className="tg-group">
            <div className="tg-cell tg-input-cell">
              {s.bot ? <span className="tg-field-text">{s.bot}</span> : <span className="tg-ph">{t("Bot username")}</span>}
              {s.typing && <span className="tg-caret" />}
            </div>
            {s.found && (
              <div className="tg-cell">
                <Avatar name={s.bot} tone="blue" />
                <span className="tg-cell-label">
                  <span className="tg-cell-name">{s.bot.replace(/_?bot$/i, "") || s.bot}</span>
                  <span className="tg-cell-sub">@{s.bot}</span>
                </span>
                <span className="tg-x">×</span>
              </div>
            )}
          </div>
          <div className="tg-foot">{t("Choose a bot to manage your chats automatically.")}</div>
          {s.found && (
            <>
              <div className="tg-section">{t("Chats the bot can access")}</div>
              <div className="tg-group">
                <div className="tg-cell">
                  <span className="tg-check violet">✓</span>
                  <span className="tg-cell-label tg-wrap">{t("All Private Chats Except...")}</span>
                </div>
                <div className="tg-cell">
                  <span className="tg-check" />
                  <span className="tg-cell-label tg-wrap">{t("Only Selected Chats")}</span>
                </div>
              </div>
              <div className="tg-section">{t("Bot permissions")}</div>
              <div className="tg-group">
                <div className={"tg-cell" + tapped(tap, "manage")}>
                  <span className="tg-cell-label">
                    <span className="tg-cell-name">
                      {t("Manage Messages")} <b className="tg-count">{s.manage ? "5/5" : "0/5"}</b>
                    </span>
                  </span>
                  <span className={"tg-switch" + (s.manage ? " on" : "")} />
                </div>
              </div>
            </>
          )}
        </div>
        </div>
        {s.done && <div className="tg-toast">✓ {t("Connected")}</div>}
      </div>
    );
  }
  if (s.view === "token") {
    // Back in Replybek: the dashboard's own form, not Telegram.
    return (
      <div className="tg-app">
        <StatusBar />
        <div className="tg-app-head">replybek<span>.</span></div>
        <div className="tg-app-form">
          <span className="tg-app-label">{t("Bot token")}</span>
          <div className="tg-app-field">{s.value ? <span className="tg-field-text">{s.value}</span> : <span className="tg-ph">123456789:AA...</span>}</div>
          <div className={"tg-app-btn" + tapped(tap, "connect") + (s.connected ? " done" : "")}>{s.connected ? t("Connected") : t("Connect")}</div>
        </div>
      </div>
    );
  }
  // A chat: BotFather, or the workspace's bot, on Telegram's wallpaper.
  return (
    <div className="tg-chatview">
      <StatusBar />
      <div className="tg-nav">
        <span className="tg-nav-back">‹ {t("Chats")}</span>
        <span className="tg-nav-center">
          <span className="tg-nav-title">{s.title}</span>
          <span className="tg-nav-sub">{s.sub}</span>
        </span>
        <Avatar name={s.title} tone={s.title === "BotFather" ? "blue" : "violet"} />
      </div>
      <div className="tg-wall">
        {s.messages.map((m, i) => (
          <div key={`${i}:${m.text}`} className={"tg-msg-wrap" + (m.me ? " me" : "")}>
            <div className={"tg-bubble" + (m.me ? " me" : "")}>
              <span>{m.text}</span>
              {m.token && <span className={"tg-code" + tapped(tap, "token") + (m.copied ? " copied" : "")}>{m.copied ? t("Copied") : m.token}</span>}
              <Meta me={m.me} />
            </div>
            {m.buttons && (
              <div className="tg-kb">
                {m.buttons.map((row) => (
                  <div className="tg-kb-row" key={row.join()}>
                    {row.map((b) => (
                      <span key={b} className={"tg-kb-btn" + tapped(tap, b)}>
                        {b}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      {s.start ? (
        <div className={"tg-startbar" + tapped(tap, "start")}>{t("Start").toUpperCase()}</div>
      ) : (
        <div className="tg-inputbar">
          <span className="tg-clip">
            <Icon name="clip" size={14} />
          </span>
          <span className="tg-pill">{s.typing ? <span className="tg-typed">{s.typing}</span> : <span className="tg-ph">{t("Message")}</span>}</span>
          {s.typing ? (
            <span className={"tg-sendbtn" + tapped(tap, "send")}>
              <Icon name="arrowRight" size={12} />
            </span>
          ) : (
            <span className="tg-mic" />
          )}
        </div>
      )}
    </div>
  );
}
