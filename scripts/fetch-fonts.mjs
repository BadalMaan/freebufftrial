import fs from 'node:fs';
import path from 'node:path';

const css = fs.readFileSync(path.resolve('.tmp/fonts.css'), 'utf8');
const outDir = path.resolve('public/word-warriors/fonts');
fs.mkdirSync(outDir, { recursive: true });

const blocks = css.match(/@font-face\s*{[^}]*}/g) || [];
const picked = [];
for (const block of blocks) {
  const family = (block.match(/font-family:\s*'([^']+)'/) || [])[1];
  const weight = (block.match(/font-weight:\s*(\d+)/) || [])[1];
  const url = (block.match(/url\((https:[^)]+)\)/) || [])[1];
  const range = (block.match(/unicode-range:\s*([^;]+);/) || [])[1] || '';
  if (!family || !weight || !url) continue;
  const isGurmukhi = /U\+0A00|U\+0A0/i.test(range);
  const isLatin = /U\+0000-00FF|U\+0000-00A0/i.test(range) || (!range && !isGurmukhi);
  if (family === 'Noto Sans Gurmukhi' && !isGurmukhi) continue;
  if (family === 'Baloo 2' && !isLatin) continue;
  picked.push({ family, weight, url, isGurmukhi });
}

const seen = new Set();
const faces = [];
for (const item of picked) {
  const key = `${item.family}-${item.weight}-${item.isGurmukhi ? 'pa' : 'latin'}`;
  if (seen.has(key)) continue;
  seen.add(key);
  const file = `${key}.woff2`;
  const res = await fetch(item.url);
  if (!res.ok) { console.log('FAILED', key, res.status); continue; }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(path.join(outDir, file), buf);
  faces.push(`@font-face{font-family:'${item.family}';font-style:normal;font-weight:${item.weight};font-display:swap;src:url('fonts/${file}') format('woff2');${item.isGurmukhi ? "unicode-range:U+0A00-0A7F,U+200C-200D,U+25CC;" : ''}}`);
  console.log('saved', file, buf.length);
}
fs.writeFileSync(path.resolve('public/word-warriors/fonts.css'), `/* Bundled locally so the game works with no internet connection. */\n${faces.join('\n')}\n`);
console.log('faces:', faces.length);
