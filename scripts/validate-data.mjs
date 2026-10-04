import fs from 'node:fs';

const file = new URL('../src/data/places.json', import.meta.url);
const places = JSON.parse(fs.readFileSync(file, 'utf8'));
const required = ['slug', 'name', 'town', 'region', 'latitude', 'longitude', 'categories', 'summary', 'website', 'sourceUrl', 'status', 'lastChecked'];
const slugs = new Set();
const problems = [];

for (const [index, place] of places.entries()) {
  for (const field of required) {
    if (place[field] === undefined || place[field] === null || place[field] === '') problems.push(`#${index + 1} ${place.name || '(unnamed)'}: missing ${field}`);
  }

  if (slugs.has(place.slug)) problems.push(`${place.name}: duplicate slug ${place.slug}`);
  slugs.add(place.slug);

  if (!Array.isArray(place.categories) || place.categories.length === 0) problems.push(`${place.name}: categories must be a non-empty array`);
  if (!Number.isFinite(place.latitude) || place.latitude < -44 || place.latitude > -39) problems.push(`${place.name}: latitude looks outside Tasmania`);
  if (!Number.isFinite(place.longitude) || place.longitude < 143 || place.longitude > 149) problems.push(`${place.name}: longitude looks outside Tasmania`);

  for (const field of ['website', 'sourceUrl']) {
    try {
      const url = new URL(place[field]);
      if (!['http:', 'https:'].includes(url.protocol)) problems.push(`${place.name}: ${field} must be HTTP(S)`);
    } catch {
      problems.push(`${place.name}: invalid ${field}`);
    }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(place.lastChecked)) problems.push(`${place.name}: lastChecked must be YYYY-MM-DD`);
}

if (problems.length) {
  console.error(`Data validation failed with ${problems.length} problem(s):`);
  problems.forEach((problem) => console.error(`- ${problem}`));
  process.exit(1);
}

console.log(`Validated ${places.length} TassieNow seed listings.`);
