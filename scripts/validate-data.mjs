import fs from 'node:fs';

const placesFile = new URL('../src/data/places.json', import.meta.url);
const eventsFile = new URL('../src/data/events.json', import.meta.url);
const places = JSON.parse(fs.readFileSync(placesFile, 'utf8'));
const events = fs.existsSync(eventsFile) ? JSON.parse(fs.readFileSync(eventsFile, 'utf8')) : [];
const problems = [];
const placeSlugs = new Set();
const eventSlugs = new Set();

function validHttpUrl(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

function validateImage(item, label) {
  if (!item.image || typeof item.image !== 'object') {
    problems.push(`${label}: missing image object`);
    return;
  }
  if (!item.image.url || !(item.image.url.startsWith('/') || validHttpUrl(item.image.url))) {
    problems.push(`${label}: invalid image URL`);
  }
  if (!item.image.alt) problems.push(`${label}: missing image alt text`);
  if (!item.image.attribution) problems.push(`${label}: missing image attribution`);
  if (!item.image.license) problems.push(`${label}: missing image licence/provenance`);
}

const requiredPlaceFields = ['slug', 'name', 'town', 'region', 'latitude', 'longitude', 'categories', 'summary', 'sourceUrl', 'status', 'lastChecked'];
for (const [index, place] of places.entries()) {
  const label = `#${index + 1} ${place.name || '(unnamed place)'}`;
  for (const field of requiredPlaceFields) {
    if (place[field] === undefined || place[field] === null || place[field] === '') problems.push(`${label}: missing ${field}`);
  }
  if (placeSlugs.has(place.slug)) problems.push(`${label}: duplicate slug ${place.slug}`);
  placeSlugs.add(place.slug);
  if (!Array.isArray(place.categories) || place.categories.length === 0) problems.push(`${label}: categories must be a non-empty array`);
  if (!Number.isFinite(place.latitude) || place.latitude < -44 || place.latitude > -39) problems.push(`${label}: latitude looks outside Tasmania`);
  if (!Number.isFinite(place.longitude) || place.longitude < 143 || place.longitude > 149) problems.push(`${label}: longitude looks outside Tasmania`);
  if (!validHttpUrl(place.sourceUrl)) problems.push(`${label}: invalid sourceUrl`);
  if (place.website !== null && place.website !== undefined && place.website !== '' && !validHttpUrl(place.website)) problems.push(`${label}: invalid website`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(place.lastChecked || '')) problems.push(`${label}: lastChecked must be YYYY-MM-DD`);
  validateImage(place, label);
}

const today = new Date().toISOString().slice(0, 10);
for (const [index, event] of events.entries()) {
  const label = `event #${index + 1} ${event.name || '(unnamed event)'}`;
  for (const field of ['slug', 'name', 'town', 'region', 'startDate', 'endDate', 'categories', 'summary', 'sourceUrl', 'status', 'lastChecked']) {
    if (event[field] === undefined || event[field] === null || event[field] === '') problems.push(`${label}: missing ${field}`);
  }
  if (eventSlugs.has(event.slug)) problems.push(`${label}: duplicate slug ${event.slug}`);
  eventSlugs.add(event.slug);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(event.startDate || '') || !/^\d{4}-\d{2}-\d{2}$/.test(event.endDate || '')) problems.push(`${label}: invalid event date`);
  if (event.endDate && event.endDate < today && event.status === 'active') problems.push(`${label}: expired event is still active`);
  if (!Array.isArray(event.categories) || event.categories.length === 0) problems.push(`${label}: categories must be a non-empty array`);
  if (!validHttpUrl(event.sourceUrl)) problems.push(`${label}: invalid sourceUrl`);
  if (event.eventUrl && !validHttpUrl(event.eventUrl)) problems.push(`${label}: invalid eventUrl`);
  validateImage(event, label);
}

if (problems.length) {
  console.error(`Data validation failed with ${problems.length} problem(s):`);
  problems.forEach((problem) => console.error(`- ${problem}`));
  process.exit(1);
}

console.log(`Validated ${places.length} places and ${events.length} active events.`);
