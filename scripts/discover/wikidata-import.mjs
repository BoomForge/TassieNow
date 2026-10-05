import fs from 'node:fs/promises';

const FILE = new URL('../../src/data/places.json', import.meta.url);
const USER_AGENT = 'TassieNow/1.1 (+https://tassienow.pages.dev)';
const SPARQL = 'https://query.wikidata.org/sparql';
const MAX_NEW = 180;

function tasDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Hobart', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
const TODAY = tasDate();
const slugify = (value) => String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90);
const norm = (value = '') => String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const clean = (value = '') => String(value).replace(/<[^>]*>/g, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/\s+/g, ' ').trim();
function validUrl(value) { try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; } catch { return null; } }
function inTasmania(lat, lon) { return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -44 && lat <= -39 && lon >= 143 && lon <= 149; }
function km(a, b, c, d) { const r = (x) => x * Math.PI / 180; const dy = r(c - a), dx = r(d - b), z = Math.sin(dy / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(dx / 2) ** 2; return 6371 * 2 * Math.atan2(Math.sqrt(z), Math.sqrt(1 - z)); }
function region(lat, lon, town = '') {
  const t = town.toLowerCase();
  if (['currie', 'grassy', 'naracoopa', 'king island'].some((v) => t.includes(v)) || lon < 144.35) return 'King Island';
  if (['whitemark', 'lady barron', 'flinders island'].some((v) => t.includes(v)) || (lat > -40.8 && lon > 147.55)) return 'Flinders Island';
  if (['queenstown', 'strahan', 'zeehan', 'rosebery', 'tullah'].some((v) => t.includes(v)) || (lon < 145.65 && lat < -41.4)) return 'West Coast';
  if (['stanley', 'smithton', 'burnie', 'wynyard', 'penguin', 'ulverstone', 'devonport', 'latrobe', 'sheffield', 'cradle mountain'].some((v) => t.includes(v)) || (lat > -42.05 && lon < 146.65)) return 'North West';
  if (['launceston', 'george town', 'deloraine', 'longford', 'evandale', 'scottsdale', 'derby', 'bridport', 'beaconsfield'].some((v) => t.includes(v)) || (lat > -42.05 && lon >= 146.65 && lon < 148)) return 'Launceston & North';
  if (['st helens', 'bicheno', 'swansea', 'coles bay', 'orford', 'triabunna', 'scamander'].some((v) => t.includes(v)) || (lon >= 147.75 && lat <= -40.8 && lat > -43.25)) return 'East Coast';
  if (['hobart', 'richmond', 'sorell', 'huon', 'cygnet', 'geeveston', 'dover', 'port arthur', 'new norfolk', 'bruny'].some((v) => t.includes(v)) || lat <= -42.05) return 'Hobart & South';
  return 'Central Tasmania';
}
function fallback(categories, name) {
  const value = categories.join('|').toLowerCase(); let type = 'discover';
  if (value.includes('museum') || value.includes('art & culture')) type = 'culture';
  else if (value.includes('wildlife')) type = 'wildlife';
  else if (value.includes('market') || value.includes('food')) type = 'food';
  else if (value.includes('nature') || value.includes('outdoor')) type = 'nature';
  return { url: `/images/categories/${type}.svg`, alt: `${name} category image`, attribution: 'TassieNow', license: 'Site artwork', licenseUrl: null, sourceUrl: null, isFallback: true };
}

const CLASS_MAP = {
  Q570116: { categories: ['Things to Do'], summary: 'Visitor attraction' },
  Q33506: { categories: ['Museums', 'Art & Culture', 'Rainy Day'], summary: 'Museum' },
  Q1007870: { categories: ['Art & Culture', 'Rainy Day'], summary: 'Art gallery' },
  Q43501: { categories: ['Wildlife', 'Family'], summary: 'Zoo or wildlife attraction' },
  Q40080: { categories: ['Nature & Walks', 'Outdoor', 'Free'], summary: 'Beach' },
  Q179049: { categories: ['Nature & Walks', 'Outdoor'], summary: 'Nature reserve' }
};

async function fetchJson(url, attempts = 3) {
  let last;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      const response = await fetch(url, { headers: { 'user-agent': USER_AGENT, accept: 'application/sparql-results+json,application/json' }, signal: AbortSignal.timeout(45000) });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.json();
    } catch (error) { last = error; if (i < attempts) await new Promise((resolve) => setTimeout(resolve, i * 1200)); }
  }
  throw last;
}
function parsePoint(value = '') {
  const match = String(value).match(/Point\(([-\d.]+)\s+([-\d.]+)\)/i);
  if (!match) return [null, null];
  return [Number(match[2]), Number(match[1])];
}
function qid(uri = '') { return String(uri).match(/\/entity\/(Q\d+)$/)?.[1] || null; }

