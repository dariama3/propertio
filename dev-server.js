// Локальний сервер (замість php -S): node dev-server.js  →  http://0.0.0.0:8000
import http from 'node:http';
import { readFile } from 'node:fs/promises';

try { process.loadEnvFile(new URL('./.env', import.meta.url)); } catch {}
try { process.loadEnvFile(new URL('./.env.local', import.meta.url)); } catch {}

const port = process.env.PORT || 8000;

// Запускає api/<name>.js так, як це робить Vercel: (req,res) або Web-обробники GET/POST
async function runApi(name, u, req, res) {
  let mod;
  try { mod = await import(new URL(`./api/${name}.js?t=${Date.now()}`, import.meta.url)); }
  catch { res.writeHead(404); return res.end('Not found'); }

  const web = mod[req.method];
  if (web) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const r = await web(new Request(u.href, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) }));
    res.writeHead(r.status, Object.fromEntries(r.headers));
    return res.end(Buffer.from(await r.arrayBuffer()));
  }
  if (!mod.default) { res.writeHead(405); return res.end('Method not allowed'); }
  req.query = Object.fromEntries(u.searchParams);
  res.status = code => { res.statusCode = code; return res; };
  res.json = body => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(body)); };
  await mod.default(req, res);
}

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  const api = u.pathname.match(/^\/api\/([\w-]+)$/);
  if (api) {
    try { return await runApi(api[1], u, req, res); }
    catch (e) { console.error(e); if (!res.headersSent) res.writeHead(500); return res.end('Server error'); }
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
