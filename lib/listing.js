// Вибір парсера за доменом посиланням
import { parseOtodom } from './otodom.js';
import { parseMorizon } from './morizon.js';

export async function parseListing(rawUrl) {
  let host = '';
  try { host = new URL(String(rawUrl || '').trim()).hostname.toLowerCase(); } catch {}
  if (/(^|\.)morizon\.pl$/.test(host)) return parseMorizon(rawUrl);
  if (/(^|\.)otodom\.pl$/.test(host)) return parseOtodom(rawUrl);
  return [400, { error: 'Unsupported link', code: host ? 'host' : 'bad_url' }];
}
