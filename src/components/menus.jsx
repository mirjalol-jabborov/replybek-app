import { Icon } from "../icons.jsx";
import { t } from "../i18n.js";
import { Popover } from "./overlay.jsx";
import { Field, describedBy } from "./controls.jsx";
import React, { useState, useRef, useEffect, useLayoutEffect, useId } from "react";


const RETURN_FOCUS = ["escape", "select", "tab"];

function nextEnabled(options, from, dir) {
  let i = from;
  for (let k = 0; k < options.length; k++) {
    i = (i + dir + options.length) % options.length;
    if (!options[i].disabled) return i;
  }
  return from;
}

/** Renders option rows with group headers; shared by Select and Combobox. */
function OptionRows({ id, options, value, active, setActive, onPick, showCheck = true }) {
  let lastGroup;
  return options.map((o, i) => {
    const head = o.group && o.group !== lastGroup;
    lastGroup = o.group;
    return (
      <React.Fragment key={o.value}>
        {head && (
          <div className="pop-label" role="presentation">
            {o.group}
          </div>
        )}
        <div
          id={`${id}-opt-${i}`}
          role="option"
          className="opt"
          data-index={i}
          data-active={i === active}
          aria-selected={o.value === value}
          aria-disabled={o.disabled || undefined}
          onMouseMove={() => !o.disabled && i !== active && setActive(i)}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => !o.disabled && onPick(o.value)}
        >
          {showCheck && <span className="opt-check">{o.value === value && <Icon name="check" size={15} />}</span>}
          {o.icon && <Icon name={o.icon} size={15} className="opt-icon" />}
          {o.lead}
          <span className="opt-text">
            <span className="opt-label">{o.label}</span>
            {o.description && <span className="opt-desc">{o.description}</span>}
          </span>
          {o.meta != null && <span className="opt-meta">{o.meta}</span>}
        </div>
      </React.Fragment>
    );
  });
}

function useActiveScroll(ref, active) {
  useEffect(() => {
    const el = ref.current && ref.current.querySelector(`[data-index="${active}"]`);
    el && el.scrollIntoView({ block: "nearest" });
  }, [active]);
}

function Trigger({ tid, trig, open, setOpen, label, ariaLabel, selected, placeholder, prefix, renderValue, size, quiet, disabled, error, hint, className, width }) {
  return (
    <button
      ref={trig}
      id={tid}
      type="button"
      className={`select-trigger${size === "sm" ? " sm" : ""}${quiet ? " quiet" : ""} ${className || ""}`}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={open ? tid + "-lb" : undefined}
      aria-labelledby={label ? `${tid}-label ${tid}` : undefined}
      aria-label={!label && ariaLabel ? `${ariaLabel}: ${selected ? selected.label : placeholder}` : undefined}
      aria-describedby={label ? describedBy(tid, hint, error) : undefined}
      aria-invalid={error ? true : undefined}
      disabled={disabled}
      style={width ? { width } : undefined}
      onClick={() => setOpen((o) => !o)}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          setOpen(true);
        }
      }}
    >
      {selected && selected.icon && <Icon name={selected.icon} size={15} className="muted" />}
      {selected && selected.lead}
      {prefix && <span className="st-prefix">{prefix}</span>}
      <span className={"st-value" + (selected ? "" : " st-placeholder")}>{selected ? (renderValue ? renderValue(selected) : selected.label) : placeholder}</span>
      <Icon name="chevronDown" size={14} className="st-chev" />
    </button>
  );
}

function wrapField(props, tid, node) {
  const { label, hint, error, layout, optional } = props;
  if (!label) return node;
  return (
    <Field id={tid} label={label} hint={hint} error={error} layout={layout} optional={optional}>
      {node}
    </Field>
  );
}

/**
 * Select: choose one value from a short list.
 * options: [{ value, label, description?, icon?, lead?, meta?, group?, disabled? }]
 */
