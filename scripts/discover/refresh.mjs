import fs from 'node:fs/promises';
import { regionFor } from './lib/regions.mjs';

const PLACES_FILE = new URL('../../src/data/places.json', import.meta.url);
const EVENTS_FILE = new URL('../../src/data/events.json', import.meta.url);
const USER_AGENT = 'TassieNow/0.3 (+https://tassienow.pages.dev)';
const TAS_BBOX = '-43.75,143.55,-39.15,148.65';
const TARGET_GENERATED_PLACES = 420;
const TODAY = new Date().toISOString().slice(0, 10);

const EVENT_SOURCES = [
  { name: 'City of Hobart', url: 'https://www.hobartcity.com.au/Things-To-Do/Upcoming-events', town: 'Hobart', region: 'Hobart & South' },
  { name: 'City of Launceston', url: 'https://www.launceston.tas.gov.au/Upcoming-Events', town: 'Launceston', region: 'Launceston & North' },
  { name: 'Burnie City Council', url: 'https://www.burnie.tas.gov.au/Community/Whats-On-Events', town: 'Burnie', region: 'North West' }
];

const TYPE_LABELS = {
  attraction: ['Things to Do'], museum: ['Museums', 'Art & Culture', 'Rainy Day'], gallery: ['Art & Culture', 'Rainy Day'],
  zoo: ['Wildlife', 'Family'], aquarium: ['Wildlife', 'Family', 'Rainy Day'], theme_park: ['Family'],
  viewpoint: ['Nature & Walks', 'Outdoor'], marketplace: ['Markets', 'Food & Drink'], farm: ['Local Produce', 'Food & Drink'],
  nature_reserve: ['Nature & Walks', 'Outdoor'], playground: ['Family', 'Outdoor'], beach: ['Nature & Walks', 'Outdoor'],
  winery: ['Food & Drink', 'Local Produce'], brewery: ['Food & Drink', 'Local Produce'], distillery: ['Food & Drink', 'Local Produce'],
  hiking: ['Nature & Walks', 'Outdoor']
};

const MONTHS = { jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12 };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function slugify(value) {
  return String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90);
}

