// Локальний сервер (замість php -S): node dev-server.js  →  http://0.0.0.0:8000
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { parseListing } from './lib/listing.js';

const port = process.env.PORT || 8000;
http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/api/fetch') {
    const [status, body] = await parseListing(u.searchParams.get('url'));
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify(body));
  }
  if (u.pathname === '/' || u.pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(await readFile(new URL('./index.html', import.meta.url)));
  }
  const st = u.pathname.match(/^\/(js|css)\/([\w-]+\.(js|css))$/);
  if (st) {
    try {
      const body = await readFile(new URL(`./${st[1]}/${st[2]}`, import.meta.url));
      res.writeHead(200, { 'Content-Type': (st[3] === 'js' ? 'text/javascript' : 'text/css') + '; charset=utf-8' });
      return res.end(body);
    } catch {}
  }
  const types = { svg: 'image/svg+xml', ico: 'image/x-icon', png: 'image/png' };
  const m = u.pathname.match(/^\/assets\/([\w-]+\.(svg|ico|png))$/);
  if (m) {
    try {
      const body = await readFile(new URL('./assets/' + m[1], import.meta.url));
      res.writeHead(200, { 'Content-Type': types[m[2]] });
      return res.end(body);
    } catch {}
  }
  res.writeHead(404); res.end('Not found');
}).listen(port, '0.0.0.0', () => console.log(`http://localhost:${port}`));
