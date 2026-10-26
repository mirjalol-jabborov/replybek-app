// The Replybek logo from the brand book (replybek-landing/brand/brandbook.html): a white R on a
// near-black rounded square, and the lowercase "replybek." wordmark with its blue full stop.

const R_PATH = "M8 13 Q8 6 15 6 H27 Q41 6 41 17.5 Q41 27.5 31 28.8 L41 42 H29.5 L20.5 29 H17 V42 H8 Z M17 13.5 H27 Q32.5 13.5 32.5 17.5 Q32.5 21.5 27 21.5 H17 Z";

export function BrandMark({ size = 28 }) {
  return (
    <svg className="brand-symbol" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <rect width="48" height="48" rx="11" fill="#111215" />
      <path fill="#fff" fillRule="evenodd" transform="translate(10.56 10.56) scale(0.56)" d={R_PATH} />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="brand-word">
      replybek<span className="brand-dot">.</span>
    </span>
  );
}
