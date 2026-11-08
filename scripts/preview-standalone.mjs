// Local UI preview only. The Cloudflare deployment always requires Access.
import {createServer} from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../dist/client/', import.meta.url));
const types = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.pdf': 'application/pdf', '.gz': 'application/gzip', '.ttf': 'font/ttf'};
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1:5173');
    if (url.pathname === '/api/me') {
      res.writeHead(200, {'content-type': 'application/json', 'cache-control': 'no-store'});
      res.end(JSON.stringify({authenticated: false, cloudReady: false, capabilities: {pdfSync: false}, signIn: '/', signOut: '/'}));
      return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) {res.writeHead(405); res.end(); return;}
    const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(root) || !(await stat(file)).isFile()) throw new Error('Not found');
    const bytes = await readFile(file);
    res.writeHead(200, {'content-type': types[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff'});
    res.end(req.method === 'HEAD' ? undefined : bytes);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
}).listen(5173, '127.0.0.1', () => console.log('Xem giao diện tại http://127.0.0.1:5173 — đăng nhập và đồng bộ chạy trên Cloudflare.'));
