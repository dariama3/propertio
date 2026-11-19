// Вибір парсера за доменом посиланням
import { parseOtodom } from './otodom.js';

export async function parseListing(rawUrl) {
  let host = '';
  try { host = new URL(String(rawUrl || '').trim()).hostname.toLowerCase(); } catch {}
  if (/(^|\.)otodom\.pl$/.test(host)) return parseOtodom(rawUrl);
  return [400, { error: 'Unsupported link', code: host ? 'host' : 'bad_url' }];
}
