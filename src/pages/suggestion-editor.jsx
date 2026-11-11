import { useState, useRef, useEffect } from "react";
import { t } from "../i18n.js";
import { api } from "../api.js";
import { Button, Callout, Combobox, SearchMenu } from "../ui.jsx";
import { Icon } from "../icons.jsx";
import { WIDGET_LANGUAGES, languageLabel as label, languageOptions, orderedLanguages, isAuto } from "../widget-languages.js";

// `marks` are the agent's automatic translations ({ lang: { from, at } }), `saved` its saved lists:
// a list still equal to its saved copy and marked is the AI's translation, shown as such.
export function SuggestionEditor({ base, agent, value, onChange, disabled, language, onLanguage, defaultLanguage, onDefaultLanguage, marks = {}, saved = {} }) {
  const [busy, setBusy] = useState(false), [generated, setGenerated] = useState(null), [error, setError] = useState("");
  const request = useRef(0);
  useEffect(() => { request.current++; setGenerated(null); setError(""); setBusy(false); }, [language]);
  const questions = value[language] || [];
  // The languages with questions, the default first, and the one being looked at.
  const shown = orderedLanguages([...Object.keys(value), language], defaultLanguage);
  const addable = WIDGET_LANGUAGES.filter((code) => !shown.includes(code));
  const sourceLanguage = [defaultLanguage, ...shown].find(code => code !== language && value[code]?.some(q=>q.trim()));
  const auto = isAuto(marks, saved, value, language);
  function update(next) { onChange({ ...value, [language]: next }); }
  function remove() { const next = { ...value }; delete next[language]; onChange(next); onLanguage(defaultLanguage); }
  async function generate(translate = false) {
    const id = ++request.current;
    setBusy(true); setError(""); setGenerated(null);
    try {
      const result = await api(`${base}/agents/${agent.id}/suggestions/generate`, { method: "POST", body: { language, ...(translate ? { questions: value[sourceLanguage].map(q => q.trim()).filter(Boolean) } : {}) } });
      if (request.current === id) setGenerated(result.questions);
    } catch (e) { if (request.current === id) setError(e.message); }
    finally { if (request.current === id) setBusy(false); }
  }
  function move(index, delta) { const next = [...questions]; [next[index], next[index + delta]] = [next[index + delta], next[index]]; update(next); }
  return <section className="cfg-sec suggestion-editor">
    <div className="suggestion-heading"><h2 className="cfg-sec-title">{t("Suggested questions")}</h2><span className="helper">{questions.length}/5</span></div>
    <p className="helper">{t("Write a welcoming starting point in each language. Changes go live when you save.")}</p>
    <div className="suggestion-languages" role="tablist" aria-label={t("Question language")}>
      {shown.map((code) => <button type="button" role="tab" key={code} tabIndex={language === code ? 0 : -1} onKeyDown={e => { const index = shown.indexOf(code); const next = e.key === "ArrowRight" ? (index + 1) % shown.length : e.key === "ArrowLeft" ? (index + shown.length - 1) % shown.length : e.key === "Home" ? 0 : e.key === "End" ? shown.length - 1 : -1; if (next >= 0) { e.preventDefault(); onLanguage(shown[next]); e.currentTarget.parentElement.children[next].focus(); } }} aria-selected={language === code} aria-controls={`question-list-${code}`} onClick={() => onLanguage(code)}><span>{label(code)}</span><span className="suggestion-count">{value[code]?.length || 0}</span>{isAuto(marks, saved, value, code) && <span className="suggestion-auto">{t("Auto")}</span>}</button>)}
      {!disabled && addable.length > 0 && <SearchMenu searchPlaceholder={t("Search languages")} options={languageOptions(addable)} onPick={onLanguage} trigger={(p) => <button type="button" className="suggestion-add" aria-label={t("Add a language")} {...p}><span aria-hidden="true">+</span>{t("Language")}</button>} />}
    </div>
    {auto && <p className="helper suggestion-auto-note"><span className="badge">{t("Auto-translated")}</span> {t("Translated from {language} for visitors on pages in this language. Edit the questions to make them yours.", { language: label(defaultLanguage) })}</p>}
    <div id={`question-list-${language}`} role="tabpanel" aria-label={label(language)} className="suggestion-list">
      {generated && !disabled ? <div className="suggestion-generated stack-xs" aria-label={t("Generated question draft")}>
        <strong>{t("Review {language} questions",{language:label(language)})}</strong>
        {generated.length ? <><ul>{generated.map((q,i) => <li key={i}>{q}</li>)}</ul><p className="helper">{t("Replaces only this language. Other translations stay unchanged.")}</p></> : <p className="helper">{t("No questions could be generated from ready knowledge. Add more content or write your own.")}</p>}
        <div className="row-wrap">
          {generated.length > 0 && <Button size="sm" variant="primary" onClick={() => {update(generated);setGenerated(null);}}>{t("Use generated questions")}</Button>}
          <Button size="sm" variant="ghost" onClick={() => setGenerated(null)}>{t("Dismiss")}</Button>
        </div>
      </div> : <>
      {questions.map((question,index) => <div className="suggestion-row" key={index}>
        <span className="suggestion-index" aria-hidden="true">{index + 1}</span>
        <textarea id={`suggestion-${index}`} className="suggestion-text" ref={el => { if(el) {el.style.height="auto";el.style.height=`${el.scrollHeight}px`;} }} rows={2} maxLength={180} aria-label={t("Question {number}",{number:index+1})} value={question} disabled={disabled} onChange={e => update(questions.map((q,i) => i === index ? e.target.value : q))} />
        {!disabled && <div className="suggestion-tools">
          <button type="button" className="icon-btn" title={t("Remove")} aria-label={t("Remove question {number}",{number:index+1})} onClick={() => update(questions.filter((_,i) => i!==index))}><Icon name="x" size={13}/></button>
          <button type="button" className="icon-btn" disabled={!index} aria-label={t("Move question {number} up",{number:index+1})} onClick={() => move(index,-1)}><Icon name="chevronUp" size={13}/></button>
          <button type="button" className="icon-btn" disabled={index===questions.length-1} aria-label={t("Move question {number} down",{number:index+1})} onClick={() => move(index,1)}><Icon name="chevronDown" size={13}/></button>
        </div>}
      </div>)}
      {!questions.length && <div className="suggestion-empty"><Icon name="message" size={20}/><p>{t("No questions in this language yet.")}</p><span className="helper">{Object.hasOwn(value,language) ? t("Visitors can type their own question.") : t("Visitors on pages in this language get an automatic translation of your {language} questions until you add your own.", { language: label(defaultLanguage) })}</span></div>}
      </>}
    </div>
    {!disabled && !generated && <>
      <div className="row-wrap">
        <Button size="sm" variant="ghost" icon="plus" disabled={questions.length>=5} onClick={() => update([...questions,""])}>{t("Add question")}</Button>
        {language !== defaultLanguage && Object.hasOwn(value, language) && <Button size="sm" variant="ghost" icon="x" onClick={remove}>{t("Remove {language}", { language: label(language) })}</Button>}
      </div>
      <div className="suggestion-ai-actions">
        <Button size="sm" loading={busy} disabled={!agent.source_count} onClick={() => generate()}>{t("Generate with AI")}</Button>
        {sourceLanguage && <Button size="sm" disabled={busy} onClick={() => generate(true)}>{t("Translate from {language}",{language:label(sourceLanguage)})}</Button>}
      </div>
    </>}
    <div className="suggestion-fallback"><span id="suggestion-default-label">{t("Default language")}</span>{disabled ? <span>{label(defaultLanguage)}</span> : <Combobox id="suggestion-default" size="sm" width={180} placement="bottom-end" value={defaultLanguage} onChange={onDefaultLanguage} searchPlaceholder={t("Search languages")} options={languageOptions(WIDGET_LANGUAGES)} />}</div>
    <p className="helper">{t("The widget uses the website or browser language. Where you haven't written questions for a language, visitors get an automatic translation of your default-language ones.")}</p>
    {error && <Callout tone="bad">{error}</Callout>}
  </section>;
}
