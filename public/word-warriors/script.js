/* ══════════════════════════════════════════════════════════════
   PUNJABI WORD WARRIORS — vanilla JS game engine
   No backend, no frameworks. Everything runs locally.
   ══════════════════════════════════════════════════════════════ */
'use strict';

/* ── Gurmukhi helpers ─────────────────────────────────────── */
const MATRA_INFO = {
  'ਾ': { id:'kanna',    pa:'ਕੰਨਾ',     en:'Kanna' },
  'ਿ': { id:'sihari',   pa:'ਸਿਹਾਰੀ',   en:'Sihari' },
  'ੀ': { id:'bihari',   pa:'ਬਿਹਾਰੀ',   en:'Bihari' },
  'ੁ': { id:'aunkar',   pa:'ਔਂਕੜ',     en:'Aunkar' },
  'ੂ': { id:'dulankar', pa:'ਦੁਲੈਂਕੜ',   en:'Dulankar' },
  'ੇ': { id:'laavan',   pa:'ਲਾਵਾਂ',    en:'Laavan' },
  'ੈ': { id:'dolaavan', pa:'ਦੁਲਾਵਾਂ',   en:'Dolaavan' },
  'ੋ': { id:'hora',     pa:'ਹੋੜਾ',     en:'Hora' },
  'ੌ': { id:'kanora',   pa:'ਕਨੌੜਾ',    en:'Kanora' }
};
const MATRA_SIGNS = Object.keys(MATRA_INFO);
const ADDHAK = 'ੱ', NUKTA = '਼', VIRAMA = '੍', BINDI = 'ਂ', TIPPI = 'ੰ';

/** Split a Gurmukhi word into akshar units (vowel signs stay on their consonant). */
function splitAkshar(word){
  const chars = Array.from(String(word || '').trim());
  const units = [];
  let cur = '';
  for (const ch of chars){
    if (ch === ADDHAK){                    // addak starts the akshar it doubles
      if (cur) units.push(cur);
      cur = ADDHAK;
      continue;
    }
    if (ch === VIRAMA || ch === NUKTA || ch === BINDI || ch === TIPPI || MATRA_SIGNS.includes(ch)){
      cur += ch;                           // joins the current akshar
      continue;
    }
    if (ch === ' ' || ch === '\u200d' || ch === '\u200c'){ continue; }
    if (!cur){ cur = ch; continue; }
    if (cur.endsWith(VIRAMA)){ cur += ch; continue; }  // conjunct
    units.push(cur);
    cur = ch;
  }
  if (cur) units.push(cur);
  return units;
}

/* Roman (Latin) transliteration, used for the second-attempt hint. */
const ROMAN_VOWELS = { 'ਅ':'a','ਆ':'aa','ਇ':'i','ਈ':'ee','ਉ':'u','ਊ':'oo','ਏ':'e','ਐ':'ai','ਓ':'o','ਔ':'au' };
const ROMAN_MATRAS = { 'ਾ':'aa','ਿ':'i','ੀ':'ee','ੁ':'u','ੂ':'oo','ੇ':'e','ੈ':'ai','ੋ':'o','ੌ':'au' };
const ROMAN_CONSONANTS = {
  'ਕ':'k','ਖ':'kh','ਗ':'g','ਘ':'gh','ਙ':'ng',
  'ਚ':'ch','ਛ':'chh','ਜ':'j','ਝ':'jh','ਞ':'n',
  'ਟ':'t','ਠ':'th','ਡ':'d','ਢ':'dh','ਣ':'n',
  'ਤ':'t','ਥ':'th','ਦ':'d','ਧ':'dh','ਨ':'n',
  'ਪ':'p','ਫ':'ph','ਬ':'b','ਭ':'bh','ਮ':'m',
  'ਯ':'y','ਰ':'r','ਲ':'l','ਵ':'v','ੜ':'r','ਸ':'s',
  'ਸ਼':'sh','ਖ਼':'kh','ਗ਼':'g','ਜ਼':'z','ਫ਼':'f','ਲ਼':'l'
};
/* Consonant + nukta written as two code points. */
const ROMAN_NUKTA = { 'ਸ':'sh','ਖ':'kh','ਗ':'g','ਜ':'z','ਫ':'f','ਲ':'l' };
function romanize(word){
  const chars = Array.from(String(word || ''));
  let out = '';
  for (let i = 0; i < chars.length; i++){
    const ch = chars[i];
    if (ROMAN_MATRAS[ch] !== undefined){ out += ROMAN_MATRAS[ch]; continue; }
    if (ROMAN_VOWELS[ch] !== undefined){ out += ROMAN_VOWELS[ch]; continue; }
    if (ch === VIRAMA || ch === NUKTA || ch === ADDHAK || ch === BINDI || ch === TIPPI){ continue; }
    if (ROMAN_CONSONANTS[ch] !== undefined){
      const hasNukta = chars[i + 1] === NUKTA;
      out += hasNukta ? (ROMAN_NUKTA[ch] || ROMAN_CONSONANTS[ch]) : ROMAN_CONSONANTS[ch];
      if (hasNukta) i += 1;
      const next = chars[i + 1];
      const wordEnd = i === chars.length - 1;
      if (!wordEnd && !(next && (ROMAN_MATRAS[next] !== undefined || next === VIRAMA)) ) out += 'a';
      continue;
    }
    out += ch;
  }
  return out;
}

/** Count the vowel signs used in a word. */
function matraCounts(word){
  const counts = {};
  for (const ch of Array.from(String(word))){
    if (MATRA_INFO[ch]) counts[ch] = (counts[ch] || 0) + 1;
  }
  return counts;
}

/** A word belongs to a category when its matra appears and is at least as common as any other. */
function matchesCategory(word, categoryId){
  const counts = matraCounts(word);
  const signs = Object.keys(counts);
  if (categoryId === 'mukta') return signs.length === 0;
  if (categoryId === 'super') return true;
  const sign = MATRA_SIGNS.find(s => MATRA_INFO[s].id === categoryId);
  if (!sign || !counts[sign]) return false;
  const top = Math.max(...signs.map(s => counts[s]));
  return counts[sign] >= top;
}

