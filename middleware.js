// Пароль на весь сайт (HTTP Basic). Вмикається, якщо в Vercel задано SITE_PASSWORD.
import { next } from '@vercel/functions';

export const config = { matcher: '/:path*' };

export default function middleware(request) {
  const pass = process.env.SITE_PASSWORD;
  if (!pass) return next();
  const user = process.env.SITE_USER || 'dasha';
  const h = request.headers.get('authorization') || '';
  if (h.startsWith('Basic ')) {
    try {
      const [u, ...rest] = atob(h.slice(6)).split(':');
      if (u === user && rest.join(':') === pass) return next();
    } catch {}
  }
  return new Response('Потрібен пароль', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Propertio", charset="UTF-8"' },
  });
}
