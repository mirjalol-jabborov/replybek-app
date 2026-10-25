import { Icon } from "../icons.jsx";
import { t } from "../i18n.js";
import React, { useEffect, useLayoutEffect, useRef, useState, useId } from "react";
import ReactDOM from "react-dom";


// Dialogs, drawers and popovers stack; only the topmost one answers Escape and traps Tab.
const layers = [];
function useLayer(ref) {
  useLayoutEffect(() => {
    const el = ref.current;
    layers.push(el);
    return () => {
      const i = layers.indexOf(el);
      if (i >= 0) layers.splice(i, 1);
    };
  }, []);
  return () => layers[layers.length - 1] === ref.current;
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function useModal(ref, onClose) {
  const isTop = useLayer(ref);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const prev = document.activeElement;
    const el = ref.current;
    const first = el.querySelector("[data-autofocus]") || el.querySelector(".dialog-body " + FOCUSABLE) || el.querySelector(FOCUSABLE);
    first && first.focus({ preventScroll: true });
    function onKey(e) {
      if (!isTop()) return;
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
      } else if (e.key === "Tab") {
        const f = [...el.querySelectorAll(FOCUSABLE)].filter((x) => x.offsetParent !== null);
        if (!f.length) return;
        const a = f[0];
        const z = f[f.length - 1];
        if (!el.contains(document.activeElement)) {
          e.preventDefault();
          (e.shiftKey ? z : a).focus();
        } else if (e.shiftKey && document.activeElement === a) {
          e.preventDefault();
          z.focus();
        } else if (!e.shiftKey && document.activeElement === z) {
          e.preventDefault();
          a.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (prev && prev.focus && document.contains(prev)) prev.focus({ preventScroll: true });
    };
  }, []);
}

