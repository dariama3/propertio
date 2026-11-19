// Розбір оголошення Morizon. Дані беруться з вбудованого JSON сторінки (Nuxt, формат devalue).
// Приклад: https://www.morizon.pl/oferta/sprzedaz-mieszkanie-warszawa-ursynow-braci-wagow-32m2-mzn2048168273
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

// Розгортає плаский масив devalue (посилання за індексами) у звичайні об'єкти.
function decodeNuxt(flat) {
  const memo = new Map();
  const get = (i) => {
    if (typeof i !== 'number') return i;
    if (i < 0) return i === -3 ? NaN : i === -4 ? Infinity : i === -5 ? -Infinity : undefined;
    if (memo.has(i)) return memo.get(i);
    const v = flat[i];
    let out;
    if (Array.isArray(v)) {
      if (typeof v[0] === 'string' && /^(Shallow)?(Reactive|Ref)$|^Empty(Shallow)?Ref$/.test(v[0])) {
        out = v.length > 1 ? get(v[1]) : undefined;
      } else if (typeof v[0] === 'string' && ['Set', 'Map', 'Date', 'BigInt', 'RegExp', 'null', 'undefined', 'NaN'].includes(v[0])) {
        out = null; // для наших полів не потрібні
      } else {
        out = []; memo.set(i, out);
        for (const x of v) out.push(get(x));
      }
    } else if (v && typeof v === 'object') {
      out = {}; memo.set(i, out);
      for (const k of Object.keys(v)) out[k] = get(v[k]);
    } else out = v;
    memo.set(i, out);
    return out;
  };
  return get(0);
}

function findProperty(root) {
  for (const entry of Object.values(root?.data || {})) {
    const p = entry?.data?.propertyData;
    if (p) return p;
  }
  return null;
}

