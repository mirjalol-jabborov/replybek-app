import { IntegrationWizard } from "./integration-builder.jsx";
import { useState } from "react";
import { t } from "../i18n.js";
import { Icon } from "../icons.jsx";
import { api } from "../api.js";
import { useWorkspace } from "../workspace.jsx";
import { useResource } from "../hooks.js";
import {
  Confirm,
  Button,
  IconButton,
  ActionMenu,
  PageHeader,
  Table,
  Callout,
  EmptyState,
  useToast,
  fmt,
} from "../ui.jsx";
import { Loading } from "./shared.jsx";

// What the JSON editor starts with: everything the tools need besides the sign-in settings.

const hostOf = (url) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

/** Systems the agents can act in for signed-in customers: their orders, prices, balances. */
export function Integrations() {
  const { base, agents, isAdmin, roleAdmin } = useWorkspace();
  const toast = useToast();
  const list = useResource(roleAdmin ? `${base}/integrations` : null);
  const setup = useResource(roleAdmin ? `${base}/integrations/setup` : null);
  const [editing, setEditing] = useState(null); // {} for a new one
  const [deleting, setDeleting] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const filtered = (list.data || []).filter(
    (i) =>
      (filter === "all" || (filter === "enabled" ? i.enabled : !i.enabled)) &&
      `${i.name} ${i.base_url}`.toLowerCase().includes(search.toLowerCase()),
  );
  const agentName = (id) => agents.find((a) => a.id === id)?.name || t("Agent");

  const toggle = async (i) => {
    try {
      await api(`${base}/integrations/${i.id}`, {
        method: "PATCH",
        body: { enabled: !i.enabled },
      });
      await list.reload();
      toast(
        i.enabled
          ? t("{name} is turned off", { name: i.name })
          : t("{name} is turned on", { name: i.name }),
      );
    } catch (e) {
      toast(e.message, { tone: "error" });
    }
  };

  const columns = [
    {
      key: "name",
      header: t("Integration"),
      render: (i) => (
        <div className="cell-text">
          <div className="cell-title truncate">{i.name}</div>
          <div className="cell-sub truncate">{hostOf(i.base_url)}</div>
        </div>
      ),
    },
    {
      key: "agent",
      header: t("Agent"),
      hideSm: true,
      render: (i) => <span className="sec">{agentName(i.agent_id)}</span>,
    },
    {
      key: "tools",
      header: t("Actions"),
      shrink: true,
      render: (i) => {
        const writes = i.tools.filter((x) => x.kind === "write").length;
        return (
          <span className="sec">
            {t("{reads} lookups · {writes} changes", {
              reads: i.tools.length - writes,
              writes,
            })}
          </span>
        );
      },
    },
    {
      key: "conn",
      header: t("Signed-in customers"),
      align: "right",
      shrink: true,
      hideSm: true,
      render: (i) => <span className="num">{fmt(i.connections)}</span>,
    },
    {
      key: "status",
      header: t("Status"),
      shrink: true,
      render: (i) => (
        <span className="badge">
          {!i.enabled
            ? t("Disabled")
            : i.readiness === "needs_actions"
              ? t("Needs actions")
              : i.readiness === "needs_test"
                ? t("Needs testing")
                : i.readiness === "simulated"
                  ? t("Simulation passed")
                  : t("Read test passed")}
        </span>
      ),
    },
    {
      key: "actions",
      header: t("Actions"),
      srHeader: true,
      shrink: true,
      align: "right",
      render: (i) => (
        <ActionMenu
          label={t("Actions for {name}", { name: i.name })}
          items={[
            ...(isAdmin
              ? [
                  {
                    label: t("Edit"),
                    icon: "settings",
                    onSelect: () => setEditing(i),
                  },
                ]
              : []),
            {
              label: t("Export configuration"),
              icon: "copy",
              onSelect: async () => {
                try {
                  const data = await api(`${base}/integrations/${i.id}/export`);
                  const url = URL.createObjectURL(
                    new Blob([JSON.stringify(data, null, 2)], {
                      type: "application/json",
                    }),
                  );
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "replybek-integration.json";
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                } catch (e) {
                  toast(e.message, { tone: "error" });
                }
              },
            },
            ...(isAdmin
              ? [
                  {
                    label: i.enabled ? t("Turn off") : t("Turn on"),
                    icon: i.enabled ? "pause" : "play",
                    onSelect: () => toggle(i),
                  },
                  { separator: true },
                  {
                    label: t("Delete integration"),
                    icon: "trash",
                    danger: true,
                    onSelect: () => setDeleting(i),
                  },
                ]
              : []),
          ]}
          trigger={(p) => (
            <IconButton
              icon="more"
              label={t("Actions for {name}", { name: i.name })}
              size="sm"
              {...p}
            />
          )}
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t("Integrations")}
        description={t(
          "Let agents look things up and make changes in your systems for signed-in customers.",
        )}
        actions={
          isAdmin &&
          agents.length > 0 && (
            <Button
              variant="primary"
              icon="plus"
              onClick={() => setEditing({})}
            >
              {t("Add integration")}
            </Button>
          )
        }
      />
      <div className="page-body">
        <div className="page-inner stack" style={{ gap: 16 }}>
          {!roleAdmin ? (
            <Callout>
              {t("Only workspace admins can manage integrations.")}
            </Callout>
          ) : !list.data ? (
            <Loading />
          ) : list.data.length === 0 ? (
            <div className="box">
              <EmptyState
                icon="link"
                title={t("No integrations yet")}
                action={
                  isAdmin &&
                  agents.length > 0 && (
                    <Button
                      variant="primary"
                      size="sm"
                      icon="plus"
                      onClick={() => setEditing({})}
                    >
                      {t("Add integration")}
                    </Button>
                  )
                }
              >
                {t(
                  "Connect your business system, choose what the agent can do, and test it before going live. Start with forms or import your API definition.",
                )}
              </EmptyState>
            </div>
          ) : (
            <>
              <div className="integration-toolbar">
                <div
                  className="action-request-tabs"
                  role="tablist"
                  aria-label={t("Integration status")}
                >
                  {[
                    ["all", t("All integrations")],
                    ["enabled", t("Enabled")],
                    ["draft", t("Drafts")],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="tab"
                      aria-selected={filter === value}
                      onClick={() => setFilter(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="integration-search">
                  <Icon name="search" size={16} />
                  <input
                    className="input"
                    aria-label={t("Search integrations")}
                    placeholder={t("Search integrations")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <Table
                caption={t("Integrations")}
                columns={columns}
                rows={filtered}
                rowKey={(i) => i.id}
                onRowClick={isAdmin ? (i) => setEditing(i) : undefined}
              />
              {!filtered.length && (
                <p className="helper">
                  {t("No integrations match your search.")}
                </p>
              )}
            </>
          )}
        </div>
      </div>
      {editing && (
        <IntegrationWizard
          integration={editing}
          redirectUri={setup.data?.redirect_uri}
          onClose={() => setEditing(null)}
          onSaved={list.reload}
        />
      )}
      {deleting && (
        <Confirm
          title={t("Delete {name}?", { name: deleting.name })}
          body={t(
            "Customers' sign-ins to it are removed, and the agent can no longer use its tools.",
          )}
          confirmLabel={t("Delete integration")}
          danger
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            try {
              await api(`${base}/integrations/${deleting.id}`, {
                method: "DELETE",
              });
              await list.reload();
              toast(t("{name} was deleted", { name: deleting.name }));
            } catch (e) {
              toast(e.message, { tone: "error" });
            }
          }}
        />
      )}
    </>
  );
}