const classes = Object.keys(CLASS_MAP).map((id) => `wd:${id}`).join(' ');
const query = `
SELECT DISTINCT ?item ?itemLabel ?class ?coord ?website ?adminLabel WHERE {
  SERVICE wikibase:box {
    ?item wdt:P625 ?coord .
    bd:serviceParam wikibase:cornerSouthWest "Point(143 -44)"^^geo:wktLiteral .
    bd:serviceParam wikibase:cornerNorthEast "Point(149 -39)"^^geo:wktLiteral .
  }
  VALUES ?class { ${classes} }
  ?item wdt:P31/wdt:P279* ?class .
  OPTIONAL { ?item wdt:P856 ?website . }
  OPTIONAL { ?item wdt:P131 ?admin . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
LIMIT 650`;
const url = new URL(SPARQL);
url.searchParams.set('query', query);
url.searchParams.set('format', 'json');

let data;
try { data = await fetchJson(url); }
catch (error) { console.warn(`Wikidata discovery skipped: ${error.message}`); process.exit(0); }

const current = JSON.parse(await fs.readFile(FILE, 'utf8'));
const existingIds = new Set(current.filter((place) => place.sourceType === 'wikidata' && place.sourceId).map((place) => place.sourceId));
const existingNames = new Set(current.map((place) => norm(place.name)).filter(Boolean));
const candidates = [];
for (const binding of data.results?.bindings || []) {
  const id = qid(binding.item?.value); const classId = qid(binding.class?.value); const config = CLASS_MAP[classId];
  if (!id || !config || existingIds.has(id)) continue;
  const name = clean(binding.itemLabel?.value); if (!name || /^Q\d+$/.test(name) || existingNames.has(norm(name))) continue;
  const [latitude, longitude] = parsePoint(binding.coord?.value); if (!inTasmania(latitude, longitude)) continue;
  const tooClose = current.some((place) => norm(place.name) === norm(name) || (Number.isFinite(place.latitude) && Number.isFinite(place.longitude) && km(latitude, longitude, place.latitude, place.longitude) < 0.08));
  if (tooClose) continue;
  let town = clean(binding.adminLabel?.value || 'Tasmania');
  if (!town || town === 'Tasmania' || /^Q\d+$/.test(town)) town = 'Tasmania';
  const categories = [...config.categories];
  const sourceUrl = `https://www.wikidata.org/wiki/${id}`;
  candidates.push({
    slug: slugify(name), name, town, region: region(latitude, longitude, town), latitude, longitude, categories,
    summary: `${config.summary} in Tasmania. This listing was independently discovered through Wikidata and is cross-checked during TassieNow quality passes.`,
    website: validUrl(binding.website?.value), sourceUrl, sourceType: 'wikidata', sourceId: id, wikidata: id,
    status: 'active', lastChecked: TODAY, image: fallback(categories, name)
  });
}

const usedSlugs = new Set(current.map((place) => place.slug));
const accepted = [];
for (const place of candidates.sort((a, b) => a.region.localeCompare(b.region) || a.name.localeCompare(b.name))) {
  let slug = place.slug; let suffix = 2;
  while (usedSlugs.has(slug)) slug = `${place.slug}-${suffix++}`;
  place.slug = slug; usedSlugs.add(slug); accepted.push(place);
  if (accepted.length >= MAX_NEW) break;
}
if (!accepted.length) { console.log('Wikidata: no new high-confidence places to merge.'); process.exit(0); }
const merged = [...current, ...accepted].sort((a, b) => a.region.localeCompare(b.region) || a.town.localeCompare(b.town) || a.name.localeCompare(b.name));
await fs.writeFile(FILE, `${JSON.stringify(merged, null, 2)}\n`);
console.log(`Wikidata: added ${accepted.length} independent place(s); catalogue now ${merged.length}.`);