const CATEGORIES = [
  { id:'mukta',    pa:'ਮੁਕਤਾ',          en:'Mukta',     glyph:'ਕ',    note:'no vowel sign' },
  { id:'kanna',    pa:'ਕੰਨਾ',           en:'Kanna',     glyph:'ਕਾ',   note:'ਾ' },
  { id:'sihari',   pa:'ਸਿਹਾਰੀ',         en:'Sihari',    glyph:'ਕਿ',   note:'ਿ' },
  { id:'bihari',   pa:'ਬਿਹਾਰੀ',         en:'Bihari',    glyph:'ਕੀ',   note:'ੀ' },
  { id:'aunkar',   pa:'ਔਂਕੜ',           en:'Aunkar',    glyph:'ਕੁ',   note:'ੁ' },
  { id:'dulankar', pa:'ਦੁਲੈਂਕੜ',         en:'Dulankar',  glyph:'ਕੂ',   note:'ੂ' },
  { id:'laavan',   pa:'ਲਾਵਾਂ',          en:'Laavan',    glyph:'ਕੇ',   note:'ੇ' },
  { id:'dolaavan', pa:'ਦੁਲਾਵਾਂ',         en:'Dolaavan',  glyph:'ਕੈ',   note:'ੈ' },
  { id:'hora',     pa:'ਹੋੜਾ',           en:'Hora',      glyph:'ਕੋ',   note:'ੋ' },
  { id:'kanora',   pa:'ਕਨੌੜਾ',          en:'Kanora',    glyph:'ਕੌ',   note:'ੌ' },
  { id:'super',    pa:'ਸੁਪਰ ਟੈਸਟ',       en:'All Signs', glyph:'ਕੌ',   note:'all 10 matras' }
];
const catById = id => CATEGORIES.find(c => c.id === id) || CATEGORIES[0];

/* ── storage ──────────────────────────────────────────────── */
const LS_BANKS = 'pww.banks.v1';
const LS_SETTINGS = 'pww.settings.v1';
const LS_PLAYERS = 'pww.players.v1';