function decodeEntities(value = '') {
  return String(value).replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&ndash;|&#8211;/gi, '–').replace(/&mdash;|&#8212;/gi, '—').replace(/&#x27;/gi, "'");
}
function stripHtml(value = '') { return decodeEntities(String(value).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim(); }
function validHttpUrl(value) { try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol); } catch { return false; } }
function normaliseWebsite(value) {
  if (!value) return null;
  const trimmed = String(value).trim(); const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return validHttpUrl(candidate) ? candidate : null;
}
function haversineKm(aLat, aLon, bLat, bLon) {
  const rad = (value) => value * Math.PI / 180; const dLat = rad(bLat - aLat); const dLon = rad(bLon - aLon);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function sourceKind(tags = {}) {
  if (tags.tourism && TYPE_LABELS[tags.tourism]) return tags.tourism;
  if (tags.amenity === 'marketplace') return 'marketplace';
  if (tags.shop === 'farm') return 'farm';
  if (tags.leisure === 'nature_reserve') return 'nature_reserve';
  if (tags.leisure === 'playground') return 'playground';
  if (tags.natural === 'beach') return 'beach';
  if (tags.craft && ['winery', 'brewery', 'distillery'].includes(tags.craft)) return tags.craft;
  if (tags.route === 'hiking') return 'hiking';
  return null;
}
function categoriesFor(tags = {}, kind) {
  const categories = new Set(TYPE_LABELS[kind] || ['Things to Do']);
  if (tags.fee === 'no') categories.add('Free');
  if (tags.indoor === 'yes') categories.add('Rainy Day');
  if (tags.outdoor === 'yes') categories.add('Outdoor');
  if (tags.family === 'yes' || tags.kids === 'yes' || tags['kids:area'] === 'yes') categories.add('Family');
  return [...categories];
}
function fallbackImage(categories) {
  const value = categories.map((c) => c.toLowerCase()).join('|'); let name = 'discover';
  if (value.includes('event')) name = 'events';
  else if (value.includes('museum') || value.includes('art & culture')) name = 'culture';
  else if (value.includes('wildlife')) name = 'wildlife';
  else if (value.includes('market') || value.includes('local produce') || value.includes('food')) name = 'food';
  else if (value.includes('family')) name = 'family';
  else if (value.includes('nature') || value.includes('outdoor')) name = 'nature';
  return { url: `/images/categories/${name}.svg`, attribution: 'TassieNow', license: 'Site artwork', licenseUrl: null, sourceUrl: null, isFallback: true };
}
function scorePlace(tags, kind) {
  let score = ({ museum: 14, zoo: 14, aquarium: 14, theme_park: 13, gallery: 12, attraction: 11, marketplace: 10, winery: 10, brewery: 9, distillery: 10, nature_reserve: 9, hiking: 9, viewpoint: 8, beach: 7, farm: 7, playground: 5 }[kind] || 4);
  if (tags.website || tags['contact:website']) score += 4;
  if (tags.wikidata || tags.wikipedia || tags.wikimedia_commons) score += 5;
  if (tags.opening_hours) score += 2; if (tags.operator) score += 1; if (tags.fee) score += 1;
  return score;
}
function summaryFor(kind, town, tags) {
  const place = town ? ` in or near ${town}` : ' in Tasmania'; const operator = tags.operator ? ` Operated by ${stripHtml(tags.operator)}.` : '';
  const descriptions = { museum: `Museum${place}.`, gallery: `Gallery and arts destination${place}.`, zoo: `Wildlife attraction${place}.`, aquarium: `Aquarium and wildlife attraction${place}.`, theme_park: `Family attraction${place}.`, attraction: `Visitor attraction${place}.`, viewpoint: `Scenic viewpoint${place}.`, marketplace: `Market${place}.`, farm: `Farm-gate or local-produce destination${place}.`, nature_reserve: `Nature reserve${place}.`, playground: `Named playground or family recreation area${place}.`, beach: `Named beach${place}.`, winery: `Winery or cellar-door destination${place}.`, brewery: `Brewery destination${place}.`, distillery: `Distillery destination${place}.`, hiking: `Named walking or hiking route${place}.` };
  return `${descriptions[kind] || `Visitor destination${place}.`}${operator}`.trim();
}
function coordsFor(element) {
  if (Number.isFinite(element.lat) && Number.isFinite(element.lon)) return [element.lat, element.lon];
  if (Number.isFinite(element.center?.lat) && Number.isFinite(element.center?.lon)) return [element.center.lat, element.center.lon];
  return [null, null];
}
async function fetchText(url, options = {}, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { ...options, headers: { 'user-agent': USER_AGENT, accept: '*/*', ...(options.headers || {}) }, signal: AbortSignal.timeout(options.timeout || 60000) });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.text();
    } catch (error) { lastError = error; if (attempt < attempts) await sleep(1000 * attempt); }
  }
  throw lastError;
}
const fetchJson = async (url, options = {}, attempts = 3) => JSON.parse(await fetchText(url, options, attempts));

