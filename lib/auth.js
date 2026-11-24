// Спільні серверні хелпери: Supabase admin-клієнт, перевірка JWT і Pro-статусу.
import { createClient } from '@supabase/supabase-js';

let _admin;
export function admin() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return (_admin ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = v => UUID.test(String(v || ''));

// Повертає [status, body] у разі відмови або { user, pro } при успіху.
// Pro, якщо сам користувач Pro або (передано wsId) він учасник списку, власник якого Pro.
export async function authorize(req, wsId) {
  const db = admin();
  if (!db) return [500, { error: 'Server is not configured', code: 'server_config' }];

  const m = String(req.headers?.authorization || '').match(/^Bearer\s+(.+)$/i);
  if (!m) return [401, { error: 'Sign in required', code: 'auth_required' }];
  const { data, error } = await db.auth.getUser(m[1]);
  if (error || !data?.user) return [401, { error: 'Invalid session', code: 'auth_required' }];
  const user = data.user;

  const { data: me } = await db.from('profiles').select('is_pro').eq('id', user.id).maybeSingle();
  let pro = !!me?.is_pro;

  if (!pro && wsId) {
    if (!isUuid(wsId)) return [400, { error: 'Bad workspace id', code: 'bad_ws' }];
    const { data: mem } = await db.from('workspace_members').select('workspace_id')
      .eq('workspace_id', wsId).eq('user_id', user.id).maybeSingle();
    if (mem) {
      const { data: ws } = await db.from('workspaces').select('owner_id').eq('id', wsId).maybeSingle();
      if (ws) {
        const { data: owner } = await db.from('profiles').select('is_pro').eq('id', ws.owner_id).maybeSingle();
        pro = !!owner?.is_pro;
      }
    }
  }
  return { user, pro };
}