function loadJSON(key, fallback){
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
}
function saveJSON(key, value){
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

/* ── word bank (WORDS comes from words.js) ────────────────── */
const BASE_BANK = (typeof WORD_BANK === 'object' && WORD_BANK) ? WORD_BANK : {};
let customBank = loadJSON(LS_BANKS, {});
const bankCache = new Map();

function baseWords(catId){
  if (catId === 'super'){
    return CATEGORIES.filter(c => c.id !== 'super').flatMap(c => baseWords(c.id));
  }
  return Array.isArray(BASE_BANK[catId]) ? BASE_BANK[catId].slice() : [];
}

function uniqueWords(list){
  const seen = new Set(); const out = [];
  for (const raw of list){
    const word = String(raw || '').trim();
    if (!word || seen.has(word)) continue;
    if (Array.from(word).length < 3) continue;   // at least 3 Gurmukhi letters
    if (splitAkshar(word).length < 2) continue;
    if (/[ੰਃੱ੍]/.test(word)) continue;           // no bindi, tippi, addak or conjuncts
    seen.add(word); out.push(word);
  }
  return out;
}

/** Every valid word for a category, with its akshar units. */
function bankWords(catId, includeCustom = true){
  const cacheKey = catId + (includeCustom ? ':custom' : ':base');
  if (bankCache.has(cacheKey)) return bankCache.get(cacheKey);
  const removed = includeCustom && Array.isArray(customBank[catId + ':removed']) ? customBank[catId + ':removed'] : [];
  let words = baseWords(catId);
  if (removed.length) words = words.filter(w => !removed.includes(w));
  words = uniqueWords(words);
  const items = words.map(word => ({ word, letters: splitAkshar(word) }))
    .filter(item => catId === 'super' || matchesCategory(item.word, catId));

  // Teacher additions always stay in the category they were added to, even
  // when they use bindi, tippi, addak or a vowel sign the built-in list avoids.
  if (includeCustom){
    const seen = new Set(items.map(i => i.word));
    const extras = Array.isArray(customBank[catId]) ? customBank[catId] : [];
    for (const raw of extras){
      const word = String(raw || '').trim();
      if (!word || seen.has(word) || removed.includes(word)) continue;
      const letters = splitAkshar(word);
      if (!letters.length) continue;
      seen.add(word);
      items.push({ word, letters, custom: true });
    }
  }
  bankCache.set(cacheKey, items);
  return items;
}

const avatarPool = ['🦁','🐯','🐼','🦊','🐸','🦄','🐵','🦉','🐨','🐷','🦖','🐙','🦋','🐲'];

/* ── audio (synthesised, no files) ────────────────────────── */
const Sound = (() => {
  let ctx = null;
  const enabled = () => state.settings.sound;
  function ac(){
    if (!ctx){
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  function tone(freq, start, dur, type, gain){
    const c = ac(); if (!c) return;
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, c.currentTime + start);
    g.gain.setValueAtTime(0.0001, c.currentTime + start);
    g.gain.exponentialRampToValueAtTime(gain || 0.16, c.currentTime + start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
    osc.connect(g); g.connect(c.destination);
    osc.start(c.currentTime + start); osc.stop(c.currentTime + start + dur + 0.03);
  }
  return {
    unlock(){ ac(); },
    tap(){ if (enabled()) tone(520, 0, 0.07, 'triangle', 0.07); },
    remove(){ if (enabled()) tone(320, 0, 0.08, 'triangle', 0.07); },
    correct(){ if (!enabled()) return; [523.25, 659.25, 783.99, 1046.5].forEach((f,i) => tone(f, i*0.085, 0.24, 'sine', 0.13)); },
    wrong(){ if (!enabled()) return; tone(196, 0, 0.18, 'sawtooth', 0.09); tone(146.8, 0.16, 0.28, 'sawtooth', 0.09); },
    turn(){ if (enabled()) tone(660, 0, 0.12, 'triangle', 0.06); },
    win(){
      if (!enabled()) return;
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98];
      notes.forEach((f,i) => tone(f, i*0.14, 0.4, 'triangle', 0.12));
      [261.63, 329.63, 392].forEach((f,i) => tone(f, 0.9 + i*0.02, 0.9, 'sine', 0.08));
    }
  };
})();

/* ── tiny helpers ─────────────────────────────────────────── */
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const shuffle = arr => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const escapeHTML = str => String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let toastTimer = 0;
function toast(msg){
  const el = $('#toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

/* ── state ────────────────────────────────────────────────── */
const defaults = { sound:true, timer:false, seconds:30, rounds:10, difficulty:'medium' };
const state = {
  settings: Object.assign({}, defaults, loadJSON(LS_SETTINGS, {})),
  players: [],
  categoryId: 'kanna',
  round: 1,
  turnIndex: 0,
  totalTurns: 0,
  turnNo: 0,
  current: null,
  selection: [],
  attempt: 1,
  used: new Set(),
  revealed: false,
  locked: false,
  secondsLeft: 0,
  timerId: 0,
  screen: 'screenHome'
};

function saveSettings(){ saveJSON(LS_SETTINGS, state.settings); }

/* ── screens ──────────────────────────────────────────────── */
function showScreen(id){
  $$('.screen').forEach(s => s.classList.toggle('active', s.id === id));
  state.screen = id;
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  if (id !== 'screenGame') stopTimer();
}
$$('[data-back]').forEach(btn => btn.addEventListener('click', () => showScreen(btn.dataset.back)));

/* ══════════════════════════════════════════════════════════════
   PLAYER SETUP
   ══════════════════════════════════════════════════════════════ */
let playerDraft = loadJSON(LS_PLAYERS, null) || {
  count: 2,
  players: [
    { name:'Warrior 1', avatar:'🦁' },
    { name:'Warrior 2', avatar:'🐯' }
  ]
};
if (!Array.isArray(playerDraft.players) || playerDraft.players.length < 2){
  playerDraft = { count:2, players:[{name:'Warrior 1',avatar:'🦁'},{name:'Warrior 2',avatar:'🐯'}] };
}
playerDraft.count = Math.min(8, Math.max(2, Number(playerDraft.count) || playerDraft.players.length || 2));
while (playerDraft.players.length < playerDraft.count){
  playerDraft.players.push({ name:`Warrior ${playerDraft.players.length + 1}`, avatar:avatarPool[playerDraft.players.length % avatarPool.length] });
}

function renderPlayerSetup(){
  const pills = $('#playerCount');
  pills.innerHTML = '';
  for (let n = 2; n <= 8; n++){
    const b = document.createElement('button');
    b.className = 'count-pill' + (n === playerDraft.count ? ' selected' : '');
    b.textContent = n;
    b.addEventListener('click', () => {
      playerDraft.count = n;
      while (playerDraft.players.length < n){
        playerDraft.players.push({ name:`Warrior ${playerDraft.players.length + 1}`, avatar:avatarPool[playerDraft.players.length % avatarPool.length] });
      }
      renderPlayerSetup();
    });
    pills.appendChild(b);
  }

  const fields = $('#playerFields');
  fields.innerHTML = '';
  for (let i = 0; i < playerDraft.count; i++){
    const p = playerDraft.players[i];
    const card = document.createElement('div');
    card.className = 'player-card';
    card.innerHTML = `
      <div class="pc-top">
        <button class="avatar-pick" type="button" title="Change avatar">${p.avatar}</button>
        <div><small>PLAYER ${i + 1}</small><input class="input" maxlength="14" value="${escapeHTML(p.name)}" aria-label="Player ${i + 1} name" /></div>
      </div>`;
    const input = card.querySelector('input');
    input.addEventListener('input', () => { playerDraft.players[i].name = input.value; });
    const av = card.querySelector('.avatar-pick');
    av.addEventListener('click', () => {
      const taken = playerDraft.players.slice(0, playerDraft.count).map(x => x.avatar);
      const options = avatarPool.filter(a => a === p.avatar || !taken.includes(a));
      const next = options[(options.indexOf(p.avatar) + 1) % options.length] || avatarPool[0];
      p.avatar = next; av.textContent = next; Sound.tap();
    });
    fields.appendChild(card);
  }

  $('#setRounds').value = String(state.settings.rounds);
  $('#setDiff').value = state.settings.difficulty;
  $('#setSeconds').value = String(state.settings.seconds);
  syncToggles();
}

function syncToggles(){
  const pairs = [['#setSound','sound'],['#setSound2','sound'],['#setTimer','timer'],['#setTimer2','timer']];
  pairs.forEach(([sel, key]) => {
    const btn = $(sel); if (!btn) return;
    const on = Boolean(state.settings[key]);
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', String(on));
    const label = btn.querySelector('b');
    if (label) label.textContent = on ? 'ON' : 'OFF';
  });
  const secField = $('#timerSecondsField');
  if (secField) secField.style.display = state.settings.timer ? '' : 'none';
}

function toggleSetting(key){
  state.settings[key] = !state.settings[key];
  saveSettings(); syncToggles(); Sound.unlock();
  if (key === 'sound' && state.settings.sound) Sound.tap();
}
['#setSound','#setSound2'].forEach(s => $(s).addEventListener('click', () => toggleSetting('sound')));
['#setTimer','#setTimer2'].forEach(s => $(s).addEventListener('click', () => toggleSetting('timer')));

$('#setRounds').addEventListener('change', e => { state.settings.rounds = Number(e.target.value); saveSettings(); });
$('#setDiff').addEventListener('change', e => { state.settings.difficulty = e.target.value; saveSettings(); });
$('#setSeconds').addEventListener('change', e => { state.settings.seconds = Number(e.target.value); saveSettings(); });

$('#toCategories').addEventListener('click', () => {
  const names = playerDraft.players.slice(0, playerDraft.count).map((p, i) => (p.name || '').trim() || `Warrior ${i + 1}`);
  if (names.some(n => n.length > 14)){ toast('Names can be 14 characters at most.'); return; }
  playerDraft.players = playerDraft.players.slice(0, playerDraft.count).map((p, i) => ({ name:names[i], avatar:p.avatar }));
  saveJSON(LS_PLAYERS, playerDraft);
  state.players = playerDraft.players.map(p => ({ name:p.name, avatar:p.avatar, score:0, correct:0 }));
  renderCategories();
  showScreen('screenCategories');
});

/* ══════════════════════════════════════════════════════════════
   CATEGORY SCREEN
   ══════════════════════════════════════════════════════════════ */
function renderCategories(){
  const grid = $('#catGrid');
  grid.innerHTML = '';
  CATEGORIES.forEach(cat => {
    const count = bankWords(cat.id).length;
    const b = document.createElement('button');
    b.className = 'cat-card' + (cat.id === 'super' ? ' super' : '');
    b.innerHTML = `
      <span class="cat-count">${count} words</span>
      <span class="cat-glyph" lang="pa">${cat.glyph}</span>
      <b>${cat.en}</b>
      <small>${cat.note}</small>`;
    b.addEventListener('click', () => {
      Sound.tap();
      state.categoryId = cat.id;
      startGame();
    });
    grid.appendChild(b);
  });
}
$('#catBack').addEventListener('click', () => showScreen('screenPlayers'));

/* ══════════════════════════════════════════════════════════════
   GAME
   ══════════════════════════════════════════════════════════════ */
function poolFor(categoryId){
  const items = bankWords(categoryId);
  const diff = state.settings.difficulty;
  let filtered = items;
  if (diff === 'easy') filtered = items.filter(w => w.letters.length <= 3);
  else if (diff === 'medium') filtered = items.filter(w => w.letters.length === 3);
  else if (diff === 'hard') filtered = items.filter(w => w.letters.length === 3 || w.letters.length === 4);
  return filtered.length ? filtered : items;
}

function startGame(){
  state.players.forEach(p => { p.score = 0; p.correct = 0; });
  state.round = 1;
  state.turnIndex = 0;
  state.turnNo = 0;
  state.used = new Set();
  const perPlayer = state.settings.rounds > 0 ? state.settings.rounds : 0;
  state.totalTurns = perPlayer ? perPlayer * state.players.length : Infinity;
  state.locked = false;
  renderScoreboard();
  showScreen('screenGame');
  startTurn();
}

function renderScoreboard(){
  const board = $('#scoreboard');
  const sorted = state.players.slice().sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  board.innerHTML = '';
  sorted.forEach((p, i) => {
    const idx = state.players.indexOf(p);
    const row = document.createElement('div');
    row.className = 'sb-row' + (idx === state.turnIndex ? ' turn' : '');
    row.innerHTML = `
      <span class="sb-rank">${i + 1}</span>
      <span class="sb-avatar">${p.avatar}</span>
      <span class="sb-info"><b>${escapeHTML(p.name)}</b><small>${p.correct} correct</small></span>
      <span class="sb-score">${p.score}</span>`;
    board.appendChild(row);
  });
}

function startTurn(){
  if (state.turnNo >= state.totalTurns){ finishGame(); return; }
  const categoryId = state.categoryId;
  const pool = poolFor(categoryId);
  let available = pool.filter(w => !state.used.has(w.word));
  if (!available.length){
    // Unlimited mode ends when the words run out; fixed rounds keep going.
    if (state.settings.rounds === 0 || categoryId === 'super'){
      if (state.turnNo === 0) available = pool;
      else { finishGame(); return; }
    } else {
      state.used.clear();
      available = pool;
    }
  }
  const pick = available[Math.floor(Math.random() * available.length)];
  state.used.add(pick.word);

  state.current = { word: pick.word, letters: pick.letters.slice(), category: categoryId };
  state.selection = [];
  state.attempt = 1;
  state.locked = false;
  state.revealed = false;

  const player = state.players[state.turnIndex];
  $('#turnAvatar').textContent = player.avatar;
  $('#turnName').textContent = player.name;
  $('#turnBanner').innerHTML = `<span>${escapeHTML(player.name)}</span> · arrange the letters!`;
  $('#attemptBadge').textContent = 'ATTEMPT 1 · +2';
  $('#attemptBadge').classList.remove('final');
  $('#wordLen').textContent = `${pick.letters.length} letters`;
  $('#feedbackBar').textContent = '';
  $('#feedbackBar').className = 'feedback-bar';
  $('#resNext').textContent = state.turnIndex === state.players.length - 1 ? 'NEXT ROUND →' : 'NEXT WARRIOR →';
  const roundsLabel = state.settings.rounds > 0
    ? `ROUND ${state.round} / ${state.settings.rounds}`
    : `ROUND ${state.round} · UNLIMITED`;
  $('#roundLabel').textContent = roundsLabel;
  $('#catLabel').textContent = catById(categoryId).en;

  buildTiles();
  renderAnswer();
  renderScoreboard();
  resetTimer();
  Sound.turn();
}

function buildTiles(){
  const wrap = $('#tiles');
  wrap.innerHTML = '';
  const letters = state.current.letters;
  const order = shuffle(letters.map((text, i) => ({ id:i, text })));
  // avoid already-solved shuffle (when more than two distinct tiles exist)
  if (order.length > 2 && order.map(t => t.id).join() === letters.map((_, i) => i).join()){
    [order[0], order[order.length - 1]] = [order[order.length - 1], order[0]];
  }
  order.forEach(tile => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tile';
    b.dataset.id = String(tile.id);
    b.textContent = tile.text;
    b.lang = 'pa';
    b.draggable = true;
    b.addEventListener('click', () => pickTile(tile.id));
    b.addEventListener('dragstart', ev => {
      ev.dataTransfer.setData('text/plain', `tile:${tile.id}`);
      ev.dataTransfer.effectAllowed = 'move';
      b.classList.add('dragging');
    });
    b.addEventListener('dragend', () => b.classList.remove('dragging'));
    wrap.appendChild(b);
  });
}

function pickTile(id){
  if (state.locked || state.revealed) return;
  if (state.selection.some(s => s.id === id)) return;
  state.selection.push({ id, text: state.current.letters[id] });
  Sound.tap();
  renderAnswer(true);
}

function removeSlot(index){
  if (state.locked || state.revealed) return;
  if (index < 0 || index >= state.selection.length) return;
  state.selection.splice(index, 1);
  Sound.remove();
  renderAnswer();
}

function renderAnswer(pop){
  const slots = $('#answerSlots');
  const total = state.current ? state.current.letters.length : 0;
  slots.innerHTML = '';
  for (let i = 0; i < total; i++){
    const item = state.selection[i];
    const el = document.createElement('div');
    el.className = 'slot' + (item ? ' filled' : '') + (pop && i === state.selection.length - 1 ? ' pop' : '');
    el.textContent = item ? item.text : '';
    el.lang = 'pa';
    if (item){
      el.draggable = true;
      el.title = 'Tap to take this letter back';
      el.addEventListener('click', () => removeSlot(i));
      el.addEventListener('dragstart', ev => {
        ev.dataTransfer.setData('text/plain', `slot:${i}`);
        ev.dataTransfer.effectAllowed = 'move';
      });
      el.addEventListener('dragover', ev => ev.preventDefault());
      el.addEventListener('drop', ev => {
        ev.preventDefault();
        const data = ev.dataTransfer.getData('text/plain') || '';
        if (!data.startsWith('slot:')) return;
        const from = Number(data.slice(5));
        if (Number.isNaN(from) || from === i) return;
        const moved = state.selection.splice(from, 1)[0];
        state.selection.splice(i, 0, moved);
        Sound.tap(); renderAnswer();
      });
    } else {
      el.addEventListener('dragover', ev => ev.preventDefault());
      el.addEventListener('drop', ev => {
        ev.preventDefault();
        const data = ev.dataTransfer.getData('text/plain') || '';
        if (!data.startsWith('tile:')) return;
        pickTile(Number(data.slice(5)));
      });
    }
    slots.appendChild(el);
  }
  $('#answerHint').textContent = state.selection.length === 0
    ? 'Tap the letters below in the right order — or drag them here'
    : state.selection.length < total
      ? `${state.selection.length} of ${total} letters placed`
      : 'All letters placed — ready to submit!';
  const hint = $('#answerRoman');
  if (hint){
    const showHint = state.attempt === 2 && !state.revealed && state.current;
    hint.hidden = !showHint;
    if (showHint) hint.innerHTML = `Hint: <b>${escapeHTML(romanize(state.current.word))}</b>`;
  }
  const tileEls = $$('#tiles .tile');
  tileEls.forEach(t => t.classList.toggle('used', state.selection.some(s => s.id === Number(t.dataset.id))));
  $('#btnSubmit').disabled = state.selection.length !== total || state.locked || state.revealed;
}

$('#btnUndo').addEventListener('click', () => {
  if (state.selection.length) removeSlot(state.selection.length - 1);
});
$('#btnClear').addEventListener('click', () => {
  if (!state.selection.length || state.locked) return;
  state.selection = []; Sound.remove(); renderAnswer();
});
$('#btnSubmit').addEventListener('click', submitAnswer);

function submitAnswer(){
  if (state.locked || state.revealed) return;
  if (state.selection.length !== state.current.letters.length) return;
  stopTimer();
  const guess = state.selection.map(s => s.text).join('');
  const right = guess === state.current.word;
  const zone = $('#answerZone');
  const fb = $('#feedbackBar');

  if (right){
    state.locked = true;
    const points = state.attempt === 1 ? 2 : 1;
    const player = state.players[state.turnIndex];
    player.score += points;
    player.correct += 1;
    zone.classList.add('correct');
    fb.textContent = state.attempt === 1 ? 'Perfect! +2 points' : 'Perfect! +1 point';
    fb.className = 'feedback-bar good';
    Sound.correct();
    burstConfetti(60);
    renderScoreboard();
    setTimeout(() => {
      zone.classList.remove('correct');
      showTurnResult(true, points);
    }, 700);
    return;
  }

  Sound.wrong();
  zone.classList.add('wrong');
  setTimeout(() => zone.classList.remove('wrong'), 500);
  if (state.attempt === 1){
    state.attempt = 2;
    state.selection = [];
    renderAnswer();
    $('#attemptBadge').textContent = 'ATTEMPT 2 · +1';
    $('#attemptBadge').classList.add('final');
    fb.textContent = 'Not quite — one more try! Use the hint below.';
    fb.className = 'feedback-bar bad';
    renderAnswer();
    resetTimer();
  } else {
    state.locked = true;
    state.revealed = true;
    fb.textContent = 'The correct word is highlighted below.';
    fb.className = 'feedback-bar bad';
    renderAnswer();
    setTimeout(() => showTurnResult(false, 0), 800);
  }
}

function showTurnResult(correct, points){
  const cat = catById(state.categoryId);
  const shownCat = state.categoryId === 'super' ? catById(detectCategory(state.current.word)) : cat;
  $('#resEmoji').textContent = correct ? (state.attempt === 1 ? '🎉' : '👏') : '💪';
  $('#resTitle').textContent = correct ? 'Perfect!' : 'No Worries!';
  $('#resWord').textContent = state.current.word;
  $('#resWord').lang = 'pa';
  const player = state.players[state.turnIndex];
  $('#resSub').textContent = correct
    ? `${player.name} · +${points} point${points === 1 ? '' : 's'} · ${shownCat.en}`
    : `${player.name} · 0 points · the word was from ${shownCat.en}`;
  const tiles = $('#resTiles');
  tiles.innerHTML = state.current.letters
    .map(l => `<span class="res-tile" lang="pa">${escapeHTML(l)}</span>`).join('');
  $('#overlayTurn').classList.add('show');
}

function detectCategory(word){
  const counts = matraCounts(word);
  const signs = Object.keys(counts);
  if (!signs.length) return 'mukta';
  signs.sort((a, b) => counts[b] - counts[a]);
  return MATRA_INFO[signs[0]].id;
}

$('#resNext').addEventListener('click', () => {
  $('#overlayTurn').classList.remove('show');
  nextTurn();
});

function nextTurn(){
  state.turnNo += 1;
  state.turnIndex = (state.turnIndex + 1) % state.players.length;
  if (state.turnIndex === 0){ state.round += 1; }
  renderScoreboard();
  if (state.turnNo >= state.totalTurns){ finishGame(); return; }
  startTurn();
}

/* ── timer ────────────────────────────────────────────────── */
function resetTimer(){
  stopTimer();
  const el = $('#turnTimer');
  if (!state.settings.timer){ el.classList.add('off'); return; }
  el.classList.remove('off', 'warn');
  state.secondsLeft = state.settings.seconds;
  el.textContent = String(state.secondsLeft);
  state.timerId = setInterval(() => {
    state.secondsLeft -= 1;
    el.textContent = String(Math.max(0, state.secondsLeft));
    if (state.secondsLeft <= 5) el.classList.add('warn');
    if (state.secondsLeft <= 0){
      stopTimer();
      timeUp();
    }
  }, 1000);
}
function stopTimer(){
  if (state.timerId){ clearInterval(state.timerId); state.timerId = 0; }
}
function timeUp(){
  if (state.locked || state.revealed) return;
  Sound.wrong();
  const fb = $('#feedbackBar');
  if (state.attempt === 1){
    state.attempt = 2;
    state.selection = [];
    renderAnswer();
    $('#attemptBadge').textContent = 'ATTEMPT 2 · +1';
    $('#attemptBadge').classList.add('final');
    fb.textContent = 'Time up! One last try — use the hint.';
    fb.className = 'feedback-bar bad';
    renderAnswer();
    resetTimer();
  } else {
    state.locked = true;
    state.revealed = true;
    fb.textContent = "Time up! Here's the correct word.";
    fb.className = 'feedback-bar bad';
    renderAnswer();
    setTimeout(() => showTurnResult(false, 0), 800);
  }
}

$('#gameQuit').addEventListener('click', () => {
  if (confirm('Leave this game and go back to the dashboard?')){
    stopTimer();
    window.parent.postMessage({ type:'GPA_EXIT_WORD_WARRIORS' }, window.location.origin);
    showScreen('screenHome');
  }
});

/* ══════════════════════════════════════════════════════════════
   WINNER
   ══════════════════════════════════════════════════════════════ */
function finishGame(){
  stopTimer();
  const sorted = state.players.slice().sort((a, b) => b.score - a.score || b.correct - a.correct);
  const podium = $('#podium');
  podium.innerHTML = '';
  const places = [
    { p: sorted[0], cls:'p1', emoji:'🥇', label:'CHAMPION' },
    { p: sorted[1], cls:'p2', emoji:'🥈', label:'RUNNER-UP' },
    { p: sorted[2], cls:'p3', emoji:'🥉', label:'THIRD' }
  ].filter(x => x.p);
  places.forEach(({ p, cls, emoji, label }) => {
    const el = document.createElement('div');
    el.className = 'pod ' + cls;
    el.innerHTML = `
      <span class="pod-emoji">${emoji}</span>
      <span class="pod-name">${p.avatar} ${escapeHTML(p.name)}</span>
      <span class="pod-score">${p.score} pts</span>
      <span class="pod-place">${label}</span>`;
    podium.appendChild(el);
  });

  const full = $('#finalBoard');
  full.innerHTML = `<div class="panel-head"><h3>Final scoreboard</h3><span class="muted small">${state.players.reduce((n, p) => n + p.score, 0)} total points</span></div>`;
  sorted.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'sb-row';
    row.innerHTML = `
      <span class="sb-rank">${i + 1}</span>
      <span class="sb-avatar">${p.avatar}</span>
      <span class="sb-info"><b>${escapeHTML(p.name)}</b><small>${p.correct} correct answers</small></span>
      <span class="sb-score">${p.score}</span>`;
    full.appendChild(row);
  });

  showScreen('screenWinner');
  Sound.win();
  burstConfetti(320);
  setTimeout(() => burstConfetti(180), 700);
}

$('#btnAgain').addEventListener('click', () => {
  stopConfetti();
  startGame();
});
$('#btnChangeCat').addEventListener('click', () => {
  stopConfetti();
  renderCategories();
  showScreen('screenCategories');
});
$('#btnHomeFromWin').addEventListener('click', () => {
  stopConfetti();
  showScreen('screenHome');
});

/* ══════════════════════════════════════════════════════════════
   WORD BANK EDITOR
   ══════════════════════════════════════════════════════════════ */
function bankCategoryValue(){ return $('#bankCategory').value || 'kanna'; }

function renderBank(){
  const catId = bankCategoryValue();
  const items = bankWords(catId);
  const query = ($('#bankSearch').value || '').trim();
  const shown = query ? items.filter(i => i.word.includes(query)) : items;
  $('#bankCount').textContent = `${shown.length}${query ? ' / ' + items.length : ''} words`;
  const list = $('#bankList');
  list.innerHTML = '';
  if (!shown.length){
    list.innerHTML = '<p class="muted small">No words here yet. Add one above.</p>';
    return;
  }
  shown.slice(0, 400).forEach(item => {
    const row = document.createElement('div');
    row.className = 'bank-item';
    row.innerHTML = `<span lang="pa">${escapeHTML(item.word)}<small><i class="bank-roman">${escapeHTML(romanize(item.word))}</i> · ${item.letters.length} letters</small></span>
      <span class="bank-tools"><button type="button" class="bank-edit" title="Edit word" aria-label="Edit ${escapeHTML(item.word)}">✎</button>
      <button type="button" class="bank-del" title="Delete word" aria-label="Delete ${escapeHTML(item.word)}">✕</button></span>`;
    row.querySelector('.bank-del').addEventListener('click', () => deleteBankWord(catId, item.word));
    row.querySelector('.bank-edit').addEventListener('click', () => editBankWord(catId, item.word));
    list.appendChild(row);
  });
}

function setBankMessage(msg, good){
  const el = $('#bankMsg');
  el.textContent = msg;
  el.className = 'bank-msg ' + (good ? 'good' : 'bad');
}

/** Shared validation for new / renamed teacher words. */
function checkNewWord(word, catId){
  if (!word) return { ok:false, msg:'Type a word first.' };
  if (/\s/.test(word)) return { ok:false, msg:'Add one single word at a time (no spaces).' };
  const letters = splitAkshar(word);
  if (Array.from(word).length < 2 || letters.length < 1)
    return { ok:false, msg:'Use a real Gurmukhi word of at least 2 letters.' };
  if (bankWords(catId).some(i => i.word === word))
    return { ok:false, msg:'That word is already in this category.' };
  return { ok:true, letters };
}

function editBankWord(catId, oldWord){
  const next = String(prompt(`Edit "${oldWord}"`, oldWord) || '').trim().replace(/\s+/g, ' ');
  if (!next || next === oldWord) return;
  const check = checkNewWord(next, catId);
  if (!check.ok){ setBankMessage(check.msg, false); return; }
  const base = baseWords(catId);
  if (base.includes(oldWord)){
    if (!Array.isArray(customBank[catId + ':removed'])) customBank[catId + ':removed'] = [];
    customBank[catId + ':removed'].push(oldWord);
  }
  if (Array.isArray(customBank[catId])) customBank[catId] = customBank[catId].filter(w => w !== oldWord);
  if (!Array.isArray(customBank[catId])) customBank[catId] = [];
  customBank[catId].push(next);
  saveJSON(LS_BANKS, customBank);
  bankCache.clear();
  renderBank();
  setBankMessage(`Renamed "${oldWord}" to "${next}".`, true);
}

function deleteBankWord(catId, word){
  const base = baseWords(catId);
  if (base.includes(word)){
    // Remember that a built-in word was removed for this device.
    if (!Array.isArray(customBank[catId + ':removed'])) customBank[catId + ':removed'] = [];
    if (!customBank[catId + ':removed'].includes(word)) customBank[catId + ':removed'].push(word);
  }
  if (Array.isArray(customBank[catId])){
    customBank[catId] = customBank[catId].filter(w => w !== word);
  }
  saveJSON(LS_BANKS, customBank);
  bankCache.clear();
  renderBank(); setBankMessage(`Removed "${word}".`, true);
}

$('#bankAddBtn').addEventListener('click', () => {
  const catId = bankCategoryValue();
  const input = $('#bankWord');
  const word = String(input.value || '').trim().replace(/\s+/g, ' ');
  const check = checkNewWord(word, catId);
  if (!check.ok){ setBankMessage(check.msg, false); return; }
  if (!Array.isArray(customBank[catId])) customBank[catId] = [];
  customBank[catId].push(word);
  saveJSON(LS_BANKS, customBank);
  bankCache.clear();
  input.value = '';
  renderBank();
  setBankMessage(`Added "${word}" · ${romanize(word)} — saved on this device and used in every new game.`, true);
});
$('#bankWord').addEventListener('keydown', e => { if (e.key === 'Enter') $('#bankAddBtn').click(); });
$('#bankSearch').addEventListener('input', renderBank);
$('#bankCategory').addEventListener('change', () => { renderBank(); setBankMessage('', true); });
$('#bankReset').addEventListener('click', () => {
  const catId = bankCategoryValue();
  delete customBank[catId];
  delete customBank[catId + ':removed'];
  saveJSON(LS_BANKS, customBank);
  bankCache.clear();
  renderBank(); setBankMessage('Category restored to the built-in list.', true);
});
$('#bankResetAll').addEventListener('click', () => {
  if (!confirm('Restore every category to the built-in word list?')) return;
  customBank = {}; saveJSON(LS_BANKS, customBank); bankCache.clear();
  renderBank(); setBankMessage('All categories restored.', true);
});

/* ── wire up home navigation ──────────────────────────────── */
$('#btnStart').addEventListener('click', () => { Sound.unlock(); renderPlayerSetup(); showScreen('screenPlayers'); });
$('#btnHow').addEventListener('click', () => showScreen('screenHow'));
/* ── teacher-only Word Bank ────────────────────────────────── */
const ADMIN_HASH = '741a7b32e99a9db456948cc6bbd4e66ba6c3760587ab49e1e6817c3fbe6fa48c';
let adminUnlocked = false;
try { adminUnlocked = sessionStorage.getItem('pww.admin.v1') === '1'; } catch {}

async function sha256Hex(text){
  const data = new TextEncoder().encode(text);
  if (window.crypto && crypto.subtle){
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
  }
  return '';
}
function setAdminMessage(msg, bad){
  const el = $('#adminMsg');
  el.textContent = msg || '';
  el.className = 'bank-msg ' + (bad ? 'bad' : 'good');
}
function openAdminGate(){
  $('#adminPass').value = '';
  setAdminMessage('', false);
  $('#overlayAdmin').classList.add('show');
  setTimeout(() => $('#adminPass').focus(), 90);
}
function closeAdminGate(){ $('#overlayAdmin').classList.remove('show'); }
function openBank(){
  renderBank();
  showScreen('screenBank');
}
async function tryUnlockAdmin(){
  const pass = $('#adminPass').value;
  if (!pass){ setAdminMessage('Enter the admin password.', true); return; }
  const hash = await sha256Hex('pww::admin::v1::' + pass);
  if (!hash || hash !== ADMIN_HASH){
    setAdminMessage('Wrong password. Try again.', true);
    $('#adminPass').select();
    return;
  }
  adminUnlocked = true;
  try { sessionStorage.setItem('pww.admin.v1', '1'); } catch {}
  closeAdminGate();
  openBank();
}
function lockBank(){
  adminUnlocked = false;
  try { sessionStorage.removeItem('pww.admin.v1'); } catch {}
  showScreen('screenHome');
}

/* ── full screen + dashboard exit ─────────────────────────── */
const fullscreenBtn = $('#gameFullscreen');
if (fullscreenBtn){
  fullscreenBtn.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {}
  });
  document.addEventListener('fullscreenchange', () => {
    fullscreenBtn.textContent = document.fullscreenElement ? '⤢' : '⛶';
  });
}
const homeExit = $('#btnHomeExit');
if (homeExit && window.parent !== window){
  homeExit.hidden = false;
  homeExit.addEventListener('click', () => {
    window.parent.postMessage({ type:'GPA_EXIT_WORD_WARRIORS' }, window.location.origin);
  });
}