export function Dialog({ title, description, onClose, children, footer, size = "", footNote }) {
  const ref = useRef(null);
  const id = useId();
  useModal(ref, onClose);
  return ReactDOM.createPortal(
    <div className="overlay" ref={ref} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={"dialog " + size} role="dialog" aria-modal="true" aria-labelledby={id + "t"} aria-describedby={description ? id + "d" : undefined}>
        <div className="dialog-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 className="dialog-title" id={id + "t"}>
              {title}
            </h2>
            {description && (
              <p className="dialog-desc" id={id + "d"}>
                {description}
              </p>
            )}
          </div>
          <button type="button" className="icon-btn sm" aria-label={t("Close")} onClick={onClose}>
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="dialog-body">{children}</div>
        {footer && (
          <div className="dialog-foot">
            {footNote && <span className="foot-note">{footNote}</span>}
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export function Drawer({ title, description, onClose, children, footer, width, flush }) {
  const ref = useRef(null);
  const id = useId();
  useModal(ref, onClose);
  return ReactDOM.createPortal(
    <div className="overlay right" ref={ref} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby={id + "t"} style={width ? { maxWidth: width } : undefined}>
        <div className="dialog-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 className="dialog-title truncate" id={id + "t"}>
              {title}
            </h2>
            {description && <p className="dialog-desc truncate">{description}</p>}
          </div>
          <button type="button" className="icon-btn sm" aria-label={t("Close panel")} onClick={onClose}>
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className={"dialog-body" + (flush ? " flush" : "")}>{children}</div>
        {footer && <div className="dialog-foot">{footer}</div>}
      </aside>
    </div>,
    document.body
  );
}

export function Confirm({ title, body, confirmLabel, danger, onConfirm, onClose }) {
  return (
    <Dialog
      title={title}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn-secondary" data-autofocus onClick={onClose}>
            {t("Cancel")}
          </button>
          <button
            type="button"
            className={"btn " + (danger ? "btn-danger" : "btn-primary")}
            onClick={() => {
              onClose();
              onConfirm();
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="sec text-sm" style={{ lineHeight: 1.55 }}>
        {body}
      </p>
    </Dialog>
  );
}

// ───── Popover: portaled, fixed-position panel that flips and clamps to the viewport ─────
let closeOpenPopover = null;

export const Popover = React.forwardRef(function Popover({ anchorRef, onClose, children, placement = "bottom-start", matchWidth = true, minWidth = 0, maxWidth = 380, maxHeight = 320, className = "", ...rest }, fwdRef) {
  const ref = useRef(null);
  const isTop = useLayer(ref);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const setRefs = (el) => {
    ref.current = el;
    if (typeof fwdRef === "function") fwdRef(el);
    else if (fwdRef) fwdRef.current = el;
  };

  useLayoutEffect(() => {
    const el = ref.current;
    const update = (e) => {
      if (e && e.type === "scroll" && el.contains(e.target)) return;
      const a = anchorRef.current;
      if (!a) return;
      const ar = a.getBoundingClientRect();
      const vw = document.documentElement.clientWidth;
      const vh = window.innerHeight;
      const m = 8;
      const gap = 4;
      el.style.maxWidth = Math.min(maxWidth, vw - 2 * m) + "px";
      el.style.minWidth = Math.min(Math.max(matchWidth ? ar.width : 0, minWidth), vw - 2 * m) + "px";
      const natural = el.scrollHeight + 2;
      const below = vh - ar.bottom - gap - m;
      const above = ar.top - gap - m;
      const want = Math.min(natural, maxHeight);
      const down = want <= below || below >= above;
      const avail = Math.max(96, down ? below : above);
      const h = Math.min(want, avail);
      el.style.maxHeight = Math.min(maxHeight, avail) + "px";
      const pw = el.offsetWidth;
      let left = placement.endsWith("end") ? ar.right - pw : ar.left;
      left = Math.max(m, Math.min(left, vw - m - pw));
      el.style.left = left + "px";
      el.style.top = Math.max(m, down ? ar.bottom + gap : ar.top - gap - h) + "px";
      el.style.visibility = "visible";
    };
    update();
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, []);

  useEffect(() => {
    const el = ref.current;
    const close = (reason) => closeRef.current(reason);
    if (closeOpenPopover) closeOpenPopover("replaced");
    closeOpenPopover = close;
    const onDown = (e) => {
      if (el.contains(e.target) || (anchorRef.current && anchorRef.current.contains(e.target))) return;
      close("outside");
    };
    const onKey = (e) => {
      if (isTop() && e.key === "Escape") {
        e.preventDefault();
        close("escape");
      }
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
      if (closeOpenPopover === close) closeOpenPopover = null;
    };
  }, []);

  return ReactDOM.createPortal(
    <div ref={setRefs} className={"popover " + className} style={{ visibility: "hidden", top: 0, left: 0 }} {...rest}>
      {children}
    </div>,
    document.body
  );
});

// ───── Tooltip ─────
export function Tooltip({ label, children, side = "top" }) {
  const [show, setShow] = useState(false);
  const anchor = useRef(null);
  const tip = useRef(null);
  const timer = useRef(null);
  const hide = () => {
    clearTimeout(timer.current);
    setShow(false);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  useLayoutEffect(() => {
    if (!show || !tip.current || !anchor.current) return;
    const a = anchor.current.getBoundingClientRect();
    const box = tip.current.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    let top = side === "top" ? a.top - box.height - 6 : a.bottom + 6;
    if (top < 4) top = a.bottom + 6;
    if (top + box.height > window.innerHeight - 4) top = a.top - box.height - 6;
    const left = Math.max(4, Math.min(a.left + a.width / 2 - box.width / 2, vw - box.width - 4));
    tip.current.style.top = top + "px";
    tip.current.style.left = left + "px";
  }, [show]);
  return (
    <span
      className="tip-anchor"
      ref={anchor}
      onMouseEnter={() => {
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setShow(true), 400);
      }}
      onMouseLeave={hide}
      onPointerDown={hide}
      onFocus={(e) => e.target.matches(":focus-visible") && setShow(true)}
      onBlur={hide}
      onKeyDown={(e) => e.key === "Escape" && hide()}
    >
      {children}
      {show &&
        ReactDOM.createPortal(
          <div className="tooltip" ref={tip} aria-hidden="true" style={{ top: -100, left: -100 }}>
            {label}
          </div>,
          document.body
        )}
    </span>
  );
}
