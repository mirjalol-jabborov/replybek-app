// Checks translations: every t("…") key must exist in uz and ru, and text that looks like
// user-facing English outside t() is reported. Run: npm run i18n:check
import fs from "fs";
import path from "path";

const SRC = path.resolve("src");
const files = [];
(function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      if (f !== "locales") walk(p);
    } else if (/\.(jsx?|mjs)$/.test(f) && !/i18n\.js$/.test(f)) files.push(p);
  }
})(SRC);

const load = async (l) => (await import(path.join(SRC, "locales", `${l}.js`) + `?${Date.now()}`)).default;
const dicts = { uz: await load("uz"), ru: await load("ru") };

const keys = new Map(); // key → first file
const suspects = [];
const KEY_RE = /\bt[k]?\(\s*"((?:[^"\\]|\\.)*)"/g;
const PROP_RE = /\b(label|title|placeholder|hint|description|aria-label|ariaLabel|header|confirmLabel|body|footNote|searchPlaceholder|prefix|sub|heading|text|error)=\s*"([^"]*[A-Za-z]{2,}[^"]*)"/g;
const OBJ_RE = /\b(label|description|sub|hint|title|header|placeholder|heading|text|msg)\s*:\s*"([^"]*[A-Za-z]{2,}[^"]*)"/g;
const TOAST_RE = /\btoast\(\s*["`]([^"`]*[A-Za-z]{2,}[^"`]*)["`]/g;
const ERR_RE = /\b(e\.\w+|setError|setCheckError|setOriginErr)\s*[=(]\s*"([^"]*[A-Za-z]{3,}[^"]*)"/g;
const IGNORE = /^(#|\/|https?:|[a-z]+[-_][a-z-]+$|[a-z]+$|[A-Z_]+$|\$\{|[\w-]+(\.[\w-]+)+\/?[\w/-]*$)/;

for (const file of files) {
  const raw = fs.readFileSync(file, "utf8");
  const rel = path.relative(SRC, file);
  for (const m of raw.matchAll(KEY_RE)) if (!keys.has(m[1])) keys.set(JSON.parse(`"${m[1]}"`), rel);
  // Look for untranslated text with translated strings and comments blanked out.
  const src = raw
    .replace(KEY_RE, (m) => m.replace(/"(?:[^"\\]|\\.)*"/, '""'))
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
  const report = (text, kind) => {
    const s = text.trim();
    if (!s || IGNORE.test(s) || !/[A-Za-z]{2,}/.test(s)) return;
    suspects.push(`${rel}: ${kind}: ${s.slice(0, 90)}`);
  };
  if (file.endsWith(".jsx")) {
    // JSX text between tags (not inside {…})
    for (const m of src.matchAll(/>([^<>{}`]*[A-Za-z]{2,}[^<>{}`]*)</g)) {
      const s = m[1].trim();
      if (s && !/^[\w.-]+$/.test(s) && !/[=;(){}]/.test(s)) report(s, "jsx text");
      else if (/^[A-Z][a-z]+$/.test(s)) report(s, "jsx text");
    }
    for (const m of src.matchAll(PROP_RE)) report(m[2], `prop ${m[1]}`);
    // Text next to {expressions}: "} pages ready{" or ">Showing {"
    for (const m of src.matchAll(/[}>]([^{}<>`"\n=;()]*[A-Za-z]{3,}[^{}<>`"\n=;()]*)[<{]/g)) {
      if (!/^\s*(&&|\|\||\?|:)/.test(m[1])) report(m[1], "jsx text near expression");
    }
  }
  // "Sentence" strings in conditions: a ? "Processing." : "Ready"
  for (const m of src.matchAll(/[?:]\s*"([A-Z][^"]*[a-z][^"]*)"/g)) report(m[1], "string in condition");
  // Sentences in template strings
  for (const m of src.matchAll(/`([^`]*[A-Za-z]{3,} [a-z]{2,}[^`]*)`/g)) {
    const text = m[1].replace(/\$\{[^}]*\}/g, "");
    if (/[A-Za-z]{3,} [a-z]{2,}/.test(text) && !/[;{}()=<>]/.test(text) && !/(btn|select-trigger|icon-btn|className|nav-item|badge|callout|plan|rail-hide|is-active|truncate)\b/.test(m[1])) report(m[1], "template text");
  }
  for (const m of src.matchAll(OBJ_RE)) report(m[2], `field ${m[1]}`);
  for (const m of src.matchAll(TOAST_RE)) report(m[1], "toast");
  for (const m of src.matchAll(ERR_RE)) report(m[2], "error");
}

let missing = 0;
for (const [key, file] of keys) {
  for (const l of ["uz", "ru"]) {
    if (dicts[l][key] === undefined) {
      missing++;
      console.log(`missing ${l}: ${JSON.stringify(key)}  (${file})`);
    }
  }
}
for (const s of suspects) console.log(`untranslated? ${s}`);
const unused = Object.keys(dicts.uz).filter((k) => !keys.has(k));
console.log(`\n${keys.size} keys · ${missing} missing translations · ${suspects.length} possible untranslated texts · ${unused.length} unused uz entries`);
process.exit(missing || suspects.length ? 1 : 0);
