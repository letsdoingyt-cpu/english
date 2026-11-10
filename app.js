'use strict';
/* Грамматика — тренажёр английских времён. Без сборки: всё состояние в localStorage этого браузера. */
const APP_VERSION = '1.0.0';
const SESSION_LEN = 10;
const LS_MAIN = 'eg.v1', LS_KEY = 'eg.key', LS_GEN = 'eg.gen.v1';
const GEM_HOST = 'https://generativelanguage.googleapis.com';
const DEFAULT_MODEL = 'gemini-3.8-flash';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rnd = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pad = n => String(n).padStart(2, '0');
const dstr = (d = new Date()) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); return dstr(new Date(y, m - 1, d + n)); };
const today = () => dstr();
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
const plural = (n, a, b, c) => { const m = n % 100, k = n % 10; return (m > 10 && m < 20) ? c : k === 1 ? a : (k >= 2 && k <= 4) ? b : c; };
const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36); };

const LV = window.LEVELS;
const lvIdx = l => LV.indexOf(l);
const T = Object.fromEntries(TOPICS.map(t => [t.id, t]));
const topicsFor = lv => TOPICS.filter(t => lvIdx(t.lv) <= lvIdx(lv));
const MODES = [
  { id: 'gap', name: 'Впиши слово', ph: 'Форма глагола' },
  { id: 'tf', name: 'Верно / неверно' },
  { id: 'tr', name: 'Переведи предложение', ph: 'Перевод на английский' },
  { id: 'words', name: 'Полезные слова' },
  { id: 'tense', name: 'Какое время?' },
  { id: 'listen', name: 'На слух', ph: 'Что ты слышишь?' },
];
const MODE = Object.fromEntries(MODES.map(m => [m.id, m]));
const TYPED = { gap: 1, tr: 1, words: 1, listen: 1 };

/* ---------- хранилище ---------- */
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { } }
const DEF = () => ({
  v: 1,
  settings: { theme: 'auto', autoSpeak: true, voice: '', rate: 0.85, model: DEFAULT_MODEL, useGen: true, apiForm: 0 },
  stats: { total: { c: 0, t: 0 }, topic: {}, level: {}, mode: {}, days: {} },
  recent: {}, unlocked: {}, errs: {}, seen: {}, sent: [],
  last: { level: 'A1', topics: ['be'], mode: 'gap' }, hideInstall: false,
});
function normState(o) {
  const d = DEF();
  if (!o || typeof o !== 'object' || o.v !== 1) return d;
  const s = Object.assign(d, o);
  s.settings = Object.assign(DEF().settings, o.settings || {});
  s.stats = Object.assign(DEF().stats, o.stats || {});
  for (const k of ['total', 'topic', 'level', 'mode', 'days']) if (!s.stats[k] || typeof s.stats[k] !== 'object') s.stats[k] = DEF().stats[k];
  for (const k of ['recent', 'unlocked', 'errs', 'seen']) if (!s[k] || typeof s[k] !== 'object' || Array.isArray(s[k])) s[k] = {};
  if (!Array.isArray(s.sent)) s.sent = [];
  s.last = Object.assign(DEF().last, o.last || {});
  if (!LV.includes(s.last.level)) s.last.level = 'A1';
  if (!MODE[s.last.mode]) s.last.mode = 'gap';
  s.last.topics = (Array.isArray(s.last.topics) ? s.last.topics : []).filter(id => T[id]);
  return s;
}
let S;
try { S = normState(JSON.parse(lsGet(LS_MAIN) || 'null')); } catch (e) { S = DEF(); }
function save() { if (!lsSet(LS_MAIN, JSON.stringify(S))) toast('Не удалось сохранить прогресс: хранилище браузера недоступно или переполнено.'); }

/* ---------- задания ---------- */
const POOL = {};   // 'topic|level' → [item]
const BY_ID = {};
function mkItem(t, lv, en, ru, wrong, why, src) {
  const m = String(en).match(/^(.*?)\{([^|{}]+)\|([^{}]+)\}(.*)$/);
  if (!m) return null;
  const alts = m[2].split('/').map(x => x.trim()).filter(Boolean);
  const it = { t, lv, pre: m[1], alts, base: m[3].trim(), post: m[4], ru: String(ru).trim(), wrong: String(wrong).trim(), why: String(why).trim(), src };
  it.full = it.pre + alts[0] + it.post;
  it.id = hash(it.full);
  return it;
}
function addItem(it) {
  if (!it || BY_ID[it.id]) return false;
  BY_ID[it.id] = it; (POOL[it.t + '|' + it.lv] = POOL[it.t + '|' + it.lv] || []).push(it); return true;
}
const packItem = it => ({ t: it.t, lv: it.lv, en: it.pre + '{' + it.alts.join('/') + '|' + it.base + '}' + it.post, ru: it.ru, wrong: it.wrong, why: it.why });
const unpackItem = (p, src) => p && T[p.t] && LV.includes(p.lv) ? mkItem(p.t, p.lv, p.en, p.ru || '', p.wrong || '', p.why || '', src || 'gen') : null;
for (const lv of LV) for (const [t, block] of Object.entries(STOCK[lv] || {}))
  for (const line of block.split('\n')) { const p = line.split(';'); if (p.length === 4) addItem(mkItem(t, lv, p[0].trim(), p[1], p[2], p[3], 'stock')); }
let GEN = [];
try { GEN = JSON.parse(lsGet(LS_GEN) || '[]'); if (!Array.isArray(GEN)) GEN = []; } catch (e) { GEN = []; }
GEN.forEach(p => addItem(unpackItem(p)));
function addGen(items) {
  for (const it of items) if (addItem(it)) GEN.push(packItem(it));
  if (GEN.length > 800) GEN = GEN.slice(-800);
  lsSet(LS_GEN, JSON.stringify(GEN));
}
const WORDLIST = {};
for (const lv of LV) WORDLIST[lv] = (WORDS[lv] || '').split('\n').map(l => l.split(';')).filter(p => p.length === 2).map(p => {
  const en = p[0].split('/').map(x => x.trim()), ru = p[1].split('/').map(x => x.trim());
  return { id: 'w' + hash(en[0]), lv, en, ru };
});

