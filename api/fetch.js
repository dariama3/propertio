import { parseOtodom } from '../lib/otodom.js';

export default async function handler(req, res) {
  const [status, body] = await parseOtodom(req.query?.url);
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
}
