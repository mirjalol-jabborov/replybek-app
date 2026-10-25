// Interface language: English, Uzbek (Latin) and Russian. English text is the key, so code stays
// readable and a missing translation falls back to English. Plurals use Intl.PluralRules:
// a dictionary entry can be { one, few, many, other } and is chosen by params.count.
import en from "./locales/en.js";
import uz from "./locales/uz.js";
import ru from "./locales/ru.js";

export const LANGS = [
  { code: "en", label: "English" },
  { code: "uz", label: "O‘zbekcha" },
  { code: "ru", label: "Русский" },
];
const DICTS = { en, uz, ru };
const LOCALES = { en: "en-US", uz: "uz-Latn-UZ", ru: "ru-RU" };
const KEY = "replybek.lang";

function detect() {
  try {
    const saved = localStorage.getItem(KEY);
    if (DICTS[saved]) return saved;
  } catch {
    // Storage unavailable: use the browser language.
  }
  const nav = (navigator.language || "en").toLowerCase();
  return nav.startsWith("uz") ? "uz" : nav.startsWith("ru") ? "ru" : "en";
}

let lang = detect();
document.documentElement.lang = lang;
const listeners = new Set();
const missing = new Set();

export const getLang = () => lang;
export const locale = () => LOCALES[lang];
export const onLangChange = (fn) => (listeners.add(fn), () => listeners.delete(fn));

export function setLang(code) {
  if (!DICTS[code] || code === lang) return;
  lang = code;
  try {
    localStorage.setItem(KEY, code);
  } catch {
    // The choice still applies until reload.
  }
  document.documentElement.lang = code;
  listeners.forEach((fn) => fn(code));
}

/** Marks a string for translation where it's defined outside a component; translate it with t() when shown. */
export const tk = (key) => key;

/** Translates `key` (English text) and fills {placeholders} from params. */
export function t(key, params) {
  let value = DICTS[lang][key] ?? en[key] ?? key;
  if (lang !== "en" && DICTS[lang][key] === undefined && import.meta.env.DEV && !missing.has(key)) {
    missing.add(key);
    console.warn(`[i18n] Missing ${lang} translation: ${JSON.stringify(key)}`);
  }
  if (value && typeof value === "object") {
    const form = new Intl.PluralRules(LOCALES[lang]).select(Number(params?.count ?? 0));
    value = value[form] ?? value.other;
  }
  if (params) value = value.replace(/\{(\w+)\}/g, (m, k) => (params[k] === undefined ? m : String(params[k])));
  return value;
}
