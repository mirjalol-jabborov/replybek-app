import { getLang } from "./i18n.js";

// The languages the chat widget speaks. Keep in step with the backend's WIDGET_LANGUAGES and the
// widget's built-in texts. (The dashboard itself speaks LANGS from i18n.js.)
export const WIDGET_LANGUAGES = ["en", "uz", "ru", "es", "pt", "fr", "it", "de", "ja", "ko", "zh", "ar", "tr", "hi", "id", "pl"];

/** A language's name in the dashboard's own language ("Japanese", "Yapon"), from the browser. */
export function languageLabel(code) {
  try {
    const name = new Intl.DisplayNames([getLang()], { type: "language" }).of(code);
    return name ? name.charAt(0).toLocaleUpperCase(getLang()) + name.slice(1) : code;
  } catch {
    return code;
  }
}

/** Menu options for languages, searchable by their name here, their own name ("日本語") and code ("ja"). */
export function languageOptions(codes) {
  return codes.map((code) => {
    let own = "";
    try {
      own = new Intl.DisplayNames([code], { type: "language" }).of(code) || "";
    } catch {
      // a code the browser can't name
    }
    return { value: code, label: languageLabel(code), meta: own && own.toLowerCase() !== languageLabel(code).toLowerCase() ? own : undefined, keywords: `${code} ${own}` };
  });
}

/** The widget's languages, in their usual order, with the default first. */
export const orderedLanguages = (codes, first) =>
  [...new Set([first, ...WIDGET_LANGUAGES.filter((c) => codes.includes(c))])].filter((c) => WIDGET_LANGUAGES.includes(c));

/** True while a text is still the AI's translation: marked automatic, and not changed in the draft. */
export const isAuto = (marks, saved, draft, code) => Boolean(marks?.[code]?.from) && JSON.stringify(saved?.[code]) === JSON.stringify(draft?.[code]);
