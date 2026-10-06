import fs from 'node:fs/promises';

const FILE = new URL('../src/data/places.json', import.meta.url);
const USER_AGENT = 'TassieNow/1.1 (+https://tassienow.com)';
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Hobart' }).format(new Date());
const OVERPASS = [
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
];
const BATCH = 90;
const SITE_CONCURRENCY = 6;
const SITE_TIMEOUT = 9000;

const clean = (value = '') => String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/\s+/g, ' ').trim();
const normalizeName = (value = '') => clean(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
function httpUrl(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try { const u = new URL(candidate); return ['http:', 'https:'].includes(u.protocol) ? u.href : null; } catch { return null; }
}
function mail(value) { const v = clean(value); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null; }
function phone(value) { return clean(value).replace(/^tel:/i, '') || null; }
function addressFromTags(tags = {}) {
  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).map(clean).join(' ');
  const locality = clean(tags['addr:suburb'] || tags['addr:city'] || tags['addr:town'] || tags['addr:place']);
  const postcode = clean(tags['addr:postcode']);
  const state = clean(tags['addr:state'] || 'TAS');
  const parts = [street, locality, state, postcode].filter(Boolean);
  return parts.length >= 2 ? parts.join(', ') : null;
}
function mergeReviewLinks(place) {
  const links = Array.isArray(place.reviewLinks) ? [...place.reviewLinks] : [];
  const query = `${place.name} ${place.town || ''} Tasmania`.trim();
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  if (!links.some((item) => item?.provider === 'google-maps')) links.push({ provider: 'google-maps', label: 'Reviews & visitor photos on Google Maps', url });
  return links.filter((item) => item?.url && item?.label);
}
function source(type, url) { return { type, url, checkedAt: TODAY }; }

async function fetchText(url, options = {}) {
  const response = await fetch(url, { ...options, redirect: 'follow', headers: { 'user-agent': USER_AGENT, accept: options.accept || '*/*', ...(options.headers || {}) }, signal: AbortSignal.timeout(options.timeout || SITE_TIMEOUT) });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return { text: await response.text(), finalUrl: response.url, contentType: response.headers.get('content-type') || '' };
}
async function overpass(query) {
  let last;
  for (const endpoint of OVERPASS) {
    try {
      const body = new URLSearchParams({ data: query }).toString();
      const { text } = await fetchText(endpoint, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body, timeout: 18000, accept: 'application/json' });
      const data = JSON.parse(text);
      if (data.remark && /runtime error|timed out/i.test(data.remark)) throw new Error(data.remark);
      return data.elements || [];
    } catch (error) { last = error; }
  }
  throw last || new Error('Overpass request failed');
}
function idQuery(records) {
  const ids = { node: [], way: [], relation: [] };
  for (const place of records) {
    const match = /^(node|way|relation)\/(\d+)$/.exec(String(place.sourceId || ''));
    if (match) ids[match[1]].push(match[2]);
  }
  const parts = [];
  for (const type of ['node', 'way', 'relation']) if (ids[type].length) parts.push(`${type}(id:${ids[type].join(',')});`);
  return `[out:json][timeout:25];(${parts.join('')});out tags center;`;
}
function osmFields(tags = {}) {
  return {
    openingHours: clean(tags.opening_hours) || null,
    phone: phone(tags['contact:phone'] || tags.phone),
    email: mail(tags['contact:email'] || tags.email),
    address: addressFromTags(tags),
    bookingUrl: httpUrl(tags.booking || tags.reservation || tags['contact:booking']),
    website: httpUrl(tags.website || tags['contact:website']),
    fee: clean(tags.fee) || null,
    wheelchair: clean(tags.wheelchair) || null,
    operator: clean(tags.operator) || null,
    wikidata: /^Q\\d+$/.test(clean(tags.wikidata)) ? clean(tags.wikidata) : null
  };
}

