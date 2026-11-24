// Публічна конфігурація для фронтенду (URL та anon key — не секрети).
export default function handler(req, res) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return res.status(500).json({ error: 'Supabase is not configured' });
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.status(200).json({ supabaseUrl: url, supabaseAnonKey: key, checkoutUrl: process.env.CHECKOUT_URL || null });
}
