import { useState, useRef, useEffect } from "react";
import { t, LANGS } from "../i18n.js";
import { api } from "../api.js";
import { Button, Callout } from "../ui.jsx";
import { Icon } from "../icons.jsx";

export function SuggestionEditor({ base, agent, value, onChange, disabled, language, onLanguage, defaultLanguage, onDefaultLanguage }) {
  const [busy, setBusy] = useState(false), [generated, setGenerated] = useState(null), [error, setError] = useState("");
  const request = useRef(0);
  useEffect(() => { request.current++; setGenerated(null); setError(""); setBusy(false); }, [language]);
  const questions = value[language] || [];
  const sourceLanguage = [defaultLanguage, ...LANGS.map(l => l.code)].find(code => code !== language && value[code]?.some(q=>q.trim()));
  const label = code => LANGS.find(l => l.code === code)?.label || code;
  function update(next) { onChange({ ...value, [language]: next }); }
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
      {LANGS.map(({code,label}) => <button type="button" role="tab" key={code} tabIndex={language === code ? 0 : -1} onKeyDown={e => { const index = LANGS.findIndex(l => l.code === code); const next = e.key === "ArrowRight" ? (index + 1) % LANGS.length : e.key === "ArrowLeft" ? (index + LANGS.length - 1) % LANGS.length : e.key === "Home" ? 0 : e.key === "End" ? LANGS.length - 1 : -1; if (next >= 0) { e.preventDefault(); onLanguage(LANGS[next].code); e.currentTarget.parentElement.children[next].focus(); } }} aria-selected={language === code} aria-controls={`question-list-${code}`} onClick={() => onLanguage(code)}><span>{label}</span><span className="suggestion-count">{value[code]?.length || 0}</span></button>)}
    </div>
    <div id={`question-list-${language}`} role="tabpanel" aria-label={label(language)} className="suggestion-list">
      {questions.map((question,index) => <div className="suggestion-row" key={index}>
        <span className="suggestion-index" aria-hidden="true">{index + 1}</span>
        <textarea id={`suggestion-${index}`} className="suggestion-text" ref={el => { if(el) {el.style.height="auto";el.style.height=`${el.scrollHeight}px`;} }} rows={2} maxLength={180} aria-label={t("Question {number}",{number:index+1})} value={question} disabled={disabled} onChange={e => update(questions.map((q,i) => i === index ? e.target.value : q))} />
        {!disabled && <div className="suggestion-tools">
          <button type="button" className="icon-btn" title={t("Remove")} aria-label={t("Remove question {number}",{number:index+1})} onClick={() => update(questions.filter((_,i) => i!==index))}><Icon name="x" size={13}/></button>
          <button type="button" className="icon-btn" disabled={!index} aria-label={t("Move question {number} up",{number:index+1})} onClick={() => move(index,-1)}><Icon name="chevronUp" size={13}/></button>
          <button type="button" className="icon-btn" disabled={index===questions.length-1} aria-label={t("Move question {number} down",{number:index+1})} onClick={() => move(index,1)}><Icon name="chevronDown" size={13}/></button>
        </div>}
      </div>)}
      {!questions.length && <div className="suggestion-empty"><Icon name="message" size={20}/><p>{t("No questions in this language yet.")}</p><span className="helper">{Object.hasOwn(value,language) ? t("Visitors can type their own question.") : t("The default language is shown until you add a translation.")}</span></div>}
    </div>
    {!disabled && <>
      <Button size="sm" variant="ghost" icon="plus" disabled={questions.length>=5} onClick={() => update([...questions,""])}>{t("Add question")}</Button>
      <div className="suggestion-ai-actions">
        <Button size="sm" loading={busy} disabled={!agent.source_count} onClick={() => generate()}>{t("Generate with AI")}</Button>
        {sourceLanguage && <Button size="sm" disabled={busy} onClick={() => generate(true)}>{t("Translate from {language}",{language:label(sourceLanguage)})}</Button>}
      </div>
    </>}
    <label className="suggestion-fallback"><span>{t("Default language")}</span><select className="input" value={defaultLanguage} disabled={disabled} onChange={e => onDefaultLanguage(e.target.value)}>{LANGS.map(l => <option value={l.code} key={l.code}>{l.label}</option>)}</select></label>
    <p className="helper">{t("The widget uses the website or browser language. Missing translations use your default language.")}</p>
    {error && <Callout tone="bad">{error}</Callout>}
    {generated && !disabled && <div className="suggestion-generated stack-xs" aria-label={t("Generated question draft")}>
      <strong>{t("Review {language} questions",{language:label(language)})}</strong>
      {generated.length ? <><ul>{generated.map((q,i) => <li key={i}>{q}</li>)}</ul><p className="helper">{t("Replaces only this language. Other translations stay unchanged.")}</p><Button size="sm" onClick={() => {update(generated);setGenerated(null);}}>{t("Use generated questions")}</Button></> : <p className="helper">{t("No questions could be generated from ready knowledge. Add more content or write your own.")}</p>}
      <Button size="sm" variant="ghost" onClick={() => setGenerated(null)}>{t("Dismiss")}</Button>
    </div>}
  </section>;
}
