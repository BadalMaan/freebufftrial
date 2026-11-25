import fs from 'node:fs';
import vm from 'node:vm';

const file = 'public/word-warriors/words.js';
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(file, 'utf8') + ';this.W = WORD_BANK;', sandbox);
const bank = sandbox.W;

const MUKTA = `ਕਮਲ ਨਗਰ ਪਗਰ ਅਮਨ ਬਚਪ ਸਬਰ ਮਗਰ ਹਲਕ ਕਸਮ ਜਗਲ ਪਵਨ ਦਮਕ ਚਮਕ ਨਮਕ ਬਹਤ ਰਤਨ ਕਬਤ ਸਹਰ ਪਤਰ ਗਗਨ ਕਰਮ ਮਸਤ ਨਰਮ ਅਦਲ ਬਰਗ ਸਪਨ ਪਰਵ ਕਲਮ ਹਕਮ ਦਰਖ ਗਰਬ ਮਨਤ ਜਲਦ ਕਦਮ ਸਰਮ ਬਦਲ ਸਫਲ ਹਸਣ ਮਟਰ ਪਥਰ ਕਸਬ ਨਸਲ ਦਮਨ ਜਗਤ ਅਕਲ ਬਰਫ ਸਰਦ ਪਰਬ ਮਹਲ ਗਰਮ ਤਰਕ ਕਮਰ ਬਹਰ ਨਗਮ ਪਲਕ ਸਕਤ ਹਮਲ ਦਰਦ ਜਮਨ ਕਰਕ ਮਗਨ ਬਰਤ ਨਰਗ ਪਸਰ ਸਰਕ ਕਪਟ ਤਪਸ ਬਲਖ ਨਮਰ
ਅਦਰਕ ਅਜਗਰ ਅਖਬਰ ਅਮਰਤ ਕਬਤਰ ਕਸਮਤ ਕਰਤਬ ਕਮਰਤ ਗਲਹਰ ਗਰਦਨ ਚਮਕਰ ਚਪਟਰ ਜਗਮਗ ਜਲਧਰ ਤਰਕਸ਼ ਦਰਬਰ ਦਮਕਲ ਨਕਲਸ ਪਰਕਰ ਪਤਲਗ ਫਰਮਨ ਬਦਲਤ ਬਰਕਤ ਭਰਕਮ ਮਤਲਬ ਮਨਸਬ ਰਖਵਲ ਲਕਰਤ ਸਫਰਤ ਹਮਦਰ ਬਰਤਨ ਕਸਰਤ ਮਹਕਮ ਪਰਚਮ ਨਰਮਲ ਸਰਪਟ ਦਲਚਸ ਬਲਕਰ ਹਰਮਨ ਕਰਮਨ ਮਨਹਰ ਪਰਬਤ ਸਮਰਥ ਅਨਮਲ ਕਲਮਲ ਨਟਖਟ ਬਰਗਦ ਹਕਮਤ ਗਮਲਤ ਚਤਰਸ ਜਰਗਰ ਮਰਕਟ ਸਰਬਤ ਕਰਤਰ ਦਰਸਨ ਪਰਮਤ ਬਹਮਤ ਗਰਮਤ ਨਰਪਤ`
  .split(/\s+/).filter(Boolean);

bank.mukta = MUKTA;

// Words without bindi (ਂ), tippi (ੰ), addak (ੱ) or conjuncts (੍) only.
const BAD = /[ੰਃੱ੍]/;
const TOPUP = {
  sihari: ['ਕਿਲਾ', 'ਕਿਸ', 'ਦਿਨ', 'ਦਿਲ'],
  aunkar: ['ਗੁਰੂ', 'ਸੁਖੀ', 'ਕੁੜੀ', 'ਗੁੜ', 'ਸੁਖ', 'ਪੁਲ', 'ਗੁਲ', 'ਗੁਣ', 'ਮੁਖ', 'ਸੁਰ', 'ਜੁਗ',
    'ਕੁਲ', 'ਮੁਲ', 'ਤੁਲ', 'ਰੁਤ', 'ਧੁਨ', 'ਤੁਰ', 'ਮੁੜ', 'ਸੁਣ', 'ਰੁਕ', 'ਚੁਕ']
};

const ids = ['mukta','kanna','sihari','bihari','aunkar','dulankar','laavan','dolaavan','hora','kanora'];
const clean = {};
for (const id of ids) {
  const seen = new Set();
  const words = [...(bank[id] || []), ...(TOPUP[id] || [])].filter(w => {
    const word = String(w).trim();
    if (!word || BAD.test(word) || seen.has(word)) return false;
    seen.add(word);
    return Array.from(word).length >= 3;
  });
  clean[id] = words;
  console.log(id, words.length);
}

const format = (list) => {
  const lines = [];
  for (let i = 0; i < list.length; i += 10) {
    lines.push('    ' + list.slice(i, i + 10).map(w => `'${w}'`).join(',') + (i + 10 < list.length ? ',' : ''));
  }
  return lines.join('\n');
};

const out = `/* ══════════════════════════════════════════════════════════════
   PUNJABI WORD WARRIORS — curated word bank
   No word uses bindi, tippi, addak or a conjunct; the Mukta bank is
   the teacher's list. Tile akshar are derived at runtime, so vowel
   signs always stay attached to their consonant (ਕਵਿਤਾ → ਕ · ਵਿ · ਤਾ).
   ══════════════════════════════════════════════════════════════ */
const WORD_BANK = {
${ids.map(id => `  /* ${id} */\n  ${id}: [\n${format(clean[id])}\n  ]`).join(',\n\n')}
};
`;
fs.writeFileSync(file, out);
console.log('written', file);
