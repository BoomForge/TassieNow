import fs from 'node:fs/promises';
import { retainVerifiedMedia } from './discover/lib/preserve-media.mjs';

const CURRENT_FILE = new URL('../src/data/places.json', import.meta.url);
const previousPath = process.argv[2];
if (!previousPath) throw new Error('Usage: node scripts/merge-previous-catalogue.mjs <previous-places.json>');

const [current, previous] = await Promise.all([
  fs.readFile(CURRENT_FILE, 'utf8').then(JSON.parse),
  fs.readFile(previousPath, 'utf8').then(JSON.parse)
]);

const previousOsm = previous.filter((place) => place.sourceType === 'openstreetmap' && place.sourceId);
const currentOsm = current.filter((place) => place.sourceType === 'openstreetmap' && place.sourceId);
const previousById = new Map(previousOsm.map((place) => [place.sourceId, place]));
const currentIds = new Set(currentOsm.map((place) => place.sourceId));
const nameKey = (place) => String(place.name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const currentNames = new Set(current.map(nameKey).filter(Boolean));
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Hobart' }).format(new Date());

const carryFields = [
  'openingHours', 'phone', 'email', 'address', 'bookingUrl', 'fee', 'wheelchair', 'operator',
  'detailSources', 'reviewLinks', 'lastDetailsChecked', 'officialSource', 'gallery'
];

let carried = 0;
for (const place of currentOsm) {
  const old = previousById.get(place.sourceId);
  if (!old) continue;
  retainVerifiedMedia(place, old);
  for (const field of carryFields) {
    const fresh = place[field];
    if ((fresh == null || fresh === '' || (Array.isArray(fresh) && fresh.length === 0)) && old[field] != null) {
      place[field] = structuredClone(old[field]);
      carried++;
    }
  }
  if (place.discoveryStale) delete place.discoveryStale;
  if (place.discoveryStaleSince) delete place.discoveryStaleSince;
}

const ratio = previousOsm.length ? currentOsm.length / previousOsm.length : 1;
const sourceLooksPartial = previousOsm.length >= 100 && ratio < 0.90;
let restored = 0;
if (sourceLooksPartial) {
  for (const old of previousOsm) {
    if (currentIds.has(old.sourceId)) continue;
    const key = nameKey(old);
    if (key && currentNames.has(key)) continue;
    current.push({
      ...structuredClone(old),
      discoveryStale: true,
      discoveryStaleSince: old.discoveryStaleSince || TODAY
    });
    currentNames.add(key);
    restored++;
  }
}

current.sort((a, b) =>
  String(a.region || '').localeCompare(String(b.region || '')) ||
  String(a.town || '').localeCompare(String(b.town || '')) ||
  String(a.name || '').localeCompare(String(b.name || ''))
);

await fs.writeFile(CURRENT_FILE, `${JSON.stringify(current, null, 2)}\n`);
console.log(`Previous-catalogue merge: ${currentOsm.length}/${previousOsm.length || currentOsm.length} OSM records rediscovered (${(ratio * 100).toFixed(1)}% of prior snapshot); carried ${carried} enriched field(s); restored ${restored} prior record(s)${sourceLooksPartial ? ' because source coverage was incomplete' : ''}.`);
