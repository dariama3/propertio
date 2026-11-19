import { parseListing } from '../lib/listing.js';

export default async function handler(req, res) {
  const [status, body] = await parseListing(req.query?.url);
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
}