export function Select(props) {
  const { id, value, onChange, options, placeholder, placement = "bottom-start", menuMinWidth = 0, maxHeight = 320 } = props;
  const auto = useId();
  const tid = id || auto;
  const [open, setOpen] = useState(false);
  const trig = useRef(null);
  const selected = options.find((o) => o.value === value);
  const ph = placeholder ?? t("Select…");
  const close = (reason) => {
    setOpen(false);
    if (RETURN_FOCUS.includes(reason) && trig.current) trig.current.focus();
  };
  return wrapField(
    props,
    tid,
    <>
      <Trigger {...props} tid={tid} trig={trig} open={open} setOpen={setOpen} selected={selected} placeholder={ph} ariaLabel={props["aria-label"]} />
      {open && (
        <Listbox
          id={tid + "-lb"}
          anchorRef={trig}
          options={options}
          value={value}
          placement={placement}
          minWidth={menuMinWidth}
          maxHeight={maxHeight}
          labelledBy={props.label ? tid + "-label" : undefined}
          ariaLabel={props.label ? undefined : props["aria-label"]}
          onClose={close}
          onPick={(v) => {
            close("select");
            if (v !== value) onChange(v);
          }}
        />
      )}
    </>
  );
}

function Listbox({ id, anchorRef, options, value, onPick, onClose, placement, minWidth, maxHeight, labelledBy, ariaLabel }) {
  const ref = useRef(null);
  const [active, setActive] = useState(() => {
    const i = options.findIndex((o) => o.value === value && !o.disabled);
    return i >= 0 ? i : nextEnabled(options, -1, 1);
  });
  const typed = useRef({ s: "", t: 0 });
  useLayoutEffect(() => ref.current.focus({ preventScroll: true }), []);
  useActiveScroll(ref, active);
  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => nextEnabled(options, a, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => nextEnabled(options, a, -1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(nextEnabled(options, -1, 1));
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(nextEnabled(options, options.length, -1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const o = options[active];
      o && !o.disabled && onPick(o.value);
    } else if (e.key === "Tab") {
      e.preventDefault();
      onClose("tab");
    } else if (e.key.length === 1 && /\S/.test(e.key)) {
      const now = Date.now();
      typed.current.s = now - typed.current.t > 600 ? e.key.toLowerCase() : typed.current.s + e.key.toLowerCase();
      typed.current.t = now;
      const i = options.findIndex((o) => !o.disabled && String(o.label).toLowerCase().startsWith(typed.current.s));
      if (i >= 0) setActive(i);
    }
  };
  return (
    <Popover
      ref={ref}
      anchorRef={anchorRef}
      onClose={onClose}
      placement={placement}
      minWidth={minWidth}
      maxHeight={maxHeight}
      id={id}
      role="listbox"
      tabIndex={-1}
      aria-labelledby={labelledBy}
      aria-label={ariaLabel}
      aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined}
      onKeyDown={onKeyDown}
    >
      <OptionRows id={id} options={options} value={value} active={active} setActive={setActive} onPick={onPick} />
    </Popover>
  );
}

/** Combobox: a select with a search field, for longer lists. */
export function Combobox(props) {
  const { id, value, onChange, options, placeholder, searchPlaceholder, placement = "bottom-start", menuMinWidth = 260 } = props;
  const auto = useId();
  const tid = id || auto;
  const [open, setOpen] = useState(false);
  const trig = useRef(null);
  const selected = options.find((o) => o.value === value);
  const ph = placeholder ?? t("Select…");
  const close = (reason) => {
    setOpen(false);
    if (RETURN_FOCUS.includes(reason) && trig.current) trig.current.focus();
  };
  return wrapField(
    props,
    tid,
    <>
      <Trigger {...props} tid={tid} trig={trig} open={open} setOpen={setOpen} selected={selected} placeholder={ph} ariaLabel={props["aria-label"]} />
      {open && (
        <SearchList
          id={tid + "-lb"}
          anchorRef={trig}
          options={options}
          value={value}
          placement={placement}
          minWidth={menuMinWidth}
          searchPlaceholder={searchPlaceholder ?? t("Search")}
          onClose={close}
          onPick={(v) => {
            close("select");
            if (v !== value) onChange(v);
          }}
        />
      )}
    </>
  );
}

function SearchList({ id, anchorRef, options, value, onPick, onClose, placement, minWidth, searchPlaceholder }) {
  const ref = useRef(null);
  const inputRef = useRef(null);
  const [q, setQ] = useState("");
  // Focus after the popover is positioned and visible.
  useLayoutEffect(() => inputRef.current.focus({ preventScroll: true }), []);
  const filtered = options.filter((o) => (o.label + " " + (o.description || "") + " " + (o.keywords || "")).toLowerCase().includes(q.trim().toLowerCase()));
  const [active, setActive] = useState(() => Math.max(0, filtered.findIndex((o) => o.value === value)));

  useActiveScroll(ref, active);
  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      filtered.length && setActive((a) => nextEnabled(filtered, a, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      filtered.length && setActive((a) => nextEnabled(filtered, a, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const o = filtered[active];
      o && !o.disabled && onPick(o.value);
    } else if (e.key === "Tab") {
      e.preventDefault();
      onClose("tab");
    }
  };
  return (
    <Popover ref={ref} anchorRef={anchorRef} onClose={onClose} placement={placement} minWidth={minWidth} maxHeight={340}>
      <div className="pop-search">
        <div className="input-wrap sm">
          <Icon name="search" size={14} />
          <input
            ref={inputRef}
            className="input sm"
            role="combobox"
            aria-expanded="true"
            aria-controls={id}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 && filtered[active] ? `${id}-opt-${active}` : undefined}
            aria-label={searchPlaceholder}
            placeholder={searchPlaceholder}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
          />
        </div>
      </div>
      <div role="listbox" id={id} aria-label={t("Options")}>
        {filtered.length ? <OptionRows id={id} options={filtered} value={value} active={active} setActive={setActive} onPick={onPick} /> : <div className="pop-empty">{t("No matches for “{q}”", { q })}</div>}
      </div>
    </Popover>
  );
}

/**
 * ActionMenu: a list of commands.
 * items: [{ label, icon?, description?, onSelect, danger?, disabled?, checked? } | { separator: true } | { heading }]
 * trigger: (props) => element; spread props onto a button (includes ref).
 */
export function ActionMenu({ trigger, items, label, placement = "bottom-end", minWidth = 200, header }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const id = useId();
  const close = (reason) => {
    setOpen(false);
    if (RETURN_FOCUS.includes(reason) && ref.current) ref.current.focus();
  };
  const triggerProps = {
    ref,
    onClick: () => setOpen((o) => !o),
    onKeyDown: (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
      }
    },
    "aria-haspopup": "menu",
    "aria-expanded": open,
    "aria-controls": open ? id : undefined,
  };
  return (
    <>
      {trigger(triggerProps)}
      {open && <MenuPanel id={id} anchorRef={ref} items={items} label={label} placement={placement} minWidth={minWidth} header={header} onClose={close} />}
    </>
  );
}

function MenuPanel({ id, anchorRef, items, label, placement, minWidth, header, onClose }) {
  const ref = useRef(null);
  const hasCheck = items.some((it) => it.checked !== undefined);
  const buttons = () => [...ref.current.querySelectorAll(".opt:not(:disabled)")];
  useLayoutEffect(() => {
    const b = buttons();
    const checked = ref.current.querySelector('.opt[aria-checked="true"]');
    (checked || b[0]) && (checked || b[0]).focus({ preventScroll: true });
  }, []);
  const onKeyDown = (e) => {
    const b = buttons();
    const i = b.indexOf(document.activeElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      b[(i + 1) % b.length].focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      b[(i - 1 + b.length) % b.length].focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      b[0].focus();
    } else if (e.key === "End") {
      e.preventDefault();
      b[b.length - 1].focus();
    } else if (e.key === "Tab") {
      e.preventDefault();
      onClose("tab");
    }
  };
  return (
    <Popover ref={ref} anchorRef={anchorRef} onClose={onClose} placement={placement} matchWidth={false} minWidth={minWidth} maxHeight={420} id={id} role="menu" aria-label={label} onKeyDown={onKeyDown}>
      {header && (
        <>
          <div className="pop-head">{header}</div>
          <div className="pop-sep" role="separator" />
        </>
      )}
      {items.map((it, i) => {
        if (it.separator) return <div key={i} className="pop-sep" role="separator" />;
        if (it.heading)
          return (
            <div key={i} className="pop-label" role="presentation">
              {it.heading}
            </div>
          );
        return (
          <button
            key={i}
            type="button"
            role={it.checked !== undefined ? "menuitemradio" : "menuitem"}
            aria-checked={it.checked !== undefined ? it.checked : undefined}
            className={"opt" + (it.danger ? " danger" : "")}
            disabled={it.disabled}
            tabIndex={-1}
            onClick={() => {
              onClose("select");
              it.onSelect && it.onSelect();
            }}
          >
            {hasCheck && <span className="opt-check">{it.checked && <Icon name="check" size={15} />}</span>}
            {it.icon && <Icon name={it.icon} size={15} className="opt-icon" />}
            <span className="opt-text">
              <span className="opt-label">{it.label}</span>
              {it.description && <span className="opt-desc">{it.description}</span>}
            </span>
            {it.meta && <span className="opt-meta">{it.meta}</span>}
          </button>
        );
      })}
    </Popover>
  );
}
