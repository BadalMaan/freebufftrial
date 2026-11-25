import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/word-warriors/words.js', import.meta.url), 'utf8');
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(source + '\nthis.WORD_BANK = WORD_BANK;', sandbox);
const bank = sandbox.WORD_BANK;

const MATRA_INFO = {
  'ਾ': 'kanna', 'ਿ': 'sihari', 'ੀ': 'bihari', 'ੁ': 'aunkar', 'ੂ': 'dulankar',
  'ੇ': 'laavan', 'ੈ': 'dolaavan', 'ੋ': 'hora', 'ੌ': 'kanora'
};
const SIGNS = Object.keys(MATRA_INFO);
const ADDHAK = 'ੱ', NUKTA = '਼', VIRAMA = '੍', BINDI = 'ਂ', TIPPI = 'ੰ';

function splitAkshar(word) {
  const units = []; let cur = '';
  for (const ch of Array.from(word)) {
    if (ch === ADDHAK) { if (cur) units.push(cur); cur = ADDHAK; continue; }
    if (ch === VIRAMA || ch === NUKTA || ch === BINDI || ch === TIPPI || SIGNS.includes(ch)) { cur += ch; continue; }
    if (!cur) { cur = ch; continue; }
    if (cur.endsWith(VIRAMA)) { cur += ch; continue; }
    units.push(cur); cur = ch;
  }
  if (cur) units.push(cur);
  return units;
}
function counts(word) {
  const c = {};
  for (const ch of Array.from(word)) if (MATRA_INFO[ch]) c[ch] = (c[ch] || 0) + 1;
  return c;
}
function matches(word, id) {
  const c = counts(word); const signs = Object.keys(c);
  if (id === 'mukta') return signs.length === 0;
  const sign = SIGNS.find(s => MATRA_INFO[s] === id);
  if (!sign || !c[sign]) return false;
  return c[sign] >= Math.max(...signs.map(s => c[s]));
}

let failed = false;
const ids = ['mukta','kanna','sihari','bihari','aunkar','dulankar','laavan','dolaavan','hora','kanora'];
let total = 0;
for (const id of ids) {
  const words = bank[id] || [];
  const seen = new Set();
  const problems = [];
  for (const w of words) {
    if (seen.has(w)) problems.push(`duplicate: ${w}`);
    seen.add(w);
    if (Array.from(w).length < 3) problems.push(`too few characters: ${w}`);
    if (splitAkshar(w).length < 2) problems.push(`too few akshar: ${w}`);
    if (!/^[\u0A00-\u0A7F]+$/.test(w)) problems.push(`non-Gurmukhi characters: ${w}`);
    if (/[ੰਃੱ੍]/.test(w)) problems.push(`forbidden bindi/tippi/addak/conjunct: ${w}`);
    if (!matches(w, id)) problems.push(`wrong matra for ${id}: ${w} ${splitAkshar(w).join('|')}`);
  }
  total += words.length;
  console.log(`${id.padEnd(9)} ${String(words.length).padStart(4)} words, min akshar ${Math.min(...words.map(w => splitAkshar(w).length))}`);
  if (words.length < 100) { problems.push(`below 100 words (${words.length})`); }
  if (problems.length) { failed = true; console.log('  ! ' + problems.slice(0, 40).join('\n  ! ')); }
}
console.log(`\ntotal entries: ${total}`);
if (failed) process.exitCode = 1;
