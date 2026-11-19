// Розбір оголошення Otodom. Використовується api/fetch.js (Vercel) і server.js (локально).
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
// Ключі «особливостей»; підписи мовою інтерфейсу підставляє клієнт (x.<ключ> в index.html).
const EXTRAS = ['lift', 'balcony', 'basement', 'terrace', 'separate_kitchen', 'garage', 'usable_room', 'garden'];

export async function parseOtodom(rawUrl) {
  let u;
  try { u = new URL(String(rawUrl || '').trim()); } catch { return [400, { error: 'Invalid link', code: 'bad_url' }]; }
  if (u.protocol !== 'https:' || !['www.otodom.pl', 'otodom.pl'].includes(u.hostname.toLowerCase())) {
    return [400, { error: 'Only https://www.otodom.pl/... links are supported', code: 'host' }];
  }
  let res;
  try {
    res = await fetch(u.href, { headers: { 'User-Agent': UA, 'Accept-Language': 'pl,uk;q=0.8,en;q=0.5' },
      redirect: 'follow', signal: AbortSignal.timeout(15000) });
  } catch (e) { return [502, { error: 'Otodom did not respond', code: 'no_response' }]; }
  if (res.status !== 200) return [502, { error: `Otodom did not respond (code ${res.status})`, code: 'bad_status', status: res.status }];
  if (!/(^|\.)otodom\.pl$/i.test(new URL(res.url).hostname)) return [400, { error: 'Redirect to an external site was blocked', code: 'redirect' }];
  const html = await res.text();
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return [502, { error: 'Could not find the listing data', code: 'no_data' }];
  let ad;
  try { ad = JSON.parse(m[1])?.props?.pageProps?.ad; } catch { ad = null; }
  if (!ad) return [404, { error: 'Listing not found (it may be inactive)', code: 'not_found' }];

  const t = ad.target || {};
  const num = v => (v === null || v === undefined || v === '') ? null : Number(v);
  const floorNo = t.Floor_no?.[0] ?? null;
  let floor = null;
  if (floorNo !== null) {
    const n = floorNo === 'ground_floor' ? '0' : String(floorNo).replace(/\D/g, '');
    floor = n + (t.Building_floors_num ? ' / ' + t.Building_floors_num : '');
  }
  const extras = (t.Extras_types || []).filter(e => EXTRAS.includes(e));
  if ((t.Equipment_types || []).includes('furniture')) extras.push('furniture');

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
    if (/brak kw|bez kw|bez księgi|nie posiada kw|nie ma kw|założeni\p{L}*\s+ksi\p{L}*|założyć\s+ksi\p{L}*|bez wydzielon\p{L}*\s+ksi\p{L}*/u.test(desc)) own = 'coop_nokw';
    else if (/(^|[^\p{L}])kw([^\p{L}]|$)|księg\p{L}*\s+wieczyst/u.test(desc)) own = 'coop_kw';
    else own = 'coop';
  }
  const dev = t.user_type === 'developer' || ad.advertiserType === 'developer';
  const agency = !dev && (t.user_type ?? '') !== 'private' && (ad.advertiserType ?? '') !== 'private';
  const rooms = t.Rooms_num?.[0] ?? null;
  // Суфікс «(N-к)» додає клієнт, бо він залежить від мови.
  const name = street ? street.replace(/^(ul\.|al\.)\s*/iu, '') : (ad.title || '');
  return [200, {
    url: ad.url || res.url, title: ad.title || '', name, loc: street, dist: district,
    price: num(t.Price), area: num(t.Area), rooms, floor, year: t.Build_year ?? null,
    czynsz: num(t.Rent), agency, dev, seller: ad.agency?.name ?? ad.owner?.name ?? null,
    ready: !needsReno, own, extras,
  }];
}
