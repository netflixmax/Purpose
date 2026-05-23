// 问志 localStorage 数据层。键名独立于读志，互不干扰。

const KEY = "purpose.asks.v1";

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function listAsks() {
  return load().sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at),
  );
}

export function getAsk(id) {
  return load().find((a) => a.id === id) || null;
}

function newId() {
  const rand = Math.random().toString(36).slice(2, 8);
  return `ak_${Date.now().toString(36)}${rand}`;
}

export function createAsk({ seed_text }) {
  const ask = {
    id: newId(),
    created_at: new Date().toISOString(),
    seed: { text: seed_text.trim(), depth: 0 },
    reductions: [],
    question: null,        // 立志后的最终问题
    fired: null,           // { fired_at, target }
    feedback: null,        // { rating: 'gold'|'usable'|'miss', note, at }
  };
  const list = load();
  list.push(ask);
  save(list);
  return ask;
}

export function updateAsk(id, mut) {
  const list = load();
  const idx = list.findIndex((a) => a.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...mut };
  save(list);
  return list[idx];
}

export function addReduction(id, { lens, text }) {
  const a = getAsk(id);
  if (!a) return null;
  const fromText =
    a.reductions.length > 0
      ? a.reductions[a.reductions.length - 1].to_text
      : a.seed.text;
  const reduction = {
    lens,
    from_text: fromText,
    to_text: text.trim(),
    at: new Date().toISOString(),
  };
  return updateAsk(id, { reductions: [...a.reductions, reduction] });
}

export function setQuestion(id, text) {
  const a = getAsk(id);
  if (!a) return null;
  return updateAsk(id, {
    question: { text: text.trim(), depth: a.reductions.length, at: new Date().toISOString() },
  });
}

export function markFired(id, target) {
  return updateAsk(id, {
    fired: { fired_at: new Date().toISOString(), target },
  });
}

export function setFeedback(id, { rating, note }) {
  return updateAsk(id, {
    feedback: { rating, note: note || "", at: new Date().toISOString() },
  });
}

export function clearFeedback(id) {
  return updateAsk(id, { feedback: null });
}

export function deleteAsk(id) {
  save(load().filter((a) => a.id !== id));
}

export function exportAll() {
  return JSON.stringify(load(), null, 2);
}

export function currentText(ask) {
  if (!ask) return "";
  if (ask.reductions.length === 0) return ask.seed.text;
  return ask.reductions[ask.reductions.length - 1].to_text;
}

export function currentDepth(ask) {
  return ask.reductions.length;
}

export function askStatus(ask) {
  if (!ask.question) return "drafting";
  if (!ask.fired) return "ready";          // 已立志、未发问
  if (!ask.feedback) return "fired";       // 已发问、未反馈
  return ask.feedback.rating;              // gold | usable | miss
}
