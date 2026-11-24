// Вебхук Lemon Squeezy: оновлює підписку в profiles (лише через service_role).
import { createHmac, timingSafeEqual } from 'node:crypto';
import { admin, isUuid } from '../lib/auth.js';
import { mapSubscription } from '../lib/billing.js';

const EVENTS = new Set(['subscription_created', 'subscription_updated', 'subscription_cancelled', 'subscription_expired']);
const json = (status, body) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

function validSignature(raw, sig, secret) {
  if (!sig || !secret) return false;
  const expected = createHmac('sha256', secret).update(raw).digest('hex');
  const a = Buffer.from(expected), b = Buffer.from(String(sig));
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request) {
  const raw = await request.text();   // сирий body потрібен для перевірки підпису
  if (!validSignature(raw, request.headers.get('x-signature'), process.env.PAYMENT_WEBHOOK_SECRET)) {
    return json(401, { error: 'Bad signature' });
  }
  let body; try { body = JSON.parse(raw); } catch { return json(400, { error: 'Bad JSON' }); }

  const event = body?.meta?.event_name;
  if (!EVENTS.has(event)) return json(200, { ignored: event || null });

  const userId = body?.meta?.custom_data?.user_id;
  if (!isUuid(userId)) return json(400, { error: 'user_id missing' });

  const db = admin();
  if (!db) return json(500, { error: 'Server is not configured' });

  const patch = { ...mapSubscription(body.data?.attributes), subscription_id: String(body.data?.id ?? '') || null };
  if (event === 'subscription_expired') { patch.is_pro = false; patch.subscription_status = 'cancelled'; }

  const { data, error } = await db.from('profiles').update(patch).eq('id', userId).select('id');
  if (error) return json(500, { error: 'DB error' });          // шлюз повторить запит
  if (!data?.length) return json(404, { error: 'Unknown user' });
  return json(200, { ok: true, is_pro: patch.is_pro });
}
