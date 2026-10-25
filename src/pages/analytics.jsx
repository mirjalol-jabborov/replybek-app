import { useState } from "react";
import { t } from "../i18n.js";
import { useWorkspace } from "../workspace.jsx";
import { useResource } from "../hooks.js";
import { api } from "../api.js";
import { fmt, pct, timeAgo, Button, IconButton, ActionMenu, PageHeader, Section, MetricsStrip, EmptyState, StatusBadge, Table, useToast } from "../ui.jsx";
import { VolumeChart, Legend } from "../charts.jsx";
import { AgentSelect, RangeControl, Loading } from "./shared.jsx";
import { toChart } from "./overview.jsx";

export function Analytics() {
  const { base, agents, openDialog, isAdmin } = useWorkspace();
  const [agentId, setAgentId] = useState("all");
  const [days, setDays] = useState(30);
  const toast = useToast();
  const dismiss = async (u) => {
    try {
      await api(`${base}/unanswered/${u.id}`, { method: "DELETE" });
      toast(t("Question deleted"), { sub: t("It won't come back here, even if a customer asks it again.") });
      unanswered.reload();
      stats.reload();
    } catch (e) {
      toast(e.message, { tone: "error" });
    }
  };
  const agentQ = agentId !== "all" ? `&agent=${agentId}` : "";
  const stats = useResource(`${base}/analytics?days=${days}${agentQ}`);
  const unanswered = useResource(`${base}/unanswered${agentId !== "all" ? `?agent=${agentId}` : ""}`);
  const s = stats.data;
  const rate = s ? pct(s.by_ai, s.total) : 0;
  const delta = s && s.previous_total ? Math.round(((s.total - s.previous_total) / s.previous_total) * 100) : null;
  const agentName = (id) => agents.find((a) => a.id === id)?.name || t("Agent");

  return (
    <>
      <PageHeader
        title={t("Analytics")}
        description={t("How visitors use your agents and where knowledge needs work.")}
        actions={
          <>
            <AgentSelect allowAll value={agentId} onChange={setAgentId} id="an-agent" width={220} />
            <RangeControl value={days} onChange={setDays} />
          </>
        }
      />
      <div className="page-body">
        <div className="page-inner">
          {stats.error ? (
            <div className="box">
              <EmptyState icon="alertCircle" title={t("Couldn't load analytics")} action={<Button size="sm" onClick={stats.reload}>{t("Try again")}</Button>}>
                {stats.error.message}
              </EmptyState>
            </div>
          ) : !s ? (
            <Loading />
          ) : (
            <>
              <MetricsStrip
                items={[
                  {
                    label: t("Conversations"),
                    value: fmt(s.total),
                    sub: delta === null ? t("Last {days} days", { days }) : <><span className={delta >= 0 ? "up" : "attn"}>{delta >= 0 ? "↑" : "↓"} {Math.abs(delta)}%</span> {t("vs previous {days} days", { days })}</>,
                  },
                  { label: t("Resolved by AI"), value: fmt(s.by_ai), sub: s.total ? t("{pct}% of conversations", { pct: rate }) : t("No conversations yet") },
                  { label: t("Handed to a person"), value: fmt(s.escalated), sub: s.total ? t("{pct}% of conversations", { pct: 100 - rate }) : "—" },
                  { label: t("Unanswered questions"), value: fmt(s.open_unanswered), sub: t("Need a knowledge update") },
                ]}
              />
              <Section title={t("Conversation volume")} description={`${t("Last {days} days", { days })} · ${t("per day")} · ${t("hover a bar for details")}`} actions={<Legend />}>
                {s.total === 0 ? (
                  <div className="box">
                    <EmptyState icon="chart" title={t("No conversations in this period")}>
                      {t("Once visitors chat with a published agent, volume shows up here.")}
                    </EmptyState>
                  </div>
                ) : (
                  <VolumeChart data={toChart(s.series)} height={240} caption={t("Conversation volume, last {days} days", { days })} />
                )}
              </Section>
              {s.total > 0 && (
                <Section title={t("AI resolution vs handoff")} description={t("Last {days} days", { days })}>
                  <div className="stack" style={{ maxWidth: 560 }}>
                    <div className="split-bar" role="img" aria-label={t("{a}% resolved by AI, {b}% handed to a person", { a: rate, b: 100 - rate })}>
                      <span style={{ width: rate + "%", background: "var(--series-1)" }} />
                      <span style={{ width: 100 - rate + "%", background: "var(--series-2)" }} />
                    </div>
                    <div className="row-wrap text-sm" style={{ justifyContent: "space-between" }}>
                      <span className="row" style={{ gap: 6 }}>
                        <i className="key" style={{ background: "var(--series-1)" }} />
                        {t("Resolved by AI")} <strong className="num">{rate}%</strong>
                      </span>
                      <span className="row" style={{ gap: 6 }}>
                        <i className="key" style={{ background: "var(--series-2)" }} />
                        {t("Handed to a person")} <strong className="num">{100 - rate}%</strong>
                      </span>
                    </div>
                  </div>
                </Section>
              )}
            </>
          )}

          <Section title={t("Unanswered questions")} description={t("Questions the agent couldn't answer from its knowledge. Adding an answer creates a Q&A source.")}>
            {!unanswered.data ? (
              <Loading />
            ) : unanswered.data.length === 0 ? (
              <div className="box">
                <EmptyState icon="checkCircle" title={t("No unanswered questions")}>
                  {t("The agent found an answer for every question so far.")}
                </EmptyState>
              </div>
            ) : (
              <Table
                caption={t("Unanswered questions")}
                rowKey={(u) => u.id}
                rows={unanswered.data}
                columns={[
                  { key: "q", header: t("Question"), render: (u) => <span className="cell-title" style={{ overflowWrap: "anywhere" }}>{u.question}</span> },
                  ...(agentId === "all" ? [{ key: "agent", header: t("Agent"), shrink: true, hideSm: true, render: (u) => <span className="sec">{agentName(u.agent_id)}</span> }] : []),
                  { key: "n", header: t("Times asked"), align: "right", shrink: true, render: (u) => <span className="num">{u.times}</span> },
                  { key: "t", header: t("Last asked"), shrink: true, hideSm: true, render: (u) => <span className="num sec">{timeAgo(u.last_asked_at)}</span> },
                  {
                    key: "a",
                    header: t("Action"),
                    srHeader: true,
                    shrink: true,
                    align: "right",
                    render: (u) => (
                      <div className="row" style={{ gap: 4, justifyContent: "flex-end" }}>
                        {u.answered_at ? (
                          <StatusBadge status="ready" label={t("Answer added")} />
                        ) : isAdmin ? (
                          <Button size="sm" icon="plus" onClick={() => openDialog("addKnowledge", { tab: "qa", prefillQ: u.question, agentId: u.agent_id, unansweredId: u.id, onDone: () => { unanswered.reload(); stats.reload(); } })}>
                            {t("Add answer")}
                          </Button>
                        ) : null}
                        {isAdmin && <ActionMenu label={t("Actions for “{name}”", { name: u.question })} items={[{ label: t("Delete question"), icon: "trash", danger: true, onSelect: () => dismiss(u) }]} trigger={(p) => <IconButton icon="more" label={t("Actions for “{name}”", { name: u.question })} size="sm" {...p} />} />}
                      </div>
                    ),
                  },
                ]}
              />
            )}
          </Section>
        </div>
      </div>
    </>
  );
}