function flattenLd(value, out = []) {
  if (Array.isArray(value)) { for (const item of value) flattenLd(item, out); return out; }
  if (!value || typeof value !== 'object') return out;
  out.push(value);
  if (value['@graph']) flattenLd(value['@graph'], out);
  return out;
}
function parseLdJson(html) {
  const nodes = [];
  const re = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(re)) {
    const raw = match[1].trim().replace(/^<!--|-->$/g, '').trim();
    if (!raw) continue;
    try { flattenLd(JSON.parse(raw), nodes); } catch { /* malformed publisher JSON-LD */ }
  }
  return nodes;
}
function tokenOverlap(a, b) {
  const aa = new Set(normalizeName(a).split(' ').filter((x) => x.length > 2));
  const bb = new Set(normalizeName(b).split(' ').filter((x) => x.length > 2));
  let n = 0; for (const token of aa) if (bb.has(token)) n++;
  return n;
}
function bestLdNode(nodes, place) {
  const useful = nodes.filter((node) => node && (node.openingHours || node.openingHoursSpecification || node.telephone || node.email || node.address));
  const scored = useful.map((node) => ({ node, overlap: tokenOverlap(node.name || '', place.name), named: Boolean(clean(node.name)) })).sort((a, b) => b.overlap - a.overlap);
  const best = scored[0];
  if (!best) return null;
  if (best.named && best.overlap === 0) return null;
  if (!best.named && useful.length > 1) return null;
  return best.node;
}
const DAY = { Monday: 'Mo', Tuesday: 'Tu', Wednesday: 'We', Thursday: 'Th', Friday: 'Fr', Saturday: 'Sa', Sunday: 'Su', Mo: 'Mo', Tu: 'Tu', We: 'We', Th: 'Th', Fr: 'Fr', Sa: 'Sa', Su: 'Su' };
function dayCode(value) {
  const last = String(value || '').split('/').pop();
  return DAY[last] || DAY[String(value || '')] || clean(value);
}
function hoursFromSpecification(spec) {
  const rows = Array.isArray(spec) ? spec : spec ? [spec] : [];
  return rows.map((row) => {
    const days = (Array.isArray(row.dayOfWeek) ? row.dayOfWeek : row.dayOfWeek ? [row.dayOfWeek] : []).map(dayCode).filter(Boolean).join(',');
    const opens = clean(row.opens), closes = clean(row.closes);
    return [days, opens && closes ? `${opens}-${closes}` : opens || closes].filter(Boolean).join(' ');
  }).filter(Boolean).join('; ') || null;
}
function addressFromLd(value) {
  if (!value) return null;
  if (typeof value === 'string') return clean(value) || null;
  const street = clean(value.streetAddress);
  const locality = clean(value.addressLocality);
  const region = clean(value.addressRegion);
  const postcode = clean(value.postalCode);
  const parts = [street, locality, region, postcode].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}
function officialFields(node = {}) {
  const openingRaw = Array.isArray(node.openingHours) ? node.openingHours.map(clean).filter(Boolean).join('; ') : clean(node.openingHours);
  return {
    openingHours: openingRaw || hoursFromSpecification(node.openingHoursSpecification),
    phone: phone(node.telephone),
    email: mail(node.email),
    address: addressFromLd(node.address),
    bookingUrl: httpUrl(node.reservationUrl || node.bookingUrl)
  };
}
function canFetchWebsite(value) {
  const u = httpUrl(value); if (!u) return null;
  try {
    const host = new URL(u).hostname.replace(/^www\./, '');
    if (/^(facebook|instagram|google|tripadvisor|openstreetmap|wikipedia|wikidata)\./i.test(host)) return null;
    return u;
  } catch { return null; }
}
async function enrichOfficial(place) {
  const website = canFetchWebsite(place.officialSource?.url || place.website);
  if (!website) return null;
  try {
    const { text, finalUrl, contentType } = await fetchText(website, { accept: 'text/html,application/xhtml+xml', timeout: SITE_TIMEOUT });
    if (!/html/i.test(contentType) && !/<html/i.test(text.slice(0, 1000))) return null;
    const node = bestLdNode(parseLdJson(text.slice(0, 2_000_000)), place);
    if (!node) return null;
    return { fields: officialFields(node), url: finalUrl || website };
  } catch { return null; }
}
async function mapLimit(items, limit, worker) {
  let index = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) { const current = items[index++]; await worker(current); }
  });
  await Promise.all(runners);
}
function applyField(place, key, value, srcType, srcUrl) {
  if (value == null || value === '') return false;
  const manual = place.managedManually && place[key];
  const existingSource = place.detailSources?.[key]?.type;
  if (manual || existingSource === 'manual') return false;
  if (srcType === 'openstreetmap' && place[key]) return false;
  if (place[key] === value && existingSource === srcType) return false;
  place[key] = value;
  place.detailSources ||= {};
  place.detailSources[key] = source(srcType, srcUrl);
  return true;
}

