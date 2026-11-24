import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

// The Vite build (dist/) is the full platform: dashboard plus both canvas games,
// because everything in public/ is copied into it. Fall back to public/ when no
// build exists so `npm run serve:public` still works on a bare checkout.
const distRoot = path.resolve('dist');
const publicRoot = path.resolve('public');
const root = fs.existsSync(path.join(distRoot, 'index.html')) ? distRoot : publicRoot;
const home = fs.existsSync(path.join(root, 'index.html')) ? 'index.html' : 'arena.html';

const port = Number(process.env.PORT) || 8126;
const host = process.env.HOST || (process.env.PORT ? '0.0.0.0' : '127.0.0.1');

const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.woff2': 'font/woff2'
};

// Hashed build assets are immutable; pages must revalidate.
const assetsDir = path.sep + 'assets' + path.sep;
const revalidate = new Set(['.html', '.js', '.css', '.json']);
const compressible = new Set(['.html', '.js', '.css', '.json', '.svg']);
// Models and the vendored engine never change under a given URL (?v= in the
// client), so a repeat visit boots from cache instead of re-downloading them.
const immutableDir = /[\\/](models|vendor|assets)[\\/]/;

function send(req, res, file) {
  fs.stat(file, (err, st) => {
    if (err || st.isDirectory()) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found'); return; }
    const ext = path.extname(file).toLowerCase();
    const headers = {
      'Content-Type': types[ext] || 'application/octet-stream',
      'Cache-Control': immutableDir.test(file) ? 'public, max-age=31536000, immutable'
        : revalidate.has(ext) ? 'no-cache' : 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff'
    };
    const accepts = req.headers['accept-encoding'] || '';
    const wants = compressible.has(ext) && st.size > 1024
      ? (/\bbr\b/.test(accepts) ? 'br' : /\bgzip\b/.test(accepts) ? 'gzip' : null)
      : null;
    if (wants) {
      headers['Content-Encoding'] = wants;
      headers['Vary'] = 'Accept-Encoding';
    }
    res.writeHead(200, headers);
    if (req.method === 'HEAD') { res.end(); return; }
    const stream = fs.createReadStream(file);
    if (wants === 'br') stream.pipe(zlib.createBrotliCompress({
      params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: st.size }
    })).pipe(res);
    else if (wants === 'gzip') stream.pipe(zlib.createGzip({ level: 6 })).pipe(res);
    else stream.pipe(res);
    stream.on('error', () => res.destroy());
  });
}

http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  const file = path.join(root, url === '/' ? home : url);
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  fs.stat(file, (err, st) => {
    if (!err && st.isFile()) { send(req, res, file); return; }
    if (!err && st.isDirectory()) { send(req, res, path.join(file, 'index.html')); return; }
    // Single-page app: routes without an extension fall back to the shell.
    if (path.extname(url) === '' && root === distRoot) { send(req, res, path.join(root, 'index.html')); return; }
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found');
  });
}).listen(port, host, () => console.log(`serving ${path.basename(root)}/ on http://${host}:${port}`));
