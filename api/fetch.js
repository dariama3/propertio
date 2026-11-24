import { parseListing } from '../lib/listing.js';
import { authorize } from '../lib/auth.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const a = await authorize(req, req.query?.ws);
  if (Array.isArray(a)) return res.status(a[0]).json(a[1]);
  if (!a.pro) return res.status(403).json({ error: 'Pro plan required', code: 'pro_required' });
  const [status, body] = await parseListing(req.query?.url);
  res.status(status).json(body);
}
