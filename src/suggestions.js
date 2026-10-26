export function questionLists(agent) {
  const lists = { ...(agent.suggested_questions_i18n || {}) };
  const fallback = agent.suggestion_default_language || "en";
  if (!Object.hasOwn(lists, fallback) && agent.suggested_questions?.length) lists[fallback] = agent.suggested_questions;
  return lists;
}
export function questionsFor(agent, language) {
  const lists = questionLists(agent);
  return lists[language] ?? lists[agent.suggestion_default_language || "en"] ?? [];
}
