import { useState } from "react";
import { t, locale } from "../i18n.js";
import { Icon } from "../icons.jsx";
import { useWorkspace } from "../workspace.jsx";
import { useResource, go } from "../hooks.js";
import { fmt, pct, timeAgo, shortAge, capitalize, Avatar, StatusBadge, Button, PageHeader, Section, MetricsStrip, EmptyState, initialsOf, toneOf } from "../ui.jsx";
import { VolumeChart, Legend } from "../charts.jsx";
import { RangeControl, Loading } from "./shared.jsx";

const dayLabel = (d, opts) => new Date(`${d}T12:00:00`).toLocaleDateString(locale(), opts);
export const toChart = (series) =>
  series.map((s) => ({
    label: dayLabel(s.day, { month: "short", day: "numeric" }),
    long: dayLabel(s.day, { weekday: "short", month: "short", day: "numeric" }),
    total: s.total,
    escalated: s.escalated,
    resolved: s.by_ai,
  }));

export function Overview() {
  const { base, workspace, agents, agentsLoaded, memberName, openDialog, user, activeAgent, setActiveAgent, isAdmin } = useWorkspace();
  const [days, setDays] = useState(30);
  const stats = useResource(`${base}/analytics?days=${days}`);
  const waiting = useResource(`${base}/conversations?view=needs_human`, { poll: 10000, live: true });
  const mine = useResource(`${base}/conversations?view=mine`, { poll: 10000, live: true });
  const failing = useResource(`${base}/sources?status=error`);
  const unanswered = useResource(`${base}/unanswered`);
  const activity = useResource(`${base}/activity`);

  const s = stats.data;
  const usage = workspace.usage;
  const limits = workspace.limits;
  const waitingList = [...(waiting.data || [])].sort((a, b) => new Date(a.last_message_at) - new Date(b.last_message_at));
  const mineList = (mine.data || []).filter((c) => c.status === "human");
  const gaps = (unanswered.data || []).filter((u) => !u.answered_at).slice(0, 3);
  const agentName = (id) => agents.find((a) => a.id === id)?.name || t("Agent");
  const delta = s && s.previous_total ? Math.round(((s.total - s.previous_total) / s.previous_total) * 100) : null;

  const checklist = [
    {
      id: "agent",
      title: t("Create an agent"),
      done: agents.length > 0,
      go: () => (agents.length || !isAdmin ? go("agents") : openDialog("createAgent")),
    },
    {
      id: "knowledge",
      title: t("Add knowledge"),
      done: (activeAgent?.source_count || 0) > 0,
      go: () => go("knowledge"),
    },
    {
      id: "test",
      title: t("Test answers in the Playground"),
      done: (() => {
        try {
          return Boolean(localStorage.getItem(`replybek.tested.${activeAgent?.id}`));
        } catch {
          return false;
        }
      })(),
      go: () => go("playground"),
    },
    {
      id: "publish",
      title: t("Publish your agent"),
      done: activeAgent?.status === "active",
      go: () => go("playground"),
    },
  ];
  const doneCount = checklist.filter((c) => c.done).length;
  const nextStep = checklist.find((c) => !c.done);

  return (
    <>
      <PageHeader title={t("Overview")} description={`${workspace.name} · ${t("all agents")}`} actions={<RangeControl value={days} onChange={setDays} />} />
      <div className="page-body">
        <div className="page-inner">
          <div className="home-welcome">
            <div>
              <span className="eyebrow">{t("Your support workspace")}</span>
              <h2>{t("Welcome back, {name}", { name: user.name.split(" ")[0] })}</h2>
              <p>{t("Build your agent, help your customers, and keep improving.")}</p>
            </div>
            <Button icon="inbox" onClick={() => go("inbox")}>
              {t("Open inbox")}
            </Button>
          </div>
          {agentsLoaded && nextStep && (
            <section className="setup-guide" aria-label={t("Get set up")}>
              <div className="setup-guide-head">
                <span className="setup-guide-icon">
                  <Icon name="layers" size={22} />
                </span>
                <div>
                  <h2>{t("Get set up")}</h2>
                  <p>
                    {activeAgent ? activeAgent.name : t("Your first agent starts here.")} ·{" "}
                    {t("{done} of {total} steps done", {
                      done: doneCount,
                      total: checklist.length,
                    })}
                  </p>
                </div>
                <Button variant="primary" iconRight="arrowRight" onClick={nextStep.go}>
                  {nextStep.title}
                </Button>
              </div>
              <div className="setup-guide-steps">
                {checklist.map((c, i) => (
                  <button key={c.id} type="button" className={"setup-guide-step" + (c.done ? " done" : "") + (c === nextStep ? " next" : "")} onClick={c.go}>
                    <span>{c.done ? <Icon name="check" size={13} /> : i + 1}</span>
                    {c.title}
                  </button>
                ))}
              </div>
            </section>
          )}
          <MetricsStrip
            items={[
              {
                label: t("Waiting for a teammate"),
                value: (
                  <>
                    {waitingList.length} <small>{t("now")}</small>
                  </>
                ),
                sub: waitingList.length ? (
                  <span className="attn">
                    {t("Longest wait {age}", {
                      age: shortAge(waitingList[0].last_message_at),
                    })}
                  </span>
                ) : (
                  t("Nobody is waiting")
                ),
                onClick: () => go("inbox", waitingList[0]?.id),
              },
              {
                label: t("Resolved by AI"),
                value: s ? `${pct(s.by_ai, s.total)}%` : "—",
                sub: s
                  ? t("{done} of {total} conversations", {
                      done: fmt(s.by_ai),
                      total: fmt(s.total),
                    })
                  : " ",
              },
              {
                label: t("Conversations"),
                value: s ? fmt(s.total) : "—",
                sub: s ? (
                  delta === null ? (
                    t("Last {days} days", { days })
                  ) : (
                    <>
                      <span className={delta >= 0 ? "up" : "attn"}>
                        {delta >= 0 ? "↑" : "↓"} {Math.abs(delta)}%
                      </span>{" "}
                      {t("vs previous {days} days", { days })}
                    </>
                  )
                ) : (
                  " "
                ),
              },
              {
                label: t("AI messages used"),
                value: usage ? (
                  <>
                    {fmt(usage.messages)} <small>/ {fmt(limits.messages)}</small>
                  </>
                ) : (
                  "—"
                ),
                sub: usage
                  ? t("{pct}% of this month's allowance", {
                      pct: pct(usage.messages, limits.messages),
                    })
                  : " ",
              },
            ]}
          />

          <div className="split">
            <div className="stack" style={{ gap: 28 }}>
              <Section
                title={t("Needs attention")}
                description={t("Conversations handed to your team, longest wait first.")}
                actions={
                  <Button size="sm" variant="ghost" iconRight="arrowRight" onClick={() => go("inbox")}>
                    {t("Open inbox")}
                  </Button>
                }
              >
                <div className="box">
                  {waiting.loading && !waiting.data ? (
                    <Loading />
                  ) : waitingList.length === 0 && mineList.length === 0 ? (
                    <EmptyState icon="checkCircle" title={t("Nobody is waiting")}>
                      {t("The AI is handling every open conversation.")}
                    </EmptyState>
                  ) : (
                    [...waitingList.map((c) => ({ c, mine: false })), ...mineList.map((c) => ({ c, mine: true }))].map(({ c, mine: isMine }) => {
                      const name = c.visitor?.name || t("Website visitor");
                      return (
                        <div className="list-row" key={c.id}>
                          <Avatar initials={initialsOf(name)} tone={toneOf(c.id)} />
                          <div className="attn-main">
                            <div className="row" style={{ gap: 6 }}>
                              <span className="cell-title truncate">{name}</span>
                              <span className="helper truncate">· {agentName(c.agent_id)}</span>
                            </div>
                            <div className="helper truncate">{isMine ? `${t("You're handling this")} · ${c.subject || ""}` : c.subject}</div>
                          </div>
                          {isMine ? (
                            <StatusBadge status="human" />
                          ) : (
                            <div className="attn-meta hide-sm">
                              <div>
                                {t("Waiting {age}", {
                                  age: shortAge(c.last_message_at),
                                })}
                              </div>
                              <div>{c.assignee_id ? (c.assignee_id === user.id ? t("You") : memberName(c.assignee_id)) : t("Unassigned")}</div>
                            </div>
                          )}
                          <Button size="sm" onClick={() => go("inbox", c.id)}>
                            {t("Open")}
                          </Button>
                        </div>
                      );
                    })
                  )}
                </div>
              </Section>

              <Section
                title={t("Knowledge gaps")}
                description={t("Sources that failed and questions the agent couldn't answer.")}
                actions={
                  <Button size="sm" variant="ghost" iconRight="arrowRight" onClick={() => go("analytics")}>
                    {t("All unanswered")}
                  </Button>
                }
              >
                <div className="box">
                  {(failing.data || []).length === 0 && gaps.length === 0 ? (
                    <EmptyState icon="checkCircle" title={t("No gaps right now")}>
                      {t("Every source is ready, and recent questions were answered.")}
                    </EmptyState>
                  ) : (
                    <>
                      {(failing.data || []).map((src) => (
                        <div className="list-row" key={src.id}>
                          <span className="type-icon" style={{ color: "var(--amber)" }}>
                            <Icon name="alert" size={15} />
                          </span>
                          <div className="attn-main">
                            <div className="cell-title truncate">{src.name}</div>
                            <div className="helper truncate">
                              {agentName(src.agent_id)} · {src.error}
                            </div>
                          </div>
                          <Button size="sm" onClick={() => go("knowledge", src.id)}>
                            {t("Review")}
                          </Button>
                        </div>
                      ))}
                      {gaps.map((u) => (
                        <div className="list-row" key={u.id}>
                          <span className="type-icon">
                            <Icon name="qa" size={15} />
                          </span>
                          <div className="attn-main">
                            <div className="cell-title truncate">{u.question}</div>
                            <div className="helper">
                              {t("Asked {count} times", { count: u.times })} ·{" "}
                              {t("last {when}", {
                                when: timeAgo(u.last_asked_at),
                              })}{" "}
                              · {agentName(u.agent_id)}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() =>
                              openDialog("addKnowledge", {
                                tab: "qa",
                                prefillQ: u.question,
                                agentId: u.agent_id,
                                unansweredId: u.id,
                                onDone: unanswered.reload,
                              })
                            }
                          >
                            {t("Add answer")}
                          </Button>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </Section>
            </div>

            <div className="stack" style={{ gap: 28 }}>
              <Section
                title={t("Your agents")}
                actions={
                  <Button size="sm" variant="ghost" onClick={() => go("agents")}>
                    {t("View all")}
                  </Button>
                }
              >
                <div className="home-agents">
                  {agents.slice(0, 3).map((a) => (
                    <button
                      type="button"
                      key={a.id}
                      className="home-agent"
                      onClick={() => {
                        setActiveAgent(a.id);
                        go("playground");
                      }}
                    >
                      <Avatar initials={initialsOf(a.name)} tone={toneOf(a.id)} src={a.widget?.logo || undefined} square />
                      <span>
                        <strong>{a.name}</strong>
                        <small>{t("{count} sources", { count: a.source_count || 0 })}</small>
                      </span>
                      <StatusBadge status={a.status} label={a.status === "active" ? t("Published") : t("Draft")} />
                    </button>
                  ))}
                  {!agents.length && <p className="helper">{t("Create an agent to start answering customer questions.")}</p>}
                </div>
              </Section>
              <Section title={t("Recent activity")}>
                {(activity.data || []).length === 0 ? (
                  <p className="helper">{t("Changes to agents, knowledge and conversations show up here.")}</p>
                ) : (
                  <div className="feed">
                    {activity.data.slice(0, 20).map((a) => (
                      <div className="feed-item" key={a.id}>
                        <span className="feed-dot" />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ overflowWrap: "anywhere" }}>
                            {a.key
                              ? t(a.key, {
                                  ...a.params,
                                  plan: capitalize(a.params?.plan || ""),
                                })
                              : a.text}
                          </div>
                          <div className="feed-time">
                            {timeAgo(a.created_at)}
                            {a.detail ? ` · ${a.detail_key ? t(a.detail_key) : a.detail}` : ""}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </div>
          </div>

          <Section title={t("Conversation volume")} description={`${t("Last {days} days", { days })} · ${t("per day")}`} actions={<Legend />}>
            {s ? <VolumeChart data={toChart(s.series)} height={180} caption={t("Conversation volume, last {days} days", { days })} /> : <Loading />}
          </Section>
        </div>
      </div>
    </>
  );
}
