import { Icon } from "../icons.jsx";
import { t, tk } from "../i18n.js";
import { Tooltip } from "./overlay.jsx";
import React, { useRef, useState, useCallback, createContext, useContext } from "react";


// ───── Buttons ─────
export const Button = React.forwardRef(function Button({ variant = "secondary", size = "md", icon, iconRight, loading, children, className = "", type = "button", disabled, ...rest }, ref) {
  const is = size === "sm" ? 14 : 15;
  return (
    <button ref={ref} type={type} className={`btn btn-${variant}${size === "sm" ? " btn-sm" : ""} ${className}`} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <Icon name="loader" size={is} className="spin" /> : icon ? <Icon name={icon} size={is} /> : null}
      {children != null && <span className="btn-label">{children}</span>}
      {iconRight && <Icon name={iconRight} size={14} />}
    </button>
  );
});

export const IconButton = React.forwardRef(function IconButton({ icon, label, size = "md", variant = "ghost", tooltip = true, className = "", ...rest }, ref) {
  const btn = (
    <button ref={ref} type="button" aria-label={label} className={`icon-btn${size === "sm" ? " sm" : ""}${variant === "outline" ? " outline" : ""} ${className}`} {...rest}>
      <Icon name={icon} size={size === "sm" ? 15 : 16} />
    </button>
  );
  return tooltip ? <Tooltip label={label}>{btn}</Tooltip> : btn;
});

// ───── Fields ─────
export const describedBy = (id, hint, error) => [error && id + "-err", hint && id + "-hint"].filter(Boolean).join(" ") || undefined;

export function Field({ id, label, hint, error, optional, layout = "stack", children, tight }) {
  const labelEl = (
    <label className="field-label" htmlFor={id} id={id + "-label"}>
      {label} {optional && <span className="opt">{t("(optional)")}</span>}
    </label>
  );
  const err = error && (
    <span className="field-error" id={id + "-err"}>
      <Icon name="alertCircle" size={13} />
      {error}
    </span>
  );
  const hintEl = hint && (
    <span className="field-hint" id={id + "-hint"}>
      {hint}
    </span>
  );
  if (layout === "row") {
    return (
      <div className="field-row">
        <div className={"field-row-label" + (tight ? " tight" : "")}>
          {labelEl}
          {hintEl}
        </div>
        <div className="field-row-control">
          {children}
          {err}
        </div>
      </div>
    );
  }
  return (
    <div className="field">
      {labelEl}
      {children}
      {err || hintEl}
    </div>
  );
}

export const TextInput = React.forwardRef(function TextInput({ id, label, hint, error, optional, layout, icon, size, prefix, className = "", ...rest }, ref) {
  const input = <input ref={ref} id={id} className={`input${size === "sm" ? " sm" : ""} ${className}`} aria-invalid={error ? true : undefined} aria-describedby={label ? describedBy(id, hint, error) : undefined} {...rest} />;
  let control = input;
  if (icon)
    control = (
      <div className={"input-wrap" + (size === "sm" ? " sm" : "")}>
        <Icon name={icon} size={size === "sm" ? 14 : 15} />
        {input}
      </div>
    );
  if (prefix)
    control = (
      <div className="prefix-input">
        <span className="prefix">{prefix}</span>
        {input}
      </div>
    );
  if (!label) return control;
  return (
    <Field id={id} label={label} hint={hint} error={error} optional={optional} layout={layout}>
      {control}
    </Field>
  );
});

export const Textarea = React.forwardRef(function Textarea({ id, label, hint, error, optional, layout, rows = 3, className = "", ...rest }, ref) {
  const el = <textarea ref={ref} id={id} rows={rows} className={"textarea " + className} aria-invalid={error ? true : undefined} aria-describedby={label ? describedBy(id, hint, error) : undefined} {...rest} />;
  if (!label) return el;
  return (
    <Field id={id} label={label} hint={hint} error={error} optional={optional} layout={layout}>
      {el}
    </Field>
  );
});

export function Switch({ id, checked, onChange, label, disabled, describedById }) {
  return (
    <span className="switch">
      <input type="checkbox" role="switch" id={id} aria-label={label} aria-describedby={describedById} checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="track" />
      <span className="thumb" />
    </span>
  );
}

