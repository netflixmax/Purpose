// localStorage 数据层。所有读志数据存在用户手机本地，不上传任何服务器。

const KEY = "purpose.readings.v1";

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

export function listReadings() {
  return load().sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at),
  );
}

export function getReading(id) {
  return load().find((r) => r.id === id) || null;
}

function newId() {
  const rand = Math.random().toString(36).slice(2, 8);
  return `rd_${Date.now().toString(36)}${rand}`;
}

export function createReading({ book_title, seed_text }) {
  const reading = {
    id: newId(),
    created_at: new Date().toISOString(),
    book_title: book_title.trim(),
    seed: { text: seed_text.trim(), depth: 0 },
    reductions: [],
    aspiration: null,
    review: null,
  };
  const list = load();
  list.push(reading);
  save(list);
  return reading;
}

export function updateReading(id, mut) {
  const list = load();
  const idx = list.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  const next = { ...list[idx], ...mut };
  list[idx] = next;
  save(list);
  return next;
}

export function addReduction(id, { lens, text }) {
  const r = getReading(id);
  if (!r) return null;
  const fromText =
    r.reductions.length > 0
      ? r.reductions[r.reductions.length - 1].to_text
      : r.seed.text;
  const reduction = {
    lens,
    from_text: fromText,
    to_text: text.trim(),
    at: new Date().toISOString(),
  };
  return updateReading(id, { reductions: [...r.reductions, reduction] });
}

export function setAspiration(id, text) {
  const r = getReading(id);
  if (!r) return null;
  const depth = r.reductions.length;
  return updateReading(id, {
    aspiration: { text: text.trim(), depth, at: new Date().toISOString() },
  });
}

export function setReview(id, review) {
  return updateReading(id, {
    review: { ...review, reviewed_at: new Date().toISOString() },
  });
}

export function deleteReading(id) {
  save(load().filter((r) => r.id !== id));
}

export function exportAll() {
  return JSON.stringify(load(), null, 2);
}

// 当前在化简中的读志的 current text — 即最后一次 reduction 的 to_text，或 seed
export function currentText(reading) {
  if (!reading) return "";
  if (reading.reductions.length === 0) return reading.seed.text;
  return reading.reductions[reading.reductions.length - 1].to_text;
}

export function currentDepth(reading) {
  return reading.reductions.length;
}

export function readingStatus(reading) {
  if (!reading.aspiration) return "drafting";
  if (!reading.review) return "pending";
  return reading.review.status; // 'answered' | 'partial' | 'unanswered' | 'abandoned'
}
