import { fmt } from "./ui.jsx";
import { t } from "./i18n.js";
import React, { useEffect, useRef, useState } from "react";


function useWidth(ref) {
  const [w, setW] = useState(640);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.floor(e.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return w;
}

function niceMax(v) {
  if (v <= 0) return 4;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const steps = [1, 2, 2.5, 5, 10];
  for (const s of steps) {
    const step = (s * pow) / 4;
    if (step * 4 >= v) return step * 4;
  }
  return 10 * pow;
}

// Bar with a rounded data-end (top) and square base on the baseline.
function topRounded(x, y, w, h, r) {
  if (h <= 0) return "";
  r = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/** Stacked bars: AI-resolved (series 1) under escalated (series 2). */
export function VolumeChart({ data, height = 220, caption }) {
  const ref = useRef(null);
  const width = useWidth(ref);
  const [hover, setHover] = useState(null);
  const pad = { l: 34, r: 4, t: 8, b: 24 };
  const iw = width - pad.l - pad.r;
  const ih = height - pad.t - pad.b;
  const max = niceMax(Math.max(...data.map((d) => d.total)));
  const y = (v) => pad.t + ih - (v / max) * ih;
  const band = iw / data.length;
  const bw = Math.max(3, Math.min(28, band * 0.64));
  const every = Math.ceil(data.length / Math.max(2, Math.floor(iw / 64)));
  const ticks = [0, 1, 2, 3, 4].map((i) => (max / 4) * i);
  const hd = hover != null ? data[hover] : null;

  return (
    <div className="chart" ref={ref}>
      <svg width={width} height={height} role="img" aria-label={caption}>
        {ticks.map((v) => (
          <g key={v}>
            <line className={v === 0 ? "baseline" : "gridline"} x1={pad.l} x2={width - pad.r} y1={y(v)} y2={y(v)} />
            <text className="axis-text" x={pad.l - 8} y={y(v) + 4} textAnchor="end">
              {fmt(Math.round(v))}
            </text>
          </g>
        ))}
        {hover != null && <rect className="hover-band" x={pad.l + hover * band} y={pad.t} width={band} height={ih} rx="4" />}
        {data.map((d, i) => {
          const x = pad.l + i * band + (band - bw) / 2;
          const yRes = y(d.resolved);
          const hRes = pad.t + ih - yRes;
          const yTop = y(d.total);
          const hEsc = Math.max(0, yRes - yTop - (d.escalated > 0 ? 2 : 0));
          return (
            <g key={i}>
              {d.escalated > 0 ? (
                <>
                  <rect x={x} y={yRes} width={bw} height={hRes} fill="var(--series-1)" />
                  <path d={topRounded(x, yTop, bw, hEsc, 4)} fill="var(--series-2)" />
                </>
              ) : (
                <path d={topRounded(x, yRes, bw, hRes, 4)} fill="var(--series-1)" />
              )}
            </g>
          );
        })}
        {data.map((d, i) =>
          i % every === 0 ? (
            <text key={"l" + i} className="axis-text" x={pad.l + i * band + band / 2} y={height - 8} textAnchor="middle">
              {d.label}
            </text>
          ) : null
        )}
        {data.map((d, i) => (
          <rect key={"h" + i} className="hit" x={pad.l + i * band} y={pad.t} width={band} height={ih} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
        ))}
      </svg>
      {hd && (
        <div className="chart-tip" style={{ left: Math.min(Math.max(pad.l + hover * band + band / 2, 90), width - 90), top: y(hd.total) - 8 }}>
          <div className="t-head">{hd.long}</div>
          <div className="t-row">
            <span className="row" style={{ gap: 6 }}>
              <i className="key" style={{ background: "var(--series-1)" }} />
              {t("Resolved by AI")}
            </span>
            <strong>{fmt(hd.resolved)}</strong>
          </div>
          <div className="t-row">
            <span className="row" style={{ gap: 6 }}>
              <i className="key" style={{ background: "var(--series-2)" }} />
              {t("Escalated")}
            </span>
            <strong>{fmt(hd.escalated)}</strong>
          </div>
          <div className="t-row" style={{ borderTop: "1px solid var(--border)", marginTop: 4, paddingTop: 4 }}>
            <span>{t("Total")}</span>
            <strong>{fmt(hd.total)}</strong>
          </div>
        </div>
      )}
      {/* Data table for screen readers. The wrapper is hidden: a hidden <table> keeps its full height. */}
      <div className="sr-only">
        <table>
          <caption>{caption}</caption>
          <thead>
            <tr>
              <th>{t("Period")}</th>
              <th>{t("Resolved by AI")}</th>
              <th>{t("Escalated")}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d, i) => (
              <tr key={i}>
                <td>{d.long}</td>
                <td>{d.resolved}</td>
                <td>{d.escalated}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Legend() {
  return (
    <div className="legend">
      <span>
        <i className="key" style={{ background: "var(--series-1)" }} />
        {t("Resolved by AI")}
      </span>
      <span>
        <i className="key" style={{ background: "var(--series-2)" }} />
        {t("Escalated to a human")}
      </span>
    </div>
  );
}