const places = JSON.parse(await fs.readFile(FILE, 'utf8'));
const osmPlaces = places.filter((place) => place.sourceType === 'openstreetmap' && /^(node|way|relation)\/\d+$/.test(String(place.sourceId || '')));
const osmTags = new Map();
for (let i = 0; i < osmPlaces.length; i += BATCH) {
  const batch = osmPlaces.slice(i, i + BATCH);
  try {
    const elements = await overpass(idQuery(batch));
    for (const element of elements) osmTags.set(`${element.type}/${element.id}`, element.tags || {});
    console.log(`OSM detail batch ${Math.floor(i / BATCH) + 1}: ${elements.length}/${batch.length} records returned.`);
  } catch (error) { console.warn(`OSM detail batch skipped: ${error.message}`); }
}

let osmChanged = 0;
for (const place of osmPlaces) {
  const tags = osmTags.get(place.sourceId); if (!tags) continue;
  const fields = osmFields(tags), srcUrl = place.sourceUrl || `https://www.openstreetmap.org/${place.sourceId}`;
  for (const key of ['openingHours', 'phone', 'email', 'address', 'bookingUrl', 'fee', 'wheelchair', 'operator']) if (applyField(place, key, fields[key], 'openstreetmap', srcUrl)) osmChanged++;
  if (!place.website && fields.website) { place.website = fields.website; osmChanged++; }
  if (!place.wikidata && fields.wikidata) { place.wikidata = fields.wikidata; osmChanged++; }
}

const websiteTargets = places.filter((place) => place.status === 'active' && canFetchWebsite(place.officialSource?.url || place.website));
let officialChanged = 0, sitesWithStructuredDetails = 0;
await mapLimit(websiteTargets, SITE_CONCURRENCY, async (place) => {
  const result = await enrichOfficial(place); if (!result) return;
  sitesWithStructuredDetails++;
  for (const key of ['openingHours', 'phone', 'email', 'address', 'bookingUrl']) if (applyField(place, key, result.fields[key], 'official-website', result.url)) officialChanged++;
});

for (const place of places) {
  if (place.status !== 'active') continue;
  place.reviewLinks = mergeReviewLinks(place);
  place.lastDetailsChecked = TODAY;
}

await fs.writeFile(FILE, `${JSON.stringify(places, null, 2)}\n`);
const publicPlaces = places.filter((p) => p.status === 'active' && p.visibility !== 'suppressed');
const count = (fn) => publicPlaces.filter(fn).length;
console.log(`Catalogue detail enrichment complete: ${publicPlaces.length} public listing(s). OSM field updates: ${osmChanged}; official-site field updates: ${officialChanged}; structured official sites found: ${sitesWithStructuredDetails}/${websiteTargets.length}.`);
console.log(`Coverage: real images ${count((p) => p.image && !p.image.isFallback)}/${publicPlaces.length}; opening hours ${count((p) => p.openingHours)}/${publicPlaces.length}; phone ${count((p) => p.phone)}/${publicPlaces.length}; address ${count((p) => p.address)}/${publicPlaces.length}; official/website ${count((p) => p.officialSource?.url || p.website)}/${publicPlaces.length}; review links ${count((p) => p.reviewLinks?.length)}/${publicPlaces.length}.`);