async function fetchOverpass() {
  const query = `[out:json][timeout:120];(nwr["tourism"~"^(attraction|museum|gallery|zoo|aquarium|theme_park|viewpoint)$"]["name"](${TAS_BBOX});nwr["amenity"="marketplace"]["name"](${TAS_BBOX});nwr["shop"="farm"]["name"](${TAS_BBOX});nwr["leisure"="nature_reserve"]["name"](${TAS_BBOX});nwr["leisure"="playground"]["name"](${TAS_BBOX});nwr["natural"="beach"]["name"](${TAS_BBOX});nwr["craft"~"^(winery|brewery|distillery)$"]["name"](${TAS_BBOX});rel["route"="hiking"]["name"](${TAS_BBOX});nwr["place"~"^(city|town|village)$"]["name"](${TAS_BBOX}););out body center;`;
  const endpoints = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']; let lastError;
  for (const endpoint of endpoints) {
    try {
      const data = await fetchJson(endpoint, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ data: query }).toString(), timeout: 150000 }, 2);
      console.log(`Overpass returned ${data.elements?.length || 0} elements from ${endpoint}.`); return data;
    } catch (error) { lastError = error; console.warn(`Overpass source failed (${endpoint}): ${error.message}`); }
  }
  throw lastError;
}
function nearestLocality(lat, lon, localities) {
  let best = null; let distance = Infinity;
  for (const locality of localities) { const d = haversineKm(lat, lon, locality.latitude, locality.longitude); if (d < distance) { best = locality; distance = d; } }
  return distance <= 70 ? best?.name || '' : '';
}
async function wikidataImages(ids) {
  const result = new Map(); const unique = [...new Set(ids.filter(Boolean))];
  for (let i = 0; i < unique.length; i += 50) {
    const batch = unique.slice(i, i + 50); const url = new URL('https://www.wikidata.org/w/api.php');
    url.searchParams.set('action', 'wbgetentities'); url.searchParams.set('format', 'json'); url.searchParams.set('props', 'claims'); url.searchParams.set('ids', batch.join('|'));
    try { const data = await fetchJson(url, {}, 2); for (const id of batch) { const filename = data.entities?.[id]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value; if (filename) result.set(id, filename); } } catch (error) { console.warn(`Wikidata image batch failed: ${error.message}`); }
    await sleep(100);
  }
  return result;
}
async function commonsImages(titles) {
  const result = new Map(); const unique = [...new Set(titles.filter(Boolean).map((title) => title.replace(/^File:/i, '')))];
  for (let i = 0; i < unique.length; i += 30) {
    const batch = unique.slice(i, i + 30); const url = new URL('https://commons.wikimedia.org/w/api.php');
    url.searchParams.set('action', 'query'); url.searchParams.set('format', 'json'); url.searchParams.set('prop', 'imageinfo'); url.searchParams.set('iiprop', 'url|extmetadata'); url.searchParams.set('iiurlwidth', '1200'); url.searchParams.set('titles', batch.map((v) => `File:${v}`).join('|'));
    try {
      const data = await fetchJson(url, {}, 2);
      for (const page of Object.values(data.query?.pages || {})) {
        const info = page.imageinfo?.[0]; if (!info) continue; const filename = page.title.replace(/^File:/i, ''); const meta = info.extmetadata || {};
        result.set(filename, { url: info.thumburl || info.url, sourceUrl: info.descriptionurl || null, attribution: stripHtml(meta.Artist?.value || meta.Credit?.value || '') || 'Wikimedia Commons contributor', license: stripHtml(meta.LicenseShortName?.value || meta.UsageTerms?.value || 'Wikimedia Commons'), licenseUrl: meta.LicenseUrl?.value || null, isFallback: false });
      }
    } catch (error) { console.warn(`Commons image batch failed: ${error.message}`); }
    await sleep(100);
  }
  return result;
}
function selectBalanced(records, limit) {
  const byRegion = new Map();
  for (const record of records.sort((a, b) => b.discoveryScore - a.discoveryScore || a.name.localeCompare(b.name))) { if (!byRegion.has(record.region)) byRegion.set(record.region, []); byRegion.get(record.region).push(record); }
  const result = []; const regions = [...byRegion.keys()].sort(); let cursor = 0;
  while (result.length < limit && regions.some((r) => byRegion.get(r).length)) { const bucket = byRegion.get(regions[cursor % regions.length]); if (bucket.length) result.push(bucket.shift()); cursor += 1; }
  return result;
}
function dedupeGenerated(records, curated) {
  const accepted = []; const names = new Set(curated.map((p) => p.name.toLowerCase().replace(/[^a-z0-9]/g, '')));
  for (const record of records) {
    const normalName = record.name.toLowerCase().replace(/[^a-z0-9]/g, ''); if (!normalName || names.has(normalName)) continue;
    if (curated.some((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && haversineKm(record.latitude, record.longitude, p.latitude, p.longitude) < 0.08)) continue;
    if (accepted.some((p) => p.name.toLowerCase() === record.name.toLowerCase() || (haversineKm(record.latitude, record.longitude, p.latitude, p.longitude) < 0.05 && p.categories[0] === record.categories[0]))) continue;
    accepted.push(record); names.add(normalName);
  }
  return accepted;
}
async function discoverPlaces() {
  console.log('Discovering Tasmanian places from OpenStreetMap…'); const data = await fetchOverpass();
  const localities = data.elements.filter((e) => e.tags?.place && ['city', 'town', 'village'].includes(e.tags.place) && e.tags.name).map((e) => { const [latitude, longitude] = coordsFor(e); return { name: e.tags.name, latitude, longitude }; }).filter((v) => Number.isFinite(v.latitude) && Number.isFinite(v.longitude));
  const candidates = []; const kindCounts = {};
  for (const element of data.elements) {
    const tags = element.tags || {}; const kind = sourceKind(tags); if (!kind || !tags.name || tags.access === 'private' || tags.access === 'no') continue;
    const [latitude, longitude] = coordsFor(element); if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -44 || latitude > -39 || longitude < 143 || longitude > 149) continue;
    const town = tags['addr:city'] || tags['addr:town'] || tags['addr:suburb'] || tags['addr:place'] || nearestLocality(latitude, longitude, localities) || 'Tasmania';
    const categories = categoriesFor(tags, kind); const commonsTitle = tags.wikimedia_commons?.startsWith('File:') ? tags.wikimedia_commons.replace(/^File:/, '') : null;
    candidates.push({ slug: slugify(tags.name), name: stripHtml(tags.name), town: stripHtml(town), region: regionFor(latitude, longitude, town), latitude, longitude, categories, summary: summaryFor(kind, town, tags), website: normaliseWebsite(tags.website || tags['contact:website']), sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`, sourceType: 'openstreetmap', sourceId: `${element.type}/${element.id}`, wikidata: tags.wikidata || null, wikipedia: tags.wikipedia || null, commonsTitle, status: 'active', lastChecked: TODAY, discoveryScore: scorePlace(tags, kind), image: null });
    kindCounts[kind] = (kindCounts[kind] || 0) + 1;
  }
  console.log(`Usable OSM candidates: ${candidates.length}; kinds: ${JSON.stringify(kindCounts)}.`);
  const current = JSON.parse(await fs.readFile(PLACES_FILE, 'utf8'));
  const curated = current.filter((p) => p.sourceType !== 'openstreetmap').map((p) => ({ ...p, sourceType: p.sourceType || 'curated', image: p.image || { ...fallbackImage(p.categories || []), alt: `${p.name} category image` } }));
  const selected = selectBalanced(dedupeGenerated(candidates, curated), TARGET_GENERATED_PLACES);
  const wdMap = await wikidataImages(selected.map((p) => p.wikidata));
  for (const p of selected) if (!p.commonsTitle && p.wikidata && wdMap.has(p.wikidata)) p.commonsTitle = wdMap.get(p.wikidata);
  const commonsMap = await commonsImages(selected.map((p) => p.commonsTitle));
  for (const p of selected) {
    const commons = p.commonsTitle ? commonsMap.get(p.commonsTitle) : null;
    p.image = commons ? { ...commons, alt: `${p.name}, Tasmania` } : { ...fallbackImage(p.categories), alt: `${p.name} category image` };
    delete p.commonsTitle; delete p.discoveryScore;
  }
  const merged = [...curated, ...selected].sort((a, b) => a.region.localeCompare(b.region) || a.town.localeCompare(b.town) || a.name.localeCompare(b.name));
  await fs.writeFile(PLACES_FILE, `${JSON.stringify(merged, null, 2)}\n`); console.log(`Places: ${curated.length} curated + ${selected.length} discovered = ${merged.length}.`);
}

function flattenJsonLd(value, output = []) {
  if (!value) return output; if (Array.isArray(value)) { value.forEach((v) => flattenJsonLd(v, output)); return output; } if (typeof value !== 'object') return output;
  const type = value['@type']; if ((Array.isArray(type) ? type : [type]).includes('Event')) output.push(value);
  for (const child of Object.values(value)) if (typeof child === 'object') flattenJsonLd(child, output); return output;
}
function extractJsonLd(html) {
  const events = []; const regex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(regex)) { try { flattenJsonLd(JSON.parse(match[1].trim()), events); } catch {} }
  return events;
}
function dateFromParts(day, monthText, year) {
  const month = MONTHS[String(monthText).toLowerCase()]; if (!month) return null;
  const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const parsed = new Date(`${date}T00:00:00Z`); return Number.isNaN(parsed.valueOf()) ? null : date;
}
function eventDate(value) { if (!value) return null; const parsed = new Date(value); return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString().slice(0, 10); }
function htmlLines(html) {
  return decodeEntities(String(html).replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(?:br\s*\/?|\/p|\/div|\/li|\/article|\/a|\/h[1-6]|\/section)>/gi, '\n').replace(/<[^>]+>/g, ' '))
    .split(/\n+/).map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
}
function extractTextEvents(html, source) {
  const lines = htmlLines(html); const output = [];
  const dateRe = /(?:^|\b)(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(20\d{2})(?:\b|\s*[-–—:]\s*)(.*)$/i;
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(dateRe); if (!match) continue;
    const startDate = dateFromParts(match[1], match[2], match[3]); if (!startDate || startDate < TODAY) continue;
    const horizon = new Date(); horizon.setUTCDate(horizon.getUTCDate() + 240); if (startDate > horizon.toISOString().slice(0, 10)) continue;
    let name = stripHtml(match[4] || '');
    if (name.length < 3 && lines[i + 1] && !dateRe.test(lines[i + 1])) name = stripHtml(lines[i + 1]);
    name = name.replace(/^(event|what'?s on|calendar)\s*[:–—-]?\s*/i, '').trim();
    if (name.length < 3 || name.length > 160 || /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i.test(name)) continue;
    const categories = ['Events']; const context = `${name} ${lines[i + 1] || ''}`; if (/\bfree\b/i.test(context)) categories.push('Free'); if (/family|kids|children|child/i.test(context)) categories.push('Family');
    output.push({ slug: slugify(`${name}-${startDate}-${source.town}`), name, town: source.town, region: source.region, startDate, endDate: startDate, categories, summary: `${name} in ${source.town}. Check the official ${source.name} listing for current time, venue and booking details.`, eventUrl: source.url, sourceUrl: source.url, sourceName: source.name, image: { ...fallbackImage(['Events']), alt: `${name} event category image` }, status: 'active', lastChecked: TODAY });
  }
  return output;
}
async function discoverEvents() {
  const found = [];
  for (const source of EVENT_SOURCES) {
    try {
      const html = await fetchText(source.url, { timeout: 45000 }, 2); const items = extractJsonLd(html); let sourceCount = 0;
      for (const event of items) {
        const startDate = eventDate(event.startDate); const endDate = eventDate(event.endDate || event.startDate); if (!startDate || !endDate || endDate < TODAY) continue;
        const horizon = new Date(); horizon.setUTCDate(horizon.getUTCDate() + 240); if (startDate > horizon.toISOString().slice(0, 10)) continue;
        const name = stripHtml(event.name); if (!name) continue; const town = stripHtml(event.location?.address?.addressLocality || event.location?.name || source.town); const description = stripHtml(event.description || '').slice(0, 280);
        const categories = ['Events']; if (/\bfree\b/i.test(description)) categories.push('Free'); if (/family|kids|children/i.test(description)) categories.push('Family');
        const eventUrl = validHttpUrl(event.url) ? event.url : source.url;
        found.push({ slug: slugify(`${name}-${startDate}-${town}`), name, town, region: source.region, startDate, endDate, categories, summary: description || `Event in ${town}. Check the official event source for current details.`, eventUrl, sourceUrl: source.url, sourceName: source.name, image: { ...fallbackImage(['Events']), alt: `${name} event category image` }, status: 'active', lastChecked: TODAY }); sourceCount += 1;
      }
      if (sourceCount === 0) { const textEvents = extractTextEvents(html, source); found.push(...textEvents); sourceCount = textEvents.length; console.log(`${source.name}: JSON-LD absent; HTML fallback found ${sourceCount} candidate(s).`); }
      else console.log(`${source.name}: ${sourceCount} Event JSON-LD candidate(s).`);
    } catch (error) { console.warn(`Event source failed (${source.name}): ${error.message}`); }
  }
  const unique = []; const keys = new Set();
  for (const event of found) { const key = `${event.name.toLowerCase()}|${event.startDate}|${event.town.toLowerCase()}`; if (!keys.has(key)) { keys.add(key); unique.push(event); } }
  unique.sort((a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name)); await fs.writeFile(EVENTS_FILE, `${JSON.stringify(unique, null, 2)}\n`); console.log(`Events: ${unique.length} active event(s) discovered.`);
}

await discoverPlaces();
await discoverEvents();