$('#btnBank').addEventListener('click', () => { adminUnlocked ? openBank() : openAdminGate(); });
$('#adminUnlock').addEventListener('click', tryUnlockAdmin);
$('#adminPass').addEventListener('keydown', e => { if (e.key === 'Enter') tryUnlockAdmin(); });
$('#adminCancel').addEventListener('click', closeAdminGate);
$('#overlayAdmin').addEventListener('click', e => { if (e.target.id === 'overlayAdmin') closeAdminGate(); });
$('#bankLock').addEventListener('click', lockBank);
$('#btnHomeSettings').addEventListener('click', () => { syncToggles(); $('#overlaySettings').classList.add('show'); });
$('#closeSettings').addEventListener('click', () => $('#overlaySettings').classList.remove('show'));
$('#closeSettings2').addEventListener('click', () => $('#overlaySettings').classList.remove('show'));
$('#overlaySettings').addEventListener('click', e => { if (e.target.id === 'overlaySettings') e.currentTarget.classList.remove('show'); });

/* keyboard: 1–9 picks a tile, Backspace undo, Esc clear, Enter submit */
document.addEventListener('keydown', e => {
  if (state.screen !== 'screenGame' || $('#overlayTurn').classList.contains('show')) return;
  if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
  if (e.key >= '1' && e.key <= '9'){
    const tiles = $$('#tiles .tile:not(.used)');
    const tile = tiles[Number(e.key) - 1];
    if (tile) pickTile(Number(tile.dataset.id));
  } else if (e.key === 'Backspace'){ e.preventDefault(); if (state.selection.length) removeSlot(state.selection.length - 1); }
  else if (e.key === 'Escape'){ $('#btnClear').click(); }
  else if (e.key === 'Enter'){ if (!$('#btnSubmit').disabled) submitAnswer(); }
});

