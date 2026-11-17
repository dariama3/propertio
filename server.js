// Локальний сервер (замість php -S): node server.js  →  http://0.0.0.0:8000
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { parseOtodom } from './lib/otodom.js';

const port = process.env.PORT || 8000;
http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/api/fetch') {
    const [status, body] = await parseOtodom(u.searchParams.get('url'));
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify(body));
  }
  if (u.pathname === '/' || u.pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(await readFile(new URL('./index.html', import.meta.url)));
  }
  res.writeHead(404); res.end('Not found');
}).listen(port, '0.0.0.0', () => console.log(`http://localhost:${port}`));
