import fs from 'node:fs/promises';
import { regionFor } from './discover/lib/regions.mjs';

const FILE = new URL('../src/data/places.json', import.meta.url);
const places = JSON.parse(await fs.readFile(FILE, 'utf8'));
const generated = new Set(['openstreetmap', 'wikidata']);
let changed = 0;

for (const place of places) {
  if (!generated.has(place.sourceType)) continue;
  if (!Number.isFinite(place.latitude) || !Number.isFinite(place.longitude)) continue;
  const next = regionFor(place.latitude, place.longitude, place.town);
  if (next === place.region) continue;
  place.region = next;
  changed += 1;
}

if (changed) {
  places.sort((a, b) => a.region.localeCompare(b.region) || a.town.localeCompare(b.town) || a.name.localeCompare(b.name));
  await fs.writeFile(FILE, JSON.stringify(places, null, 2) + '\n');
}

console.log(`Reclassified ${changed} generated listing(s).`);