/* ══════════════════════════════════════════════════════════════
   CONFETTI
   ══════════════════════════════════════════════════════════════ */
const confetti = { canvas:null, ctx:null, parts:[], raf:0, running:false };
function confettiSetup(){
  const canvas = $('#confetti');
  confetti.canvas = canvas;
  confetti.ctx = canvas.getContext('2d');
  resizeConfetti();
  window.addEventListener('resize', resizeConfetti);
}
function resizeConfetti(){
  const c = confetti.canvas; if (!c) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = Math.floor(window.innerWidth * dpr);
  c.height = Math.floor(window.innerHeight * dpr);
  c.style.width = window.innerWidth + 'px';
  c.style.height = window.innerHeight + 'px';
  confetti.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
const confettiColors = ['#ffc93c','#43e8ff','#a774ff','#ff6bc1','#39e58c','#fff3c4'];
function burstConfetti(n){
  if (!confetti.canvas) confettiSetup();
  const W = window.innerWidth;
  for (let i = 0; i < n; i++){
    confetti.parts.push({
      x: W / 2 + (Math.random() - 0.5) * W * 0.55,
      y: -20 - Math.random() * 80,
      vx: (Math.random() - 0.5) * 3.4,
      vy: 2 + Math.random() * 4.2,
      size: 5 + Math.random() * 8,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.24,
      color: confettiColors[(Math.random() * confettiColors.length) | 0],
      life: 0
    });
  }
  if (!confetti.running) confettiLoop();
}
function confettiLoop(){
  const { ctx, canvas } = confetti;
  if (!ctx || !canvas) return;
  confetti.running = true;
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  for (let i = confetti.parts.length - 1; i >= 0; i--){
    const p = confetti.parts[i];
    p.vy += 0.045; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life++;
    if (p.y > window.innerHeight + 40 || p.life > 500){ confetti.parts.splice(i, 1); continue; }
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    ctx.restore();
  }
  if (confetti.parts.length){
    confetti.raf = requestAnimationFrame(confettiLoop);
  } else {
    confetti.running = false;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }
}
function stopConfetti(){
  confetti.parts = [];
  if (confetti.raf) cancelAnimationFrame(confetti.raf);
  confetti.raf = 0; confetti.running = false;
  if (confetti.ctx) confetti.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
}

/* ══════════════════════════════════════════════════════════════
   BOOT
   ══════════════════════════════════════════════════════════════ */
(function boot(){
  confettiSetup();
  $('#tiles').addEventListener('dragover', ev => ev.preventDefault());
  $('#tiles').addEventListener('drop', ev => {
    ev.preventDefault();
    const data = ev.dataTransfer.getData('text/plain') || '';
    if (data.startsWith('slot:')) removeSlot(Number(data.slice(5)));
  });
  const select = $('#bankCategory');
  CATEGORIES.slice(0, 10).forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id; opt.textContent = cat.en;
    select.appendChild(opt);
  });
  select.value = 'kanna';
  renderPlayerSetup();
  renderCategories();
  renderBank();
  syncToggles();

  const total = CATEGORIES.filter(c => c.id !== 'super').reduce((sum, c) => sum + bankWords(c.id).length, 0);
  $('#homeProgress').textContent = `11 categories · ${total.toLocaleString('en-IN')} verified words`;

  // Let the dashboard hide its own chrome when this page is embedded.
  try {
    if (window.parent !== window) window.parent.postMessage({ type:'GPA_WORD_WARRIORS_READY' }, window.location.origin);
  } catch {}
})();