/** Label + hint on the left, switch on the right. */
export function SwitchField({ id, label, hint, checked, onChange, disabled, layout }) {
  const sw = <Switch id={id} checked={checked} onChange={onChange} disabled={disabled} describedById={hint ? id + "-hint" : undefined} />;
  if (layout === "row") {
    return (
      <div className="field-row">
        <div className="field-row-label tight">
          <label className="field-label" htmlFor={id}>
            {label}
          </label>
          {hint && (
            <span className="field-hint" id={id + "-hint"}>
              {hint}
            </span>
          )}
        </div>
        <div className="field-row-control">{sw}</div>
      </div>
    );
  }
  return (
    <div className="switch-row">
      <div className="stack-xs">
        <label className="field-label" htmlFor={id}>
          {label}
        </label>
        {hint && (
          <span className="field-hint" id={id + "-hint"}>
            {hint}
          </span>
        )}
      </div>
      {sw}
    </div>
  );
}

// ───── Segmented control (radio group) ─────
export function SegmentedControl({ options, value, onChange, label, full, className = "" }) {
  const refs = useRef([]);
  const cur = Math.max(0, options.findIndex((o) => o.value === value));
  const move = (d) => {
    let i = cur;
    for (let k = 0; k < options.length; k++) {
      i = (i + d + options.length) % options.length;
      if (!options[i].disabled) break;
    }
    onChange(options[i].value);
    refs.current[i] && refs.current[i].focus();
  };
  return (
    <div className={`seg${full ? " full" : ""} ${className}`} role="radiogroup" aria-label={label}>
      {options.map((o, i) => (
        <button
          key={o.value}
          ref={(el) => (refs.current[i] = el)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          aria-label={o.ariaLabel}
          tabIndex={i === cur ? 0 : -1}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowDown") {
              e.preventDefault();
              move(1);
            } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
              e.preventDefault();
              move(-1);
            }
          }}
        >
          {o.icon && <Icon name={o.icon} size={14} />}
          {o.label && <span className={o.hideLabelSm ? "hide-sm" : ""}>{o.label}</span>}
          {o.count != null && <span className="seg-count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

// ───── Tabs ─────
export function Tabs({ tabs, value, onChange, label, idBase, vertical }) {
  const refs = useRef([]);
  const cur = Math.max(0, tabs.findIndex((tab) => tab.value === value));
  const move = (d) => {
    const i = (cur + d + tabs.length) % tabs.length;
    onChange(tabs[i].value);
    refs.current[i] && refs.current[i].focus();
  };
  return (
    <div className={vertical ? "vtabs" : "tabs"} role="tablist" aria-label={label} aria-orientation={vertical ? "vertical" : undefined}>
      {tabs.map((tab, i) => (
        <button
          key={tab.value}
          ref={(el) => (refs.current[i] = el)}
          type="button"
          role="tab"
          id={`${idBase}-tab-${tab.value}`}
          aria-controls={`${idBase}-panel-${tab.value}`}
          aria-selected={tab.value === value}
          tabIndex={tab.value === value ? 0 : -1}
          onClick={() => onChange(tab.value)}
          onKeyDown={(e) => {
            const next = vertical ? "ArrowDown" : "ArrowRight";
            const prev = vertical ? "ArrowUp" : "ArrowLeft";
            if (e.key === next) {
              e.preventDefault();
              move(1);
            } else if (e.key === prev) {
              e.preventDefault();
              move(-1);
            } else if (e.key === "Home") {
              e.preventDefault();
              move(-cur);
            } else if (e.key === "End") {
              e.preventDefault();
              move(tabs.length - 1 - cur);
            }
          }}
        >
          {tab.icon && <Icon name={tab.icon} size={15} />}
          {tab.label}
          {tab.count != null && <span className="tab-count">{tab.count}</span>}
          {tab.dirty && <span className="dirty-dot" aria-label={t("Unsaved changes")} />}
        </button>
      ))}
    </div>
  );
}
export const tabPanel = (idBase, value) => ({ role: "tabpanel", id: `${idBase}-panel-${value}`, "aria-labelledby": `${idBase}-tab-${value}` });

// ───── Status & identity ─────
const STATUS = {
  ready: ["green", tk("Ready")],
  processing: ["blue", tk("Processing"), true],
  error: ["amber", tk("Needs attention")],
  needs_human: ["red", tk("Needs human")],
  ai: ["blue", tk("AI handling")],
  human: ["", tk("Human handling")],
  resolved: ["green", tk("Resolved")],
  active: ["green", tk("Active")],
  draft: ["", tk("Draft")],
  pending: ["amber", tk("Pending · demo")],
  paid: ["green", tk("Paid")],
  trial: ["blue", tk("Trial")],
  past_due: ["red", tk("Past due")],
  paused: ["", tk("Paused")],
};
export function StatusBadge({ status, label }) {
  const [tone, text, spin] = STATUS[status] || ["", status];
  return (
    <span className={"badge " + tone}>
      {spin ? <Icon name="loader" size={11} className="spin" /> : <span className="dot" />}
      {label || t(text)}
    </span>
  );
}

export function Avatar({ initials, tone = "", size = "", square, title }) {
  return (
    <span className={`avatar ${tone} ${size} ${square ? "sq" : ""}`} aria-hidden={title ? undefined : "true"} title={title}>
      {initials}
    </span>
  );
}

export function Sim({ children = "Simulated" }) {
  return (
    <span className="sim">
      <Icon name="info" size={11} />
      {children}
    </span>
  );
}

export function Callout({ tone = "", icon, children, action }) {
  const ic = icon || { info: "info", ok: "checkCircle", warn: "alert", bad: "alertCircle" }[tone] || "info";
  return (
    <div className={"callout " + tone}>
      <Icon name={ic} size={15} />
      <div className="callout-body">{children}</div>
      {action}
    </div>
  );
}

export function EmptyState({ icon = "inbox", title, children, action }) {
  return (
    <div className="empty">
      <Icon name={icon} size={22} className="empty-icon" />
      <div className="empty-title">{title}</div>
      {children && <div className="empty-body">{children}</div>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}

// ───── Layout ─────
export function PageHeader({ title, description, actions, before }) {
  return (
    <header className="page-head">
      {before}
      <div className="head-text">
        <h1 className="page-title truncate">{title}</h1>
        {description && <p className="page-desc">{description}</p>}
      </div>
      {actions && <div className="head-actions">{actions}</div>}
    </header>
  );
}

export function Section({ title, description, actions, children, labelledBy }) {
  const id = React.useId();
  return (
    <section className="section" aria-labelledby={labelledBy || id}>
      {(title || actions) && (
        <div className="section-head">
          <div style={{ minWidth: 0 }}>
            <h2 className="section-title" id={id}>
              {title}
            </h2>
            {description && <p className="section-desc">{description}</p>}
          </div>
          {actions && <div className="row-wrap">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function MetricsStrip({ items, label = t("Key metrics") }) {
  return (
    <div className="metrics" role="group" aria-label={label}>
      {items.map((m) => {
        const inner = (
          <>
            <span className="metric-label">{m.label}</span>
            <span className="metric-value">{m.value}</span>
            {m.sub && <span className="metric-sub">{m.sub}</span>}
          </>
        );
        return m.onClick ? (
          <button key={m.label} type="button" className="metric" onClick={m.onClick}>
            {inner}
          </button>
        ) : (
          <div key={m.label} className="metric">
            {inner}
          </div>
        );
      })}
    </div>
  );
}

const INTERACTIVE = "button, a, input, textarea, [role='menuitem'], [role='option'], [role='switch']";
export function Table({ columns, rows, rowKey, onRowClick, caption, rowClass }) {
  return (
    <div className="table-wrap">
      <table className="table">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={(c.align === "right" ? "r " : "") + (c.shrink ? "shrink " : "") + (c.hideSm ? "hide-sm" : "")} style={c.width ? { width: c.width } : undefined}>
                {c.srHeader ? <span className="sr-only">{c.header}</span> : c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={rowKey(r)}
              className={(onRowClick ? "clickable " : "") + (rowClass ? rowClass(r) : "")}
              onClick={
                onRowClick
                  ? (e) => {
                      // Ignore clicks from controls in the row and from portaled menus.
                      if (!e.currentTarget.contains(e.target) || e.target.closest(INTERACTIVE)) return;
                      onRowClick(r);
                    }
                  : undefined
              }
            >
              {columns.map((c) => (
                <td key={c.key} className={(c.align === "right" ? "r " : "") + (c.shrink ? "shrink " : "") + (c.hideSm ? "hide-sm" : "")} style={c.maxWidth ? { maxWidth: c.maxWidth } : undefined}>
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ───── Toasts ─────
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((msg, opts = {}) => {
    const id = Math.random().toString(36).slice(2);
    setItems((xs) => [...xs.slice(-1), { id, msg, tone: "success", ...opts }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), opts.duration || 4500);
  }, []);
  const dismiss = (id) => setItems((xs) => xs.filter((x) => x.id !== id));
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((item) => (
          <div className={"toast " + item.tone} key={item.id}>
            <Icon name={item.tone === "error" ? "alertCircle" : item.tone === "info" ? "info" : "checkCircle"} size={16} className="t-icon" />
            <div className="t-msg">
              <div>{item.msg}</div>
              {item.sub && <div className="t-sub">{item.sub}</div>}
            </div>
            {item.action && (
              <button
                type="button"
                onClick={() => {
                  item.action.onClick();
                  dismiss(item.id);
                }}
              >
                {item.action.label}
              </button>
            )}
            <button type="button" aria-label={t("Dismiss notification")} onClick={() => dismiss(item.id)}>
              <Icon name="x" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
