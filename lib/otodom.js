// Розбір оголошення Otodom. Використовується api/fetch.js (Vercel) і server.js (локально).
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const EXTRAS = { lift: 'ліфт', balcony: 'балкон', basement: 'підвал', terrace: 'тераса',
  separate_kitchen: 'окрема кухня', garage: 'гараж', usable_room: 'komórka lokatorska', garden: 'садок' };

export async function parseOtodom(rawUrl) {
  let u;
  try { u = new URL(String(rawUrl || '').trim()); } catch { return [400, { error: 'Некоректне посилання' }]; }
  if (u.protocol !== 'https:' || !['www.otodom.pl', 'otodom.pl'].includes(u.hostname.toLowerCase())) {
    return [400, { error: 'Підтримуються лише посилання https://www.otodom.pl/...' }];
  }
  let res;
  try {
    res = await fetch(u.href, { headers: { 'User-Agent': UA, 'Accept-Language': 'pl,uk;q=0.8,en;q=0.5' },
      redirect: 'follow', signal: AbortSignal.timeout(15000) });
  } catch (e) { return [502, { error: 'Otodom не відповів' }]; }
  if (res.status !== 200) return [502, { error: `Otodom не відповів (код ${res.status})` }];
  if (!/(^|\.)otodom\.pl$/i.test(new URL(res.url).hostname)) return [400, { error: 'Редірект на сторонній сайт заблоковано' }];
  const html = await res.text();
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return [502, { error: 'Не вдалося знайти дані оголошення' }];
  let ad;
  try { ad = JSON.parse(m[1])?.props?.pageProps?.ad; } catch { ad = null; }
  if (!ad) return [404, { error: 'Оголошення не знайдено (можливо, воно неактивне)' }];

  const t = ad.target || {};
  const num = v => (v === null || v === undefined || v === '') ? null : Number(v);
  const floorNo = t.Floor_no?.[0] ?? null;
  let floor = null;
  if (floorNo !== null) {
    const n = floorNo === 'ground_floor' ? '0' : String(floorNo).replace(/\D/g, '');
    floor = n + (t.Building_floors_num ? ' / ' + t.Building_floors_num : '');
  }
  const feat = [];
  for (const e of (t.Extras_types || [])) if (EXTRAS[e]) feat.push(EXTRAS[e]);
  if ((t.Equipment_types || []).includes('furniture')) feat.push('меблі');

  const desc = String(ad.description || '').replace(/<[^>]*>/g, ' ').toLowerCase();
  const needsReno = /do remontu|do własnej aranżacji|do aranżacji|do odświeżenia|do generalnego remontu|wymaga remontu|do wykończenia/u.test(desc);
  let district = null;
  for (const l of (ad.location?.reverseGeocoding?.locations || [])) if (l.locationLevel === 'district') district = l.name;
  const street = ad.location?.address?.street?.name ?? null;

  const ob = t.Building_ownership?.[0] ?? null;
  let own = 'unknown';
  if (ob === 'full_ownership' || /pełn\p{L}* własno/u.test(desc)) own = 'full';
  else if (ob === 'usufruct' || /użytkowani\p{L}* wieczyst/u.test(desc)) own = 'perp';
  else if (ob === 'limited_ownership' || /spółdziel\p{L}* własnościow/u.test(desc)) {
    if (/brak kw|bez kw|bez księgi|nie posiada kw|nie ma kw|założeni\p{L}*\s+ksi\p{L}*|założyć\s+ksi\p{L}*/u.test(desc)) own = 'coop_nokw';
    else if (/(^|[^\p{L}])kw([^\p{L}]|$)|księg\p{L}*\s+wieczyst/u.test(desc)) own = 'coop_kw';
    else own = 'coop';
  }
  const agency = (t.user_type ?? '') !== 'private' && (ad.advertiserType ?? '') !== 'private';
  const rooms = t.Rooms_num?.[0] ?? null;
  const name = street
    ? street.replace(/^(ul\.|al\.)\s*/iu, '') + (rooms ? ` (${rooms}-к)` : '')
    : (ad.title || '');
  return [200, {
    url: ad.url || res.url, title: ad.title || '', name, loc: street, dist: district,
    price: num(t.Price), area: num(t.Area), rooms, floor, year: t.Build_year ?? null,
    czynsz: num(t.Rent), agency, seller: ad.agency?.name ?? ad.owner?.name ?? null,
    ready: !needsReno, own, feat: feat.join(', '),
  }];
}
