import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root = path.resolve('public');
// Render (and most PaaS hosts) inject PORT and require binding to 0.0.0.0.
const port = Number(process.env.PORT) || 8126;
const host = process.env.HOST || (process.env.PORT ? '0.0.0.0' : '127.0.0.1');

const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.woff2': 'font/woff2'
};

// Text must revalidate so new builds are picked up; heavy media can be cached.
const revalidate = new Set(['.html', '.js', '.css', '.json']);
const compressible = new Set(['.html', '.js', '.css', '.json', '.svg']);

http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = path.join(root, url === '/' ? 'arena.html' : url);
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  fs.stat(file, (err, st) => {
    if (err || st.isDirectory()) { res.writeHead(404).end('not found'); return; }
    const ext = path.extname(file).toLowerCase();
    const headers = {
      'Content-Type': types[ext] || 'application/octet-stream',
      'Cache-Control': revalidate.has(ext) ? 'no-cache' : 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff'
    };
    const wantsGzip = compressible.has(ext) && st.size > 1024 &&
      /\bgzip\b/.test(req.headers['accept-encoding'] || '');
    if (wantsGzip) {
      headers['Content-Encoding'] = 'gzip';
      headers['Vary'] = 'Accept-Encoding';
    }
    res.writeHead(200, headers);
    if (req.method === 'HEAD') { res.end(); return; }
    const stream = fs.createReadStream(file);
    if (wantsGzip) stream.pipe(zlib.createGzip()).pipe(res);
    else stream.pipe(res);
    stream.on('error', () => res.destroy());
  });
}).listen(port, host, () => console.log(`serving public/ on http://${host}:${port}`));