/* ---------- проверка ---------- */
function norm(s) {
  return String(s).toLowerCase().replace(/[’‘`´ʼ]/g, "'").replace(/[“”«»"]/g, ' ').replace(/[.,!?;:…()]/g, ' ').replace(/[—–-]/g, ' ').replace(/\s+/g, ' ').trim();
}
function variants(s) {
  let b = norm(s)
    .replace(/\bwon't\b/g, 'will not').replace(/\bcan't\b/g, 'can not').replace(/\bcannot\b/g, 'can not').replace(/\bshan't\b/g, 'shall not')
    .replace(/n't\b/g, ' not').replace(/'m\b/g, ' am').replace(/'re\b/g, ' are').replace(/'ve\b/g, ' have').replace(/'ll\b/g, ' will').replace(/\blet's\b/g, 'let us');
  const out = new Set();
  for (const s1 of ["'s", ' is', ' has']) for (const d1 of [' would', ' had'])
    out.add(b.replace(/'s\b/g, s1).replace(/'d\b/g, d1).replace(/\s+/g, ' ').trim());
  return out;
}
function same(a, b) { const A = variants(a), B = variants(b); for (const x of A) if (B.has(x)) return true; return false; }
const normRu = s => String(s).toLowerCase().replace(/ё/g, 'е').replace(/[.,!?;:…()«»"'—–-]/g, ' ').replace(/\s+/g, ' ').trim();
const stripTo = s => norm(s).replace(/^to /, '');

/* ---------- статистика ---------- */
const bump = (o, k, ok, sign = 1) => { const r = (o[k] = o[k] || { c: 0, t: 0 }); r.t = Math.max(0, r.t + sign); if (ok) r.c = Math.max(0, r.c + sign); };
const pct = r => r && r.t ? Math.round(r.c / r.t * 100) : null;
const taskLv = t => t.mode === 'words' ? t.word.lv : t.item.lv;
const taskKey = t => t.mode + ':' + (t.mode === 'words' ? t.word.id + ':' + t.dir : t.item.id);
function applyStat(task, ok, sign) {
  const st = S.stats;
  bump(st, 'total', ok, sign); bump(st.level, taskLv(task), ok, sign); bump(st.mode, task.mode, ok, sign); bump(st.days, today(), ok, sign);
  if (task.mode !== 'words') {
    const id = task.item.t; bump(st.topic, id, ok, sign);
    const r = (S.recent[id] = S.recent[id] || []);
    if (sign > 0) { r.push(ok ? 1 : 0); if (r.length > 20) r.shift(); } else r.pop();
  }
}
function errUpdate(task, ok) {
  const k = taskKey(task), e = S.errs[k], td = today();
  const prev = e ? JSON.parse(JSON.stringify(e)) : null;
  if (!ok) {
    S.errs[k] = { mode: task.mode, dir: task.dir || null, it: task.mode === 'words' ? task.word : packItem(task.item), stage: 0, due: addDays(td, 1), n: (e ? e.n : 0) + 1, last: td };
  } else if (e && e.due <= td) {
    e.stage++; e.last = td;
    if (e.stage >= 3) delete S.errs[k]; else e.due = addDays(td, [1, 3, 7][e.stage]);
  }
  return prev;
}
function record(task, ok) {
  applyStat(task, ok, 1);
  const prev = errUpdate(task, ok);
  if (task.mode !== 'words') {
    S.seen[task.item.id] = Date.now();
    S.sent.push(task.item.full); if (S.sent.length > 60) S.sent.shift();
  } else S.seen[task.word.id] = Date.now();
  const keys = Object.keys(S.seen);
  if (keys.length > 4000) keys.sort((a, b) => S.seen[a] - S.seen[b]).slice(0, 1000).forEach(k => delete S.seen[k]);
  save();
  if (navigator.storage && navigator.storage.persist && !record.asked) { record.asked = true; navigator.storage.persist().catch(() => { }); }
  return prev;
}
function streak() {
  const d = S.stats.days; let n = 0, cur = today();
  if (!(d[cur] && d[cur].t)) cur = addDays(cur, -1);
  while (d[cur] && d[cur].t) { n++; cur = addDays(cur, -1); }
  return n;
}
const recentAcc = id => { const r = S.recent[id] || []; return r.length ? r.reduce((a, b) => a + b, 0) / r.length : null; };
function isUnlocked(id) {
  const i = TOPICS.findIndex(t => t.id === id);
  if (i <= 0 || S.unlocked[id]) return true;
  const p = TOPICS[i - 1].id, r = S.recent[p] || [];
  if (r.length >= 10 && recentAcc(p) >= 0.8) { S.unlocked[id] = true; return true; }
  return false;
}
const dueErrs = () => Object.entries(S.errs).filter(([, e]) => e.due <= today());

/* ---------- озвучка ---------- */
const TTS = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
let VOICES = [];
const NOVELTY = /Eddy|Flo\b|Grandma|Grandpa|Reed|Rocko|Sandy|Shelley|Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Good News|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Fred|Junior|Kathy|Ralph|Эдди|Фло|Бабушка|Дедушка|Рид|Роко|Сэнди|Шелли|Альберт|Бах|Виолончел|Воббл|Джуниор|Зарвокс|Колокольчик|Кэти|Орган|новости|Прыг|Пузырьки|Ральф|Суперзвезда|Триноид|Фред|Ш[её]пот|Шутник/i;
function vScore(v) {
  const n = v.name || '', l = (v.lang || '').replace('_', '-');
  if (!/^en/i.test(l)) return -999;
  let s = /en-US/i.test(l) ? 30 : /en-GB/i.test(l) ? 27 : /en-(AU|CA|IE|NZ)/i.test(l) ? 12 : 6;
  if (/natural|neural|premium|enhanced|улучш|премиум|siri/i.test(n)) s += 50;
  if (/online/i.test(n)) s += 20;
  if (/google/i.test(n)) s += 35;
  if (/Samantha|Ava|Allison|Evan|Zoe|Nathan|Joelle|Noelle|Susan|Tom\b|Alex|Aaron|Nicky|Daniel|Kate|Serena|Oliver|Martha|Arthur|Jamie|Stephanie|Karen|Moira|Tessa|Саманта|Дэниэл|Даниэль|Карен|Мойра|Тесса|Аллисон|Сьюзан|Кейт|Серена|Оливер|Марта|Артур|Стефани/i.test(n)) s += 15;
  if (NOVELTY.test(n)) s -= 90;
  if (v.localService) s += 2;
  return s;
}
function loadVoices() {
  if (!TTS) return;
  let list = [];
  try { list = speechSynthesis.getVoices() || []; } catch (e) { }
  const en = list.filter(v => /^en/i.test(v.lang || '')).sort((a, b) => vScore(b) - vScore(a));
  if (en.length !== VOICES.length || en.some((v, i) => v.voiceURI !== VOICES[i].voiceURI)) {
    VOICES = en;
    if ($('#voice-sel')) fillVoices();
  }
}
function pickVoice() {
  if (!VOICES.length) loadVoices();
  let v = VOICES.find(x => x.voiceURI === S.settings.voice) || VOICES[0] || null;
  if (v && !navigator.onLine && v.localService === false) v = VOICES.find(x => x.localService) || v;
  return v;
}
let audioUnlocked = false;
function unlockAudio() {
  if (!TTS || audioUnlocked) return;
  audioUnlocked = true;
  try { speechSynthesis.speak(new SpeechSynthesisUtterance('')); } catch (e) { }
}
function speak(text, slow, retry, btn) {
  if (!TTS || !text) return false;
  try {
    audioUnlocked = true;
    const u = new SpeechSynthesisUtterance(text.replace(/[’‘]/g, "'"));
    const v = pickVoice();
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-US';
    u.rate = slow ? 0.7 : (+S.settings.rate || 0.85);
    let started = false;
    const mark = on => { $$('.speaking').forEach(b => b.classList.remove('speaking')); if (on && btn && btn.isConnected) btn.classList.add('speaking'); };
    u.onstart = () => { started = true; mark(true); };
    u.onend = () => mark(false);
    u.onerror = () => { started = true; mark(false); };
    const my = ++speakSeq;
    const go = () => { if (my === speakSeq) speechSynthesis.speak(u); };
    if (speechSynthesis.speaking || speechSynthesis.pending) { speechSynthesis.cancel(); setTimeout(go, 90); } else go();
    // если движок «завис» и фраза так и не началась — сбрасываем очередь и пробуем ещё раз
    if (!retry) setTimeout(() => { if (!started && my === speakSeq) { try { speechSynthesis.cancel(); } catch (e) { } speak(text, slow, true, btn); } }, 1800);
    return true;
  } catch (e) { return false; }
}
let speakSeq = 0;
function stopSpeak() { speakSeq++; if (TTS) try { speechSynthesis.cancel(); } catch (e) { } $$('.speaking').forEach(b => b.classList.remove('speaking')); }
if (TTS) {
  loadVoices();
  try { speechSynthesis.addEventListener('voiceschanged', loadVoices); } catch (e) { speechSynthesis.onvoiceschanged = loadVoices; }
  let tries = 0; const iv = setInterval(() => { loadVoices(); if (++tries > 16) clearInterval(iv); }, 300);   // на iPhone список приходит с задержкой
}
const SPK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h3.2L12 18.5v-13L7.2 9.5z" fill="currentColor" stroke="none"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11"/></svg>';
const spkBtn = (text, cls = '') => TTS ? `<button class="spk ${cls}" data-say="${esc(text)}" aria-label="Прослушать">${SPK}</button>` : '';

/* ---------- Gemini ---------- */
const getKey = () => (lsGet(LS_KEY) || '').trim();
const ERR = {
  nokey: 'Ключ Gemini не задан.',
  offline: 'Нет сети.',
  timeout: 'Gemini не ответил вовремя.',
  badkey: 'Ключ Gemini неверный — проверь его в настройках.',
  limit: 'Лимит бесплатных запросов Gemini исчерпан (429). Попробуй позже.',
  model: 'Модель не найдена — проверь название в настройках.',
  region: 'Gemini недоступен в этом регионе — включи VPN.',
  denied: 'Google отклонил запрос (403): проверь ключ и проект в AI Studio.',
  server: 'Сервер Gemini временно недоступен.',
  bad: 'Gemini отклонил запрос.',
  parse: 'Gemini вернул ответ не по схеме.',
  empty: 'Gemini вернул пустой ответ.',
};
const errText = e => (e && ERR[e.code]) || 'Не удалось обратиться к Gemini.';
let genPause = 0;
const upperTypes = s => {
  if (Array.isArray(s)) return s.map(upperTypes);
  if (s && typeof s === 'object') { const o = {}; for (const k in s) o[k] = k === 'type' && typeof s[k] === 'string' ? s[k].toUpperCase() : upperTypes(s[k]); return o; }
  return s;
};
function gemBodies(prompt, schema) {
  const contents = [{ role: 'user', parts: [{ text: prompt }] }];
  return [
    { contents, generationConfig: { responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema } }, thinkingConfig: { thinkingLevel: 'low' } } },
    { contents, generationConfig: { responseMimeType: 'application/json', responseSchema: upperTypes(schema) } },
    { contents, generationConfig: { responseMimeType: 'application/json' } },
  ];
}
async function gemFetch(path, init, timeoutMs) {
  const key = getKey();
  if (!key) throw { code: 'nokey' };
  if (navigator.onLine === false) throw { code: 'offline' };
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(GEM_HOST + path, Object.assign({}, init, { signal: ctl.signal, headers: Object.assign({ 'x-goog-api-key': key }, init.headers || {}), credentials: 'omit', cache: 'no-store' }));
  } catch (e) { throw { code: e && e.name === 'AbortError' ? 'timeout' : 'offline' }; }
  finally { clearTimeout(tm); }
  if (res.ok) return res.json();
  let msg = ''; try { const j = await res.json(); msg = (j.error && (j.error.message + ' ' + (j.error.status || ''))) || ''; } catch (e) { }
  if (/api key not valid|API_KEY_INVALID|api key expired/i.test(msg) || res.status === 401) throw { code: 'badkey', msg };
  if (/location is not supported/i.test(msg)) throw { code: 'region', msg };
  if (res.status === 429) { genPause = Date.now() + 60000; throw { code: 'limit', msg }; }
  if (res.status === 404) throw { code: 'model', msg };
  if (res.status === 403) throw { code: 'denied', msg };
  if (res.status >= 500) throw { code: 'server', msg };
  throw { code: 'bad', msg, status: res.status };
}
async function gemCall(prompt, schema, timeoutMs = 40000) {
  const model = (S.settings.model || DEFAULT_MODEL).trim().replace(/^models\//, '');
  const bodies = gemBodies(prompt, schema);
  const order = [0, 1, 2]; const f = S.settings.apiForm | 0; if (f) { order.splice(order.indexOf(f), 1); order.unshift(f); }
  let lastErr;
  for (const i of order) {
    try {
      const data = await gemFetch('/v1beta/models/' + encodeURIComponent(model) + ':generateContent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bodies[i]) }, timeoutMs);
      const parts = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
      const text = (parts || []).filter(p => !p.thought && typeof p.text === 'string').map(p => p.text).join('').trim();
      if (!text) throw { code: 'empty' };
      let json;
      try { json = JSON.parse(text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')); } catch (e) { throw { code: 'parse' }; }
      if (S.settings.apiForm !== i) { S.settings.apiForm = i; save(); }
      return json;
    } catch (e) {
      lastErr = e;
      if (!(e && e.code === 'bad' && e.status === 400)) throw e;   // 400 «плохой запрос» → пробуем другой формат схемы
    }
  }
  throw lastErr;
}
const ITEM_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'topic id copied from the plan' },
          level: { type: 'string', description: 'CEFR level copied from the plan' },
          sentence: { type: 'string', description: 'full correct English sentence' },
          answer: { type: 'string', description: 'exact fragment of the sentence the learner must type' },
          base: { type: 'string', description: 'bare verb shown in brackets, e.g. go, not/like, you/see' },
          wrong: { type: 'string', description: 'clearly ungrammatical replacement for the answer' },
          ru: { type: 'string', description: 'Russian translation of the sentence' },
          why: { type: 'string', description: 'short reason in Russian why this tense is used' },
        },
        required: ['topic', 'level', 'sentence', 'answer', 'base', 'wrong', 'ru', 'why'],
      },
    },
  },
  required: ['items'],
};
const CHECK_SCHEMA = {
  type: 'object',
  properties: { correct: { type: 'boolean' }, corrected: { type: 'string' }, explanation: { type: 'string' } },
  required: ['correct', 'corrected', 'explanation'],
};
const GEN_HINT = {
  be: 'the verb "to be" as the main verb (am/is/are/was/were), no other tenses',
  pas: 'passive voice in Present, Past or Future Simple only (am/is/are/was/were/will be + V3)',
  pall: 'passive voice in continuous or perfect tenses or after modal verbs (is being done, has been done, had been done, must be done)',
  c0: 'zero conditional (If + Present Simple, Present Simple)', c1: 'first conditional (If + Present Simple, will + verb)',
  c2: 'second conditional (If + Past Simple, would + verb)', c3: 'third conditional (If + Past Perfect, would have + V3)',
  cmix: 'mixed conditional (past condition with present result, or present condition with past result)',
  used: 'used to + verb (past habits and states)', gt: 'to be going to + verb',
};
const LV_HINT = {
  A1: 'A1: 4–8 words, the most basic everyday vocabulary',
  A2: 'A2: 6–11 words, simple everyday vocabulary (travel, home, work, hobbies)',
  B1: 'B1: 8–14 words, vocabulary about work, study, experiences and opinions',
  B2: 'B2: 9–16 words, richer and more abstract vocabulary (business, society, science)',
};
function genPrompt(specs) {
  const plan = specs.map((s, i) => `${i + 1}. topic=${s.t} — ${T[s.t].name}: ${GEN_HINT[s.t] || T[s.t].formula}; level=${s.lv}`).join('\n');
  const lvs = [...new Set(specs.map(s => s.lv))].map(l => '- ' + LV_HINT[l]).join('\n');
  const recent = S.sent.slice(-40);
  return `You write grammar exercises for a Russian-speaking learner of English.
Create exactly ${specs.length} items, one for each line of the plan, in the same order.

PLAN
${plan}

RULES FOR EVERY ITEM
- "sentence": one natural, correct English sentence that clearly requires this tense or construction. Add a time marker or context so that the tense is unambiguous. Affirmative, negative and question forms should all appear across the batch.
- "answer": the exact fragment of "sentence" the learner has to type — the verb form with its auxiliaries (and the subject in questions, e.g. "Did you see"). It must occur in "sentence" exactly once, with the same letter case.
- "base": what is shown in brackets — the bare verb, e.g. "go", "not/like", "you/see".
- "wrong": a form that makes the sentence clearly ungrammatical when put instead of "answer" (wrong auxiliary, wrong verb form, missing particle). It must not be another valid tense.
- "ru": a natural Russian translation of the whole sentence.
- "why": a reason in Russian, at most 12 words, why this tense is used here (point at the marker), without a full stop at the end.
- "topic" and "level": copy them from the plan line.
- For conditionals keep both clauses in "sentence" and choose only one verb form as "answer".
- Never use the characters { } | / ; in "sentence", "answer" or "wrong".
- Vary subjects, verbs and situations; do not write two similar sentences.

VOCABULARY AND LENGTH
${lvs}

DO NOT REPEAT OR PARAPHRASE THESE RECENT SENTENCES
${recent.length ? recent.map(s => '- ' + s).join('\n') : '- (none yet)'}`;
}
const CYR = /[а-яё]/i;
function validateGen(r, specs) {
  if (!r || typeof r !== 'object') return null;
  const str = k => typeof r[k] === 'string' ? r[k].trim() : '';
  const t = str('topic'), lv = str('level').toUpperCase(), sen = str('sentence'), ans = str('answer'), base = str('base'), wrong = str('wrong'), ru = str('ru'), why = str('why').replace(/[.;]+$/, '');
  if (!T[t] || !LV.includes(lv) || !specs.some(s => s.t === t && s.lv === lv)) return null;
  if (sen.length < 8 || sen.length > 220 || CYR.test(sen) || /[{}|;]/.test(sen)) return null;
  if (!ans || ans.length > 80 || /[{}|/;]/.test(ans) || sen.indexOf(ans) < 0 || sen.indexOf(ans) !== sen.lastIndexOf(ans)) return null;
  if (!base || base.length > 50 || CYR.test(base) || /[{}|;]/.test(base)) return null;
  if (!wrong || wrong.length > 80 || /[{}|;]/.test(wrong) || same(wrong, ans)) return null;
  if (ru.length < 3 || ru.length > 260 || !CYR.test(ru) || ru.includes(';')) return null;
  if (why.length < 3 || why.length > 200 || !CYR.test(why)) return null;
  const i = sen.indexOf(ans);
  const it = mkItem(t, lv, sen.slice(0, i) + '{' + ans + '|' + base + '}' + sen.slice(i + ans.length), ru, wrong, why.replace(/;/g, ','), 'gen');
  if (!it || BY_ID[it.id] || S.sent.some(s => same(s, it.full))) return null;
  return it;
}
async function genItems(specs) {
  const data = await gemCall(genPrompt(specs), ITEM_SCHEMA);
  const arr = Array.isArray(data) ? data : data && data.items;
  if (!Array.isArray(arr)) throw { code: 'parse' };
  const out = []; const ids = new Set();
  for (const r of arr.slice(0, 20)) { const it = validateGen(r, specs); if (it && !ids.has(it.id)) { ids.add(it.id); out.push(it); } }
  if (!out.length) throw { code: 'parse' };
  addGen(out);
  return out;
}
async function checkTranslation(item, user) {
  const t = T[item.t];
  const r = await gemCall(`You check a translation written by a Russian-speaking learner of English.
Russian sentence: "${item.ru}"
Required tense or construction: ${t.name} (${GEN_HINT[item.t] || t.formula})
Reference translation: "${item.full}"
Learner's answer: "${user}"

Set "correct" to true if the answer is grammatically correct English, conveys the meaning of the Russian sentence and uses the required tense or construction. Accept any valid wording, synonyms and contractions; ignore capital letters and missing final punctuation. Set it to false if there is a grammar mistake, a misspelled word, a different tense, or the meaning clearly differs.
"corrected": the learner's answer with the minimum corrections needed (repeat the answer if it is already correct).
"explanation": 1–2 sentences in Russian: why this tense is needed here and, if the answer is wrong, what exactly is wrong.`, CHECK_SCHEMA, 25000);
  if (!r || typeof r.correct !== 'boolean' || typeof r.explanation !== 'string') throw { code: 'parse' };
  return { correct: r.correct, corrected: typeof r.corrected === 'string' ? r.corrected.trim().slice(0, 300) : '', explanation: r.explanation.trim().slice(0, 500) };
}
const canGem = () => !!getKey() && navigator.onLine !== false;

/* ---------- сборка тренировки ---------- */
function pickFrom(pool, used) {
  const free = pool.filter(x => !used.has(x.id));
  if (!free.length) return null;
  const fresh = free.filter(x => !S.seen[x.id]);
  let cand = fresh;
  if (!cand.length) { const s = free.slice().sort((a, b) => S.seen[a.id] - S.seen[b.id]); cand = s.slice(0, Math.max(1, Math.ceil(s.length / 3))); }
  const x = rnd(cand); used.add(x.id); return x;
}
function tenseOptions(it) {
  const bad = new Set([it.t, ...(CONFUSE[it.t] || [])]);
  let pool = topicsFor(it.lv).filter(t => !bad.has(t.id));
  if (pool.length < 3) pool = TOPICS.filter(t => !bad.has(t.id));
  return shuffle([it.t, ...shuffle(pool).slice(0, 3).map(t => t.id)]);
}
function mkTask(mode, it) {
  const task = { mode, item: it };
  if (mode === 'tf') task.tfCorrect = Math.random() < 0.5;
  if (mode === 'tense') task.options = tenseOptions(it);
  return task;
}
const modesAvail = () => MODES.map(m => m.id).filter(m => m !== 'listen' || TTS);
function errTask(k, e) {
  if (e.mode === 'words') { const w = e.it; return w && w.en ? { mode: 'words', word: w, dir: e.dir || 'ru2en', review: true } : null; }
  const it = unpackItem(e.it, 'err'); if (!it || !MODE[e.mode]) return null;
  const task = mkTask(e.mode, it); task.review = true; return task;
}
function buildSession(cfg) {
  const tasks = [], used = new Set();
  if (cfg.kind === 'errors') {
    const all = Object.entries(S.errs).sort((a, b) => a[1].due < b[1].due ? -1 : 1);
    const due = all.filter(([, e]) => e.due <= today());
    for (const [k, e] of (due.length ? due : all).slice(0, 15)) { const t = errTask(k, e); if (t && (t.mode !== 'listen' || TTS)) tasks.push(t); }
    return { cfg, tasks, i: 0, right: 0, hide: true, wrong: [] };
  }
  let modes = [];
  if (cfg.kind === 'topic') modes = Array(SESSION_LEN).fill(cfg.mode);
  else { const av = modesAvail(); while (modes.length < SESSION_LEN) modes = modes.concat(shuffle(av)); modes = shuffle(modes.slice(0, SESSION_LEN)); }
  let cycle = [];
  for (let i = 0; i < SESSION_LEN; i++) {
    const mode = modes[i];
    const lv = cfg.kind === 'full' ? rnd(LV) : cfg.level;
    if (mode === 'words') {
      const w = pickFrom(WORDLIST[lv], used);
      if (w) tasks.push({ mode, word: w, dir: Math.random() < 0.5 ? 'ru2en' : 'en2ru' });
      continue;
    }
    let tid;
    if (cfg.kind === 'topic') { if (!cycle.length) cycle = shuffle(cfg.topics); tid = cycle.pop(); }
    else tid = rnd(topicsFor(lv)).id;
    const it = pickFrom(POOL[tid + '|' + lv] || [], used);
    if (it) tasks.push(mkTask(mode, it));
  }
  // подмешиваем ошибки, которым пришёл срок повторения
  const due = dueErrs().filter(([, e]) => {
    if (e.mode === 'listen' && !TTS) return false;
    if (cfg.kind === 'full') return true;
    const lv = e.it && e.it.lv;
    if (cfg.kind === 'rand') return lv === cfg.level;
    return e.mode === cfg.mode && lv === cfg.level && (e.mode === 'words' || cfg.topics.includes(e.it.t));
  });
  shuffle(due).slice(0, 2).forEach(([k, e], n) => { const t = errTask(k, e); if (t && tasks.length > n && !tasks.some(x => taskKey(x) === taskKey(t))) tasks[n] = t; });
  return { cfg, tasks: shuffle(tasks), i: 0, right: 0, hide: cfg.kind !== 'topic', wrong: [] };
}

/* ---------- экран тренировки ---------- */
let SES = null;
const cur = () => SES && SES.tasks[SES.i];
const INPUT_ATTRS = 'type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" inputmode="text"';
function setSesOpen(on) {
  document.documentElement.classList.toggle('ses-open', on);
  $('#session').hidden = !on;
  if (on) { updateVV(); window.scrollTo(0, 0); }
}
async function begin(cfg) {
  unlockAudio();
  const was = {}; TOPICS.forEach(t => { was[t.id] = isUnlocked(t.id); });
  const ses = buildSession(cfg); ses.wasUnlocked = was;
  if (!ses.tasks.length) { toast(cfg.kind === 'errors' ? 'Ошибок пока нет — так держать!' : 'Для такого выбора нет заданий.'); return; }
  SES = ses; setSesOpen(true);
  const specs = ses.tasks.filter(t => t.mode !== 'words' && !t.review).map(t => ({ t: t.item.t, lv: t.item.lv }));
  if (cfg.kind !== 'errors' && S.settings.useGen && specs.length && canGem() && Date.now() > genPause) {
    ses.st = 'load';
    $('#prog').style.width = '0%'; $('#ses-n').textContent = '';
    $('#ses-body').innerHTML = `<div class="glass task center"><div class="spin"></div><h2>Готовлю новые задания</h2><p class="muted">Gemini пишет свежие предложения под твой уровень. Обычно это занимает несколько секунд.</p></div>`;
    $('#ses-foot').innerHTML = `<button class="btn wide" data-act="skip-gen">Не ждать — взять встроенные</button>`;
    let skip; const skipped = new Promise(r => { skip = r; }); ses.skip = () => skip('skip');
    const job = genItems(specs).then(items => ({ items }), err => ({ err }));
    const res = await Promise.race([job, skipped]);
    if (SES !== ses) return;
    if (res && res.items) {
      const left = res.items.slice();
      ses.tasks.forEach((t, i) => {
        if (t.mode === 'words' || t.review) return;
        const j = left.findIndex(x => x.t === t.item.t && x.lv === t.item.lv);
        if (j >= 0) ses.tasks[i] = mkTask(t.mode, left.splice(j, 1)[0]);
      });
      ses.gen = res.items.length;
    } else if (res && res.err) toast(errText(res.err) + ' Беру задания из встроенного запаса.');
  }
  renderTask();
}
function topicTag(task) {
  if (task.mode === 'words') return `<span class="tag">${task.word.lv}</span>`;
  if (task.mode === 'tense') return '';
  if (SES.hide) return `<span class="tag dim">время скрыто</span>`;
  return `<span class="tag">${esc(T[task.item.t].name)}</span>`;
}
function renderTask() {
  const ses = SES, task = cur(), n = ses.tasks.length;
  ses.st = 'ask';
  $('#prog').style.width = (ses.i / n * 100) + '%';
  $('#ses-n').textContent = (ses.i + 1) + ' / ' + n;
  const it = task.item, w = task.word;
  let q = '', hint = '';
  if (task.mode === 'gap') {
    q = `<div class="q">${esc(it.pre)}<span class="gap">&nbsp;</span> <span class="base">(${esc(it.base.replace(/\//g, ' / '))})</span>${esc(it.post)}</div>`;
    hint = esc(it.ru);
  } else if (task.mode === 'tf') {
    task.shown = task.tfCorrect ? it.full : it.pre + it.wrong + it.post;
    q = `<div class="qrow"><div class="q grow">${esc(task.shown)}</div>${spkBtn(task.shown)}</div>`;
    hint = 'Предложение грамматически правильное?';
  } else if (task.mode === 'tr') {
    q = `<div class="q">${esc(it.ru)}</div>`;
    hint = ses.hide ? 'Переведи на английский. Время определи сам.' : 'Переведи на английский во времени ' + esc(T[it.t].name) + '.';
  } else if (task.mode === 'words') {
    q = task.dir === 'ru2en' ? `<div class="q">${esc(w.ru[0])}</div>` : `<div class="qrow"><div class="q grow">${esc(w.en[0])}</div>${spkBtn(w.en[0])}</div>`;
    hint = task.dir === 'ru2en' ? 'Напиши по-английски.' : 'Напиши перевод по-русски.';
  } else if (task.mode === 'tense') {
    q = `<div class="qrow"><div class="q grow">${esc(it.full)}</div>${spkBtn(it.full)}</div>`;
    hint = 'Какое это время или конструкция?';
  } else if (task.mode === 'listen') {
    q = `<button class="bigplay" data-say="${esc(it.full)}" aria-label="Прослушать фразу">${SPK}</button><div class="center"><button class="btn sm" data-say="${esc(it.full)}" data-slow="1">Медленнее</button></div>`;
    hint = 'Послушай и запиши фразу по-английски.';
  }
  const flag = task.review ? '<span class="tag dim">повтор ошибки</span>' : (it && it.src === 'gen' ? '<span class="tag dim">Gemini</span>' : '');
  $('#ses-body').innerHTML = `<div class="glass task"><div class="task-h"><span class="mode">${MODE[task.mode].name}</span>${topicTag(task)}${flag}</div>${q}<div class="hint" id="hint">${hint}</div></div><div id="fb"></div>`;
  $('#ses-scroll').scrollTop = 0;
  const foot = $('#ses-foot');
  if (TYPED[task.mode]) {
    const ru = task.mode === 'words' && task.dir === 'en2ru';
    const ph = task.mode === 'words' ? (ru ? 'Перевод по-русски' : 'По-английски') : MODE[task.mode].ph;
    let inp = $('#ans');
    if (!inp) {
      foot.innerHTML = `<form id="ansf" class="stack" novalidate><input id="ans" class="field" ${INPUT_ATTRS} aria-label="Твой ответ"><button class="btn primary wide" type="submit" id="go">Проверить</button></form>`;
      inp = $('#ans');
    }
    inp.value = ''; inp.className = 'field'; inp.placeholder = ph; inp.lang = ru ? 'ru' : 'en'; delete inp.dataset.lock;
    $('#go').textContent = 'Проверить'; $('#go').disabled = false;
    inp.focus({ preventScroll: true });
  } else if (task.mode === 'tf') {
    foot.innerHTML = `<div class="opts two"><button class="btn opt" data-opt="0">Верно <span class="k">1</span></button><button class="btn opt" data-opt="1">Неверно <span class="k">2</span></button></div>`;
  } else {
    foot.innerHTML = `<div class="opts">${task.options.map((id, i) => `<button class="btn opt" data-opt="${i}"><span class="k">${i + 1}</span> ${esc(T[id].name)}</button>`).join('')}</div>`;
  }
  if (task.mode === 'listen') speak(it.full, false, false, $('.bigplay'));
}
function sentenceHTML(it) { return esc(it.pre) + '<span class="hit">' + esc(it.alts[0]) + '</span>' + esc(it.post); }
function whyHTML(it) {
  const t = T[it.t];
  return `<p class="why"><span class="tag">${esc(t.name)}</span> ${esc(cap(it.why))}.</p><p class="why small">Формула: ${esc(t.formula)}</p>`;
}
function feedbackHTML(task, res) {
  const ok = res.ok, it = task.item;
  let h = `<div class="fb ${ok ? 'ok' : 'no'}" role="status"><h4>${ok ? 'Верно' : 'Неверно'}</h4>`;
  if (task.mode === 'words') {
    const w = task.word;
    h += `<div class="row"><p class="right grow">${esc(w.en.join(' / '))} — ${esc(w.ru.join(', '))}</p>${spkBtn(w.en[0])}</div>`;
    if (!ok) h += `<p class="small">Твой ответ: ${esc(res.user)}</p>`;
  } else {
    if (task.mode === 'tf') h += `<p>${task.tfCorrect ? 'В предложении нет ошибки.' : 'В предложении ошибка: <span class="bad">' + esc(it.wrong) + '</span>. Правильно так:'}</p>`;
    if (task.mode === 'tense') h += `<p>Это ${esc(T[it.t].name)} — ${esc(T[it.t].ru.toLowerCase())}.</p>`;
    h += `<div class="row"><p class="right grow">${sentenceHTML(it)}</p>${spkBtn(it.full)}</div>`;
    if (task.mode !== 'gap' && task.mode !== 'tr') h += `<p class="small">${esc(it.ru)}</p>`;
    if ((task.mode === 'tr' || task.mode === 'listen' || task.mode === 'gap') && !ok) h += `<p class="small">Твой ответ: ${esc(res.user)}</p>`;
    if (res.gem) {
      if (ok && !same(res.user, it.full)) h += `<p class="small">Твой вариант тоже подходит: ${esc(res.user)}</p>`;
      if (!ok && res.gem.corrected && !same(res.gem.corrected, res.user)) h += `<p class="small">С исправлениями: ${esc(res.gem.corrected)}</p>`;
      h += `<p class="why">${esc(res.gem.explanation)}</p>`;
    }
    h += whyHTML(it);
  }
  if (res.note) h += `<p class="small">${esc(res.note)}</p>`;
  if (!ok && res.override) h += `<button class="btn sm" data-act="override">Мой ответ тоже верный</button>`;
  return h + '</div>';
}
function finish(res) {
  const ses = SES, task = cur();
  ses.st = 'fb'; ses.fbAt = Date.now(); ses.res = res;
  if (res.ok) ses.right++; else ses.wrong.push(task);
  ses.prevErr = record(task, res.ok);
  $('#prog').style.width = ((ses.i + 1) / ses.tasks.length * 100) + '%';
  if (task.mode === 'gap') { const g = $('#ses-body .gap'); if (g) { g.textContent = task.item.alts[0]; g.className = res.ok ? 'hit' : 'gap'; } }
  $('#fb').innerHTML = feedbackHTML(task, res);
  const last = ses.i + 1 >= ses.tasks.length, label = last ? 'Итоги' : 'Дальше';
  const inp = $('#ans');
  if (inp && TYPED[task.mode]) { inp.classList.add(res.ok ? 'ok' : 'no'); inp.dataset.lock = '1'; $('#go').textContent = label; $('#go').disabled = false; }
  else $('#ses-foot').innerHTML = `<button class="btn primary wide" data-act="next">${label}</button>`;
  requestAnimationFrame(() => { const sc = $('#ses-scroll'), fb = $('#fb'); if (fb && fb.offsetTop + fb.offsetHeight > sc.scrollTop + sc.clientHeight) sc.scrollTo({ top: Math.max(0, fb.offsetTop - 12), behavior: 'smooth' }); });
  if (S.settings.autoSpeak) speak(task.mode === 'words' ? task.word.en[0] : task.item.full, false, false, $('#fb .spk'));
}
async function submitAnswer(val) {
  const ses = SES, task = cur();
  if (!ses || ses.st !== 'ask' || !TYPED[task.mode]) return;
  val = val.trim();
  const inp = $('#ans');
  if (!val) { if (inp) inp.focus(); return; }
  const it = task.item;
  if (task.mode === 'gap') return finish({ ok: it.alts.some(a => same(val, a)) || it.alts.some(a => same(val, it.pre + a + it.post)), user: val });
  if (task.mode === 'listen') return finish({ ok: it.alts.some(a => same(val, it.pre + a + it.post)), user: val });
  if (task.mode === 'words') {
    const w = task.word;
    const ok = task.dir === 'ru2en' ? w.en.some(e => same(val, e) || stripTo(val) === stripTo(e)) : w.ru.some(r => normRu(r) === normRu(val));
    return finish({ ok, user: val, override: true });
  }
  // перевод предложения
  if (it.alts.some(a => same(val, it.pre + a + it.post))) return finish({ ok: true, user: val });
  if (canGem()) {
    ses.st = 'wait'; $('#go').disabled = true; $('#go').textContent = 'Проверяю через Gemini…'; if (inp) inp.dataset.lock = '1';
    try {
      const g = await checkTranslation(it, val);
      if (SES !== ses || cur() !== task) return;
      return finish({ ok: g.correct, user: val, gem: g, override: true });
    } catch (e) {
      if (SES !== ses || cur() !== task) return;
      toast(errText(e) + ' Сверяю с эталоном.');
      return finish({ ok: false, user: val, override: true, note: 'Gemini недоступен, поэтому сравнил только с эталоном. Если твой вариант тоже верный — засчитай его сам.' });
    }
  }
  finish({ ok: false, user: val, override: true, note: (getKey() ? 'Нет сети' : 'Без ключа Gemini') + ' сверяю только с эталоном. Если твой вариант тоже верный — засчитай его сам.' });
}
function choose(i) {
  const ses = SES, task = cur();
  if (!ses || ses.st !== 'ask') return;
  let ok, rightIdx;
  if (task.mode === 'tf') { rightIdx = task.tfCorrect ? 0 : 1; ok = i === rightIdx; }
  else if (task.mode === 'tense') { rightIdx = task.options.indexOf(task.item.t); ok = i === rightIdx; if (i >= task.options.length) return; }
  else return;
  finish({ ok, user: String(i) });
}
function overrideLast() {
  const ses = SES, task = cur();
  if (!ses || ses.st !== 'fb' || !ses.res || ses.res.ok) return;
  applyStat(task, false, -1); applyStat(task, true, 1);
  const k = taskKey(task); if (ses.prevErr) S.errs[k] = ses.prevErr; else delete S.errs[k];
  save();
  ses.res.ok = true; ses.right++; ses.wrong = ses.wrong.filter(t => t !== task);
  const fb = $('#fb .fb'); if (fb) { fb.className = 'fb ok'; $('h4', fb).textContent = 'Засчитано'; const b = $('[data-act=override]', fb); if (b) b.remove(); }
  const inp = $('#ans'); if (inp) { inp.classList.remove('no'); inp.classList.add('ok'); }
}
function next() {
  const ses = SES;
  if (!ses) return;
  if (ses.st === 'sum') return begin(ses.cfg);
  if (ses.st !== 'fb' || Date.now() - ses.fbAt < 250) return;
  stopSpeak();
  if (ses.i + 1 >= ses.tasks.length) return renderSummary();
  ses.i++; renderTask();
}
function renderSummary() {
  const ses = SES, n = ses.tasks.length, p = Math.round(ses.right / n * 100);
  ses.st = 'sum';
  $('#ses-n').textContent = '';
  const opened = TOPICS.filter(t => !ses.wasUnlocked[t.id] && isUnlocked(t.id));
  if (opened.length) save();
  const wrong = ses.wrong.map(t => t.mode === 'words'
    ? `<div class="err">${esc(t.word.en[0])} — ${esc(t.word.ru[0])}<small>Полезные слова · ${t.word.lv}</small></div>`
    : `<div class="err">${sentenceHTML(t.item)}<small>${esc(T[t.item.t].name)} · ${MODE[t.mode].name}</small></div>`).join('');
  $('#ses-body').innerHTML = `<div class="glass task center"><div class="mode">Итоги</div><div class="bigpct" style="margin:14px 0 6px">${p} %</div>
    <p class="muted">Верно ${ses.right} из ${n}${ses.gen ? ' · новых заданий от Gemini: ' + ses.gen : ''}</p>
    ${opened.map(t => `<p><span class="tag">Открыто</span> ${esc(t.name)}</p>`).join('')}</div>
    ${wrong ? `<div class="glass task" style="margin-top:12px"><div class="mode" style="margin-bottom:6px">Вернутся на повторение завтра</div>${wrong}</div>` : ''}`;
  $('#ses-foot').innerHTML = `<div class="stack"><button class="btn primary wide" data-act="again">Ещё раз</button><button class="btn wide" data-act="ses-close">Готово</button></div>`;
  $('#ses-scroll').scrollTop = 0;
}
function closeSession() {
  stopSpeak();
  SES = null; setSesOpen(false); $('#ses-foot').innerHTML = ''; $('#ses-body').innerHTML = '';
  render();
}

/* ---------- вкладки ---------- */
let TAB = 'train';
let deferredInstall = null;
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
function render() {
  const app = $('#app');
  app.innerHTML = ({ train: viewTrain, tenses: viewTenses, stats: viewStats, settings: viewSettings })[TAB]();
  $$('.tab').forEach((b, i) => { const on = b.dataset.tab === TAB; b.setAttribute('aria-selected', on); if (on) $('.tabbar').style.setProperty('--i', i); });
  if (TAB === 'settings') { fillVoices(); loadVoices(); }
}
function viewTrain() {
  const st = S.stats, td = st.days[today()], s = streak(), acc = pct(st.total);
  const L = S.last, avail = topicsFor(L.level);
  L.topics = L.topics.filter(id => avail.some(t => t.id === id) && isUnlocked(id));
  const words = L.mode === 'words';
  const errAll = Object.keys(S.errs).length, errDue = dueErrs().length;
  let install = '';
  if (!S.hideInstall && !isStandalone()) {
    if (deferredInstall) install = `<div class="glass card"><h2>Поставь на главный экран</h2><p class="muted small">Откроется как обычное приложение и будет работать без интернета.</p><div class="row" style="margin-top:12px"><button class="btn primary grow" data-act="install">Установить</button><button class="btn" data-act="hide-install">Позже</button></div></div>`;
    else if (isIOS) install = `<div class="glass card"><h2>Поставь на экран «Домой»</h2><p class="muted small">В Safari нажми «Поделиться» внизу экрана, затем «На экран „Домой“». Тренажёр откроется как приложение и будет работать без интернета.</p><button class="btn sm" style="margin-top:12px" data-act="hide-install">Понятно</button></div>`;
  }
  const key = getKey();
  return `<section class="view">
  <h1>Тренировка</h1><p class="sub">Английские времена от A1 до B2</p>
  <div class="hero">
    <div class="glass stat"><b>${s}</b><span>${plural(s, 'день', 'дня', 'дней')} подряд</span></div>
    <div class="glass stat"><b>${td ? td.t : 0}</b><span>${plural(td ? td.t : 0, 'ответ', 'ответа', 'ответов')} сегодня</span></div>
    <div class="glass stat"><b>${acc == null ? '—' : acc + ' %'}</b><span>точность</span></div>
  </div>
  ${install}
  <div class="glass card">
    <h2>По времени</h2>
    <p class="muted small" style="margin:0 0 14px">Выбери уровень, времена и вид задания.</p>
    <label class="lbl">Уровень</label>
    <div class="seg" role="group" aria-label="Уровень">${LV.map(l => `<button data-level="${l}" aria-pressed="${l === L.level}">${l}</button>`).join('')}</div>
    <label class="lbl" style="margin-top:16px">Задание</label>
    <div class="chips">${MODES.map(m => `<button class="chip" data-mode="${m.id}" aria-pressed="${m.id === L.mode}">${m.name}</button>`).join('')}</div>
    ${words ? `<p class="muted small" style="margin:14px 4px 0">Слова и фразы подбираются по уровню — времена выбирать не нужно.</p>` : `
    <label class="lbl" style="margin-top:16px">Времена и конструкции</label>
    <div class="chips">${avail.map(t => { const un = isUnlocked(t.id); return `<button class="chip${un ? '' : ' locked'}" data-topic="${t.id}" aria-pressed="${L.topics.includes(t.id)}">${un ? '' : '<span aria-label="закрыто">🔒</span>'}${esc(t.name)}</button>`; }).join('')}</div>`}
    <button class="btn primary wide" style="margin-top:18px" data-act="start-topic" ${!words && !L.topics.length ? 'disabled' : ''}>Начать</button>
  </div>
  <div class="glass card">
    <h2>Рандом</h2>
    <p class="muted small" style="margin:0 0 14px">Случайные времена и задания. Название времени не подсказываю — определи сам.</p>
    <div class="rand">${LV.map(l => `<button class="btn" data-rand="${l}">${l}<small>рандом</small></button>`).join('')}</div>
    <button class="btn primary wide" style="margin-top:10px" data-act="full">Фулл рандом</button>
  </div>
  <div class="glass card">
    <h2>Мои ошибки</h2>
    <p class="muted small" style="margin:0 0 14px">${errAll ? `К повторению сегодня: ${errDue}. Всего в списке: ${errAll}.` : 'Пока пусто. Ошибки вернутся на следующий день, через 3 дня и через неделю.'}</p>
    <button class="btn wide" data-act="errors" ${errAll ? '' : 'disabled'}>${errDue || !errAll ? 'Повторить ошибки' : 'Повторить досрочно'}</button>
  </div>
  <div class="gline"><span class="dot ${key ? 'on' : ''}"></span><span>${key ? (S.settings.useGen ? 'Gemini подключён: новые задания и проверка переводов.' : 'Ключ Gemini сохранён, генерация заданий выключена.') : 'Работаю на встроенном запасе. Ключ Gemini добавляется в настройках.'}</span></div>
  </section>`;
}
function viewTenses() {
  let h = `<section class="view"><h1>Времена</h1><p class="sub">Шпаргалки. Следующее время открывается, когда в предыдущем точность 80 % и выше.</p>`;
  for (const lv of LV) {
    h += `<h3>Уровень ${lv}</h3>`;
    for (const t of TOPICS.filter(x => x.lv === lv)) {
      const un = isUnlocked(t.id), a = recentAcc(t.id), p = a == null ? 0 : Math.round(a * 100);
      h += `<button class="glass trow${un ? '' : ' lock'}" data-sheet="${t.id}">
        <span class="ring" style="--p:${p}"><span>${un ? (a == null ? '—' : p) : '🔒'}</span></span>
        <span class="grow"><b>${esc(t.name)}</b><small>${esc(t.ru)}</small></span><span class="muted" aria-hidden="true">›</span></button>`;
    }
  }
  return h + '</section>';
}
function openSheet(id) {
  const t = T[id], un = isUnlocked(id), i = TOPICS.indexOf(t), st = S.stats.topic[id];
  $('#sheet').innerHTML = `<div class="sheet-wrap" data-act="sheet-close"><div class="sheet" role="dialog" aria-label="${esc(t.name)}">
    <div class="row"><div class="grow"><h2>${esc(t.name)}</h2><div class="muted">${esc(t.ru)}</div></div><span class="tag">${t.lv}</span><button class="iconbtn" data-act="sheet-close" aria-label="Закрыть">✕</button></div>
    <h3>Формула</h3><div class="formula">${esc(t.formula)}</div>
    <h3>Когда используется</h3><div style="margin:0 6px">${esc(t.use)}</div>
    <h3>Слова-маркеры</h3><div style="margin:0 6px">${esc(t.markers)}</div>
    <h3>Примеры</h3><div style="margin:0 6px">${t.ex.map(e => `<div class="ex"><div class="grow"><b>${esc(e[0])}</b><div class="muted">${esc(e[1])}</div></div>${spkBtn(e[0])}</div>`).join('')}</div>
    <p class="muted small" style="margin:14px 6px 0">${st && st.t ? `Ответов: ${st.t}, точность ${pct(st)} %.` : 'Ответов пока нет.'}${un ? '' : ` Закрыто: откроется, когда в «${esc(TOPICS[i - 1].name)}» точность за последние ответы будет 80 % и выше.`}</p>
    <button class="btn primary wide" style="margin-top:16px" data-act="${un ? 'train-topic' : 'unlock'}" data-id="${id}">${un ? 'Тренировать' : 'Открыть вручную'}</button>
  </div></div>`;
}
const closeSheet = () => { $('#sheet').innerHTML = ''; };
function meter(name, r) { const p = pct(r); return `<div class="meter"><span class="nm">${esc(name)}</span><span class="pc">${p == null ? '—' : p + ' %'}</span><span class="ln" style="--p:${p || 0}"><i></i></span></div>`; }
function viewStats() {
  const st = S.stats, days = [];
  for (let i = 29; i >= 0; i--) { const d = addDays(today(), -i); days.push({ d, r: st.days[d] || { c: 0, t: 0 } }); }
  const max = Math.max(1, ...days.map(x => x.r.t)), sum30 = days.reduce((a, x) => a + x.r.t, 0);
  const fmt = d => { const p = d.split('-'); return +p[2] + '.' + p[1]; };
  const errs = Object.values(S.errs).sort((a, b) => a.due < b.due ? -1 : 1);
  const s = streak(), acc = pct(st.total);
  return `<section class="view"><h1>Статистика</h1><p class="sub">Хранится только в этом браузере.</p>
  <div class="hero">
    <div class="glass stat"><b>${st.total.t}</b><span>всего ответов</span></div>
    <div class="glass stat"><b>${acc == null ? '—' : acc + ' %'}</b><span>точность</span></div>
    <div class="glass stat"><b>${s}</b><span>${plural(s, 'день', 'дня', 'дней')} подряд</span></div>
  </div>
  <div class="glass card"><h2>30 дней</h2><p class="muted small" style="margin:0">Ответов за период: ${sum30}</p>
    <div class="bars" role="img" aria-label="Ответы по дням за 30 дней">${days.map(x => { const h = x.r.t / max * 100, w = x.r.t ? (x.r.t - x.r.c) / x.r.t * h : 0; return `<div class="d${x.r.t ? '' : ' z'}" title="${fmt(x.d)}: ${x.r.c} из ${x.r.t}">${x.r.t ? `<i class="w" style="height:${w}%"></i><i style="height:${h - w}%"></i>` : ''}</div>`; }).join('')}</div>
    <div class="axis"><span>${fmt(days[0].d)}</span><span>${fmt(days[15].d)}</span><span>сегодня</span></div>
    <div class="legend"><span><i style="background:var(--mint-s)"></i>верно</span><span><i style="background:var(--coral-s)"></i>неверно</span></div>
  </div>
  <div class="glass card"><h2>По уровням</h2>${LV.map(l => meter(l, st.level[l])).join('')}</div>
  <div class="glass card"><h2>По заданиям</h2>${MODES.map(m => meter(m.name, st.mode[m.id])).join('')}</div>
  <div class="glass card"><h2>По временам</h2>${TOPICS.map(t => meter(t.name, st.topic[t.id])).join('')}</div>
  <div class="glass card"><h2>Мои ошибки</h2>
    ${errs.length ? `<p class="muted small" style="margin:0 0 6px">В списке: ${errs.length}. К повторению сегодня: ${dueErrs().length}.</p>` + errs.slice(0, 40).map(e => {
      const txt = e.mode === 'words' ? esc(e.it.en[0]) + ' — ' + esc(e.it.ru[0]) : (() => { const it = unpackItem(e.it); return it ? sentenceHTML(it) : ''; })();
      const when = e.due <= today() ? 'пора повторить' : 'повтор ' + fmt(e.due);
      return `<div class="err">${txt}<small>${e.mode === 'words' ? 'Полезные слова' : esc(T[e.it.t].name)} · ${MODE[e.mode].name} · ${when}</small></div>`;
    }).join('') + (errs.length > 40 ? `<p class="muted small">…и ещё ${errs.length - 40}</p>` : '') + `<button class="btn wide" style="margin-top:12px" data-act="errors">Повторить ошибки</button>` : '<p class="muted small" style="margin:0">Пока пусто.</p>'}
  </div></section>`;
}
function viewSettings() {
  const st = S.settings, key = getKey();
  return `<section class="view"><h1>Настройки</h1><p class="sub">Версия ${APP_VERSION}</p>
  <div class="glass card"><h2>Оформление</h2>
    <div class="seg" style="margin-top:12px" role="group" aria-label="Тема">${[['auto', 'Как в системе'], ['light', 'Светлая'], ['dark', 'Тёмная']].map(([v, n]) => `<button data-theme-set="${v}" aria-pressed="${st.theme === v}">${n}</button>`).join('')}</div>
  </div>
  <div class="glass card"><h2>Gemini</h2>
    <p class="muted small" style="margin:0 0 14px">Нужен для новых заданий и проверки переводов. Ключ бесплатный, выдаётся в Google AI Studio. Он хранится только в этом браузере и отправляется только на generativelanguage.googleapis.com.</p>
    <label class="lbl" for="key">Ключ API</label>
    <input id="key" class="field" type="password" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="${key ? 'Ключ сохранён — вставь новый, чтобы заменить' : 'Вставь ключ'}">
    <p class="small" id="key-state" style="margin:8px 4px 0"><span class="dot ${key ? 'on' : ''}" style="display:inline-block;margin-right:6px"></span>${key ? 'Ключ сохранён (оканчивается на ' + esc(key.slice(-4)) + ').' : 'Ключ не задан — работает встроенный запас.'}</p>
    <div class="row wrap" style="margin-top:12px"><button class="btn sm primary" data-act="key-save">Сохранить</button><button class="btn sm" data-act="key-test">Проверить ключ</button><button class="btn sm danger" data-act="key-del" ${key ? '' : 'disabled'}>Удалить ключ</button></div>
    <label class="lbl" for="model" style="margin-top:18px">Модель</label>
    <input id="model" class="field" ${INPUT_ATTRS} value="${esc(st.model)}" placeholder="${DEFAULT_MODEL}">
    <p class="muted small" style="margin:8px 4px 0">По умолчанию ${DEFAULT_MODEL}. Если она перестанет работать, впиши другую бесплатную Flash-модель, например gemini-flash-latest.</p>
    <label class="sw" style="margin-top:12px"><input type="checkbox" data-set="useGen" ${st.useGen ? 'checked' : ''}><i></i><span>Новые задания от Gemini</span></label>
  </div>
  <div class="glass card"><h2>Озвучка</h2>
    ${TTS ? `<label class="sw" style="margin-top:6px"><input type="checkbox" data-set="autoSpeak" ${st.autoSpeak ? 'checked' : ''}><i></i><span>Озвучивать правильный ответ</span></label>
    <label class="lbl" for="voice-sel" style="margin-top:12px">Голос</label>
    <select id="voice-sel" class="field"></select>
    <label class="lbl" style="margin-top:16px">Скорость</label>
    <div class="seg" role="group" aria-label="Скорость">${[0.7, 0.85, 1].map(r => `<button data-rate="${r}" aria-pressed="${+st.rate === r}">${r === 1 ? '1.0' : r}</button>`).join('')}</div>
    <button class="btn sm" style="margin-top:14px" data-say="The weather is lovely today, isn't it?">Проверить голос</button>` : '<p class="muted small">Этот браузер не умеет озвучивать текст, поэтому режим «На слух» отключён.</p>'}
  </div>
  <div class="glass card"><h2>Прогресс</h2>
    <p class="muted small" style="margin:0 0 14px">Экспорт сохраняет статистику, ошибки и настройки в файл. Ключ Gemini в файл не попадает.</p>
    <div class="row wrap"><button class="btn sm" data-act="export">Экспорт в JSON</button><button class="btn sm" data-act="import">Импорт из JSON</button><button class="btn sm danger" data-act="reset">Сбросить прогресс</button></div>
    <input type="file" id="imp" accept="application/json,.json" hidden>
  </div>
  <div class="glass card"><h2>О тренажёре</h2>
    <p class="muted small" style="margin:0">Встроено заданий: ${Object.values(BY_ID).filter(i => i.src === 'stock').length}, от Gemini в кэше: ${GEN.length}, слов и фраз: ${LV.reduce((a, l) => a + WORDLIST[l].length, 0)}. После первого открытия работает без интернета.</p>
  </div></section>`;
}
function fillVoices() {
  const sel = $('#voice-sel'); if (!sel) return;
  const curV = pickVoice();
  sel.innerHTML = VOICES.length ? VOICES.map((v, i) => `<option value="${esc(v.voiceURI)}" ${curV && v.voiceURI === curV.voiceURI ? 'selected' : ''}>${esc(v.name)} · ${esc(v.lang)}${i === 0 ? ' — лучший' : ''}</option>`).join('') : '<option value="">Английские голоса не найдены</option>';
}

/* ---------- тема, окна, всплывашки ---------- */
function applyTheme() {
  const m = S.settings.theme, dark = m === 'dark' || (m !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const mt = $('meta[name=theme-color]'); if (mt) mt.content = dark ? '#110f1c' : '#efeafc';
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
function toast(msg, opts = {}) {
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg;
  if (opts.action) { const b = document.createElement('button'); b.className = 'btn sm primary wide'; b.textContent = opts.action; b.onclick = opts.onAction; el.appendChild(b); }
  $('#toast').appendChild(el);
  if (!opts.sticky) setTimeout(() => { el.classList.add('bye'); setTimeout(() => el.remove(), 400); }, opts.ms || 4200);
}
function confirmBox(title, text, okLabel, danger) {
  return new Promise(res => {
    const d = $('#dialog');
    d.innerHTML = `<div class="dlg-wrap"><div class="dlg" role="alertdialog" aria-label="${esc(title)}"><h2>${esc(title)}</h2><div class="muted">${esc(text)}</div>
      <div class="row"><button class="btn" data-no>Отмена</button><button class="btn ${danger ? 'danger' : 'primary'}" data-yes>${esc(okLabel)}</button></div></div></div>`;
    const done = v => { d.innerHTML = ''; res(v); };
    $('[data-yes]', d).onclick = () => done(true); $('[data-no]', d).onclick = () => done(false);
    $('.dlg-wrap', d).onclick = e => { if (e.target.classList.contains('dlg-wrap')) done(false); };
    $('[data-no]', d).focus();
  });
}
function updateVV() {
  const v = window.visualViewport, r = document.documentElement;
  const h = v ? v.height : window.innerHeight, top = v ? v.offsetTop : 0;
  r.style.setProperty('--vvh', h + 'px'); r.style.setProperty('--vvt', top + 'px');
  r.classList.toggle('kb', !!v && window.innerHeight - v.height > 120);
}
if (window.visualViewport) { visualViewport.addEventListener('resize', updateVV); visualViewport.addEventListener('scroll', updateVV); }
window.addEventListener('resize', updateVV); updateVV();

/* ---------- настройки: действия ---------- */
async function testKey() {
  const typed = ($('#key') && $('#key').value.trim()) || '';
  if (typed) saveKey(true);
  if (!getKey()) return toast(ERR.nokey);
  const model = (S.settings.model || DEFAULT_MODEL).trim().replace(/^models\//, '');
  toast('Проверяю ключ…', { ms: 1500 });
  try {
    await gemFetch('/v1beta/models/' + encodeURIComponent(model), { method: 'GET' }, 15000);
    toast('Ключ работает, модель ' + model + ' доступна.');
  } catch (e) { toast(errText(e)); }
}
function saveKey(quiet) {
  const el = $('#key'), v = el ? el.value.trim() : '';
  if (!v) { if (!quiet) toast('Сначала вставь ключ в поле.'); return; }
  if (/\s/.test(v) || v.length < 20) { toast('Это не похоже на ключ Gemini.'); return; }
  lsSet(LS_KEY, v); genPause = 0;
  if (!quiet) toast('Ключ сохранён в этом браузере.');
  render();
}
async function exportData() {
  const blob = new Blob([JSON.stringify({ app: 'english-grammar-trainer', v: 1, exported: new Date().toISOString(), data: S }, null, 1)], { type: 'application/json' });
  const name = 'grammar-progress-' + today() + '.json';
  try {
    const file = new File([blob], name, { type: 'application/json' });
    if (isIOS && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  toast('Файл ' + name + ' сохранён.');
}
function importData(file) {
  const fr = new FileReader();
  fr.onload = async () => {
    let o; try { o = JSON.parse(fr.result); } catch (e) { return toast('Это не JSON-файл прогресса.'); }
    const data = o && o.app === 'english-grammar-trainer' ? o.data : null;
    if (!data || data.v !== 1 || !data.stats) return toast('Файл не подходит: это не экспорт этого тренажёра.');
    if (!await confirmBox('Заменить прогресс?', 'Текущая статистика и список ошибок будут заменены данными из файла.', 'Заменить')) return;
    S = normState(data); save(); applyTheme(); render(); toast('Прогресс загружен.');
  };
  fr.readAsText(file);
}

/* ---------- события ---------- */
document.addEventListener('click', async e => {
  const say = e.target.closest('[data-say]');
  if (say) { if (!speak(say.dataset.say, !!say.dataset.slow, false, say)) toast('Озвучка недоступна в этом браузере.'); if (SES && TYPED[cur() && cur().mode] && $('#ans')) $('#ans').focus({ preventScroll: true }); return; }
  const tab = e.target.closest('.tab'); if (tab) { TAB = tab.dataset.tab; render(); window.scrollTo(0, 0); return; }
  const opt = e.target.closest('[data-opt]'); if (opt) { if (SES) choose(+opt.dataset.opt); return; }
  const el = e.target.closest('[data-act],[data-level],[data-mode],[data-topic],[data-rand],[data-sheet],[data-theme-set],[data-rate]');
  if (!el) return;
  const d = el.dataset;
  if (d.level) { S.last.level = d.level; save(); return render(); }
  if (d.mode) { S.last.mode = d.mode; save(); return render(); }
  if (d.topic) {
    if (!isUnlocked(d.topic)) {
      const i = TOPICS.findIndex(t => t.id === d.topic);
      if (!await confirmBox('Открыть вручную?', `«${T[d.topic].name}» откроется само, когда в «${TOPICS[i - 1].name}» точность будет 80 % и выше. Открыть сейчас?`, 'Открыть')) return;
      S.unlocked[d.topic] = true;
    }
    const a = S.last.topics, j = a.indexOf(d.topic); if (j >= 0) a.splice(j, 1); else a.push(d.topic);
    save(); return render();
  }
  if (d.rand) return begin({ kind: 'rand', level: d.rand });
  if (d.sheet) return openSheet(d.sheet);
  if (d.themeSet) { S.settings.theme = d.themeSet; save(); applyTheme(); return render(); }
  if (d.rate) { S.settings.rate = +d.rate; save(); render(); return speak('This is the new speed.'); }
  switch (d.act) {
    case 'start-topic': {
      const L = S.last;
      if (L.mode === 'listen' && !TTS) return toast('Этот браузер не умеет озвучивать текст.');
      return begin({ kind: 'topic', level: L.level, mode: L.mode, topics: L.topics.slice() });
    }
    case 'full': return begin({ kind: 'full' });
    case 'errors': return begin({ kind: 'errors' });
    case 'again': return begin(SES.cfg);
    case 'next': return next();
    case 'override': return overrideLast();
    case 'skip-gen': return SES && SES.skip && SES.skip();
    case 'ses-close': return closeSession();
    case 'sheet-close': if (e.target === el || el.classList.contains('iconbtn')) closeSheet(); return;
    case 'unlock': S.unlocked[d.id] = true; save(); render(); return openSheet(d.id);
    case 'train-topic': {
      const t = T[d.id]; closeSheet();
      const lv = lvIdx(S.last.level) >= lvIdx(t.lv) ? S.last.level : t.lv;
      const mode = S.last.mode === 'words' || (S.last.mode === 'listen' && !TTS) ? 'gap' : S.last.mode;
      S.last = { level: lv, topics: [d.id], mode }; save();
      return begin({ kind: 'topic', level: lv, mode, topics: [d.id] });
    }
    case 'hide-install': S.hideInstall = true; save(); return render();
    case 'install': if (deferredInstall) { deferredInstall.prompt(); try { await deferredInstall.userChoice; } catch (er) { } deferredInstall = null; render(); } return;
    case 'key-save': return saveKey();
    case 'key-test': return testKey();
    case 'key-del':
      if (await confirmBox('Удалить ключ?', 'Ключ Gemini будет стёрт из этого браузера. Тренажёр продолжит работать на встроенном запасе.', 'Удалить', true)) { lsDel(LS_KEY); toast('Ключ удалён.'); render(); }
      return;
    case 'export': return exportData();
    case 'import': return $('#imp').click();
    case 'reset':
      if (await confirmBox('Сбросить прогресс?', 'Статистика, серия дней, открытые времена и список ошибок будут стёрты. Настройки и ключ останутся. Отменить это нельзя.', 'Сбросить', true)) {
        const keep = S.settings; S = DEF(); S.settings = keep; save(); render(); toast('Прогресс сброшен.');
      }
      return;
  }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'imp' && t.files[0]) { importData(t.files[0]); t.value = ''; }
  if (t.id === 'voice-sel') { S.settings.voice = t.value; save(); speak('Hello! This is my voice.'); }
  if (t.id === 'model') { S.settings.model = t.value.trim() || DEFAULT_MODEL; S.settings.apiForm = 0; save(); }
  if (t.dataset && t.dataset.set) { S.settings[t.dataset.set] = t.checked; save(); }
});
document.addEventListener('submit', e => {
  if (e.target.id !== 'ansf') return;
  e.preventDefault();
  if (!SES) return;
  if (SES.st === 'ask') submitAnswer($('#ans').value); else if (SES.st === 'fb') next();
});
document.addEventListener('beforeinput', e => { if (e.target.id === 'ans' && e.target.dataset.lock) e.preventDefault(); });
document.addEventListener('mousedown', e => { if (SES && e.target.closest('#ses-foot .btn, #fb .btn, #fb .spk') && document.activeElement && document.activeElement.id === 'ans') e.preventDefault(); });
document.addEventListener('keydown', e => {
  if ($('#dialog').firstChild) { if (e.key === 'Escape') { const b = $('#dialog [data-no]'); if (b) b.click(); } return; }
  if ($('#sheet').firstChild && e.key === 'Escape') return closeSheet();
  if (!SES) return;
  const inInput = e.target.matches && e.target.matches('input,textarea,select');
  if (e.key === 'Escape') return closeSession();
  if (e.key === 'Enter') {
    if (e.repeat) return e.preventDefault();
    if (inInput && e.target.id === 'ans') return;           // обработает отправка формы
    e.preventDefault();
    if (SES.st === 'fb' || SES.st === 'sum') next();
    return;
  }
  if (!inInput && SES.st === 'ask' && /^[1-4]$/.test(e.key)) {
    const task = cur(), i = +e.key - 1;
    if ((task.mode === 'tf' && i < 2) || (task.mode === 'tense' && i < task.options.length)) { e.preventDefault(); choose(i); }
  }
});
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; if (TAB === 'train' && !SES) render(); });
window.addEventListener('appinstalled', () => { deferredInstall = null; S.hideInstall = true; save(); if (!SES) render(); });
window.addEventListener('online', () => { if (TAB === 'train' && !SES) render(); });

/* ---------- запуск ---------- */
applyTheme();
render();
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  const had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').catch(() => { });
  let told = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!had || told) return; told = true;
    toast('Тренажёр обновился.', { sticky: true, action: 'Перезапустить', onAction: () => location.reload() });
  });
}
