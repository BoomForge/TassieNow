import fs from 'node:fs/promises';

const placesFile = new URL('../src/data/places.json', import.meta.url);
const places = JSON.parse(await fs.readFile(placesFile, 'utf8'));
const kept = [];
const slugs = new Set();
const names = new Set();
let removed = 0;

function norm(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

for (const place of places) {
  const latitude = Number(place.latitude);
  const longitude = Number(place.longitude);
  const generated = place.sourceType === 'openstreetmap';
  const outOfBounds = !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -44 || latitude > -39 || longitude < 143 || longitude > 149;
  const duplicateSlug = slugs.has(place.slug);
  const duplicateGeneratedName = generated && names.has(norm(place.name));

  if (generated && (outOfBounds || duplicateSlug || duplicateGeneratedName)) {
    console.warn(`Removed generated record: ${place.name} (${outOfBounds ? 'coordinates' : duplicateSlug ? 'slug collision' : 'name collision'})`);
    removed += 1;
    continue;
  }

  // Curated records win collisions because they appear first in the catalogue source.
  if (!duplicateSlug) slugs.add(place.slug);
  names.add(norm(place.name));
  kept.push(place);
}

await fs.writeFile(placesFile, `${JSON.stringify(kept, null, 2)}\n`);
console.log(`Sanitised generated catalogue: kept ${kept.length}, removed ${removed}.`);
