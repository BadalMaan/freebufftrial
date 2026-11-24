import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

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
http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = path.join(root, url === '/' ? 'arena.html' : url);
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  fs.stat(file, (err, st) => {
    if (err || st.isDirectory()) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
}).listen(port, host, () => console.log(`serving public/ on http://${host}:${port}`));