const strip = h => String(h || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const toNum = v => {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.').replace(/[^\d.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
};

export async function parseMorizon(rawUrl) {
  let u;
  try { u = new URL(String(rawUrl || '').trim()); } catch { return [400, { error: 'Invalid link', code: 'bad_url' }]; }
  if (u.protocol !== 'https:' || !['www.morizon.pl', 'morizon.pl'].includes(u.hostname.toLowerCase())) {
    return [400, { error: 'Unsupported link', code: 'host' }];
  }
  let res;
  try {
    res = await fetch(u.href, { headers: { 'User-Agent': UA, 'Accept-Language': 'pl,uk;q=0.8,en;q=0.5' },
      redirect: 'follow', signal: AbortSignal.timeout(15000) });
  } catch (e) { return [502, { error: 'Morizon did not respond', code: 'no_response' }]; }
  if (res.status !== 200) return [502, { error: `Morizon did not respond (code ${res.status})`, code: 'bad_status', status: res.status }];
  if (!/(^|\.)morizon\.pl$/i.test(new URL(res.url).hostname)) return [400, { error: 'Redirect to an external site was blocked', code: 'redirect' }];
  const html = await res.text();
  const m = html.match(/<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return [502, { error: 'Could not find the listing data', code: 'no_data' }];
  let p;
  try { p = findProperty(decodeNuxt(JSON.parse(m[1]))); } catch { p = null; }
  if (!p) return [404, { error: 'Listing not found (it may be inactive)', code: 'not_found' }];

  // Таблиці «ярлик → значення» (назви полів польською, регістр не важливий)
  const rows = [...(p.detailedInformation || []), ...(p.buildingDetailedInformation || [])];
  const info = re => rows.find(r => re.test(r.label || ''))?.value ?? null;
  const desc = strip(p.description);
  const descL = desc.toLowerCase();

  const price = toNum(p.price?.amount);
  const area = toNum(p.area);
  const rooms = p.numberOfRoomsCount ?? toNum(info(/^liczba pokoi/i));
  const flr = info(/^piętro$/i), total = info(/^liczba pięter/i);
  let floor = null;
  if (flr) floor = String(flr).replace(/\s*\/\s*/, ' / ');
  else if (p.floor != null) floor = String(p.floor) + (total ? ' / ' + total : '');
  // Якщо в таблиці року немає, шукаємо в описі («w bloku z 2001 roku», «rok budowy: 1975»)
  const ym = desc.match(/rok(?:u)? budowy:?\s*((?:18|19|20)\d\d)|(?:bloku|budynku|kamienicy|domu)\s+z\s+((?:18|19|20)\d\d)/i);
  const year = info(/^rok budowy/i) ?? (ym ? (ym[1] || ym[2]) : null);
  const locs = p.location?.location || [];
  const district = locs.length >= 3 ? locs[locs.length - 1] : null;

  // Вулиці в структурованих даних немає — шукаємо в описі («przy ul. Oskara Langego 6»)
  const sm = desc.match(/(?:ul\.|ulicy|al\.|alei|aleja|aleje)\s+((?:\p{Lu}[\p{L}.\-]*\s+){0,2}\p{Lu}[\p{L}\-]*(?:\s\d+[A-Za-z]?(?:\/\d+)?)?)/u);
  const street = p.location?.street || (sm ? sm[1].trim() : null);

  const cond = String(info(/^stan nieruchomości/i) || '');
  // Опис може прямо казати, що ремонт не потрібен, навіть якщо згадує «do odświeżenia»
  const moveIn = /zamieszka\p{L}*\s+od razu|gotow\p{L}* do (?:zamieszkania|wprowadzenia)|nie wymaga remontu|bez (?:potrzeby|konieczności) remontu/u.test(descL);
  const needsReno = /^do\s/i.test(cond)
    || (!moveIn && /do remontu|do własnej aranżacji|do aranżacji|do generalnego remontu|wymaga remontu|do wykończenia/u.test(descL));

  // Форма власності та KW (якщо вказані; інакше — з опису, як і в Otodom)
  const ownLabel = String(info(/własno|forma własności/i) || '').toLowerCase();
  let own = 'unknown';
  if (/pełn/.test(ownLabel) || /pełn\p{L}* własno/u.test(descL)) own = 'full';
  else if (/wieczyst/.test(ownLabel) || /użytkowani\p{L}* wieczyst/u.test(descL)) own = 'perp';
  else if (/spółdziel/.test(ownLabel) || /spółdziel\p{L}* własnościow/u.test(descL)) {
    if (/brak kw|bez kw|bez księgi|nie posiada kw|nie ma kw|założeni\p{L}*\s+ksi\p{L}*|założyć\s+ksi\p{L}*|bez wydzielon\p{L}*\s+ksi\p{L}*/u.test(descL)) own = 'coop_nokw';
    else if (/(^|[^\p{L}])kw([^\p{L}]|$)|księg\p{L}*\s+wieczyst/u.test(descL)) own = 'coop_kw';
    else own = 'coop';
  }

  const person = p.contact?.person || {};
  const agency = !!p.contact?.company || (person.type && person.type !== 'OWNER');

  const extras = [];
  const fac = (p.facilities || []).map(f => String(f.label || '').toLowerCase()).join(' | ');
  const no = w => new RegExp('bez\\s+' + w, 'u').test(descL);
  if (/winda/.test(fac) || (/wind[aąę](?!\p{L})/u.test(descL) && !no('wind'))) extras.push('lift');
  if (/piwnic/.test(fac) || /piwnic/.test(descL)) extras.push('basement');
  if (/^tak/i.test(info(/^balkon/i) || '') || (/balkon/.test(descL) && !no('balkon'))) extras.push('balcony');
  if (/^tak/i.test(info(/^loggia/i) || '')) extras.push('loggia');
  if (/^tak/i.test(info(/^taras/i) || '')) extras.push('terrace');
  if (/^osobna/i.test(info(/^typ kuchni/i) || '') || /osobn\p{L}*\s+kuchni|kuchni\p{L}*\s+osobn/u.test(descL)) extras.push('separate_kitchen');
  if (/garaż/.test(fac)) extras.push('garage');
  if (/ogród|ogródek/.test(fac)) extras.push('garden');
  if (/komórk\p{L}* lokatorsk/u.test(descL)) extras.push('usable_room');
  if (/umeblowan|meble/.test(descL) || (p.equipments || []).some(e => /mebl/i.test(e.label || e))) extras.push('furniture');

  const title = p.title || p.headerTitle || '';
  return [200, {
    url: p.url ? new URL(p.url, 'https://www.morizon.pl').href : res.url,
    title, name: street || title, loc: street, dist: district,
    price, area, rooms, floor, year: year ?? null,
    czynsz: toNum(info(/czynsz|opłaty miesięczne/i)), agency,
    seller: p.contact?.company?.name ?? person.name?.trim() ?? null,
    ready: !needsReno, own, extras,
  }];
}
