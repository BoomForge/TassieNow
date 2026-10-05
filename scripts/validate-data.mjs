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
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol); } catch { return false; }
}
function hobartDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Hobart', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
function validateImageObject(image, label) {
  if (!image || typeof image !== 'object') { problems.push(`${label}: missing image object`); return; }
  if (!image.url || !(image.url.startsWith('/') || validHttpUrl(image.url))) problems.push(`${label}: invalid image URL`);
  if (!image.alt) problems.push(`${label}: missing image alt text`);
  if (!image.attribution) problems.push(`${label}: missing image attribution`);
  if (!image.license) problems.push(`${label}: missing image licence/provenance`);
  if (image.sourceUrl && !validHttpUrl(image.sourceUrl)) problems.push(`${label}: invalid image sourceUrl`);
}
function validateImage(item, label) { validateImageObject(item.image, label); }

const requiredPlaceFields = ['slug', 'name', 'town', 'region', 'latitude', 'longitude', 'categories', 'summary', 'sourceUrl', 'status', 'lastChecked'];
for (const [index, place] of places.entries()) {
  const label = `#${index + 1} ${place.name || '(unnamed place)'}`;
  for (const field of requiredPlaceFields) if (place[field] === undefined || place[field] === null || place[field] === '') problems.push(`${label}: missing ${field}`);
  if (placeSlugs.has(place.slug)) problems.push(`${label}: duplicate slug ${place.slug}`);
  placeSlugs.add(place.slug);
  if (!Array.isArray(place.categories) || place.categories.length === 0) problems.push(`${label}: categories must be a non-empty array`);
  if (!Number.isFinite(place.latitude) || place.latitude < -44 || place.latitude > -39) problems.push(`${label}: latitude looks outside Tasmania`);
  if (!Number.isFinite(place.longitude) || place.longitude < 143 || place.longitude > 149) problems.push(`${label}: longitude looks outside Tasmania`);
  if (!validHttpUrl(place.sourceUrl)) problems.push(`${label}: invalid sourceUrl`);
  if (place.website !== null && place.website !== undefined && place.website !== '' && !validHttpUrl(place.website)) problems.push(`${label}: invalid website`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(place.lastChecked || '')) problems.push(`${label}: lastChecked must be YYYY-MM-DD`);
  if (place.visibility !== undefined && !['public','suppressed'].includes(place.visibility)) problems.push(`${label}: visibility must be public or suppressed`);
  if (place.qualityScore !== undefined && (!Number.isFinite(place.qualityScore) || place.qualityScore < 0 || place.qualityScore > 100)) problems.push(`${label}: qualityScore must be 0-100`);
  if (place.qualityTier !== undefined && !['featured','strong','standard','low'].includes(place.qualityTier)) problems.push(`${label}: invalid qualityTier`);
  if (place.walk?.grade !== undefined && place.walk.grade !== null && (!Number.isInteger(place.walk.grade) || place.walk.grade < 1 || place.walk.grade > 5)) problems.push(`${label}: walk grade must be 1-5`);
  if (place.officialSource?.url && !validHttpUrl(place.officialSource.url)) problems.push(`${label}: invalid officialSource URL`);
  if (place.schedule !== undefined) {
    if (!place.schedule || typeof place.schedule !== 'object' || !place.schedule.summary) problems.push(`${label}: schedule must include a summary`);
    if (place.schedule?.frequency && !['daily', 'weekly', 'monthly', 'seasonal', 'irregular'].includes(place.schedule.frequency)) problems.push(`${label}: invalid schedule frequency`);
    if (place.schedule?.daysOfWeek && (!Array.isArray(place.schedule.daysOfWeek) || place.schedule.daysOfWeek.some((day) => !['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].includes(day)))) problems.push(`${label}: invalid schedule daysOfWeek`);
    if (place.schedule?.startTime && !/^\d{2}:\d{2}$/.test(place.schedule.startTime)) problems.push(`${label}: invalid schedule startTime`);
    if (place.schedule?.endTime && !/^\d{2}:\d{2}$/.test(place.schedule.endTime)) problems.push(`${label}: invalid schedule endTime`);
    if (place.schedule?.sourceUrl && !validHttpUrl(place.schedule.sourceUrl)) problems.push(`${label}: invalid schedule sourceUrl`);
  }
  validateImage(place, label);
  if (place.gallery !== undefined) {
    if (!Array.isArray(place.gallery)) problems.push(`${label}: gallery must be an array`);
    else {
      const seen = new Set();
      for (const [galleryIndex, image] of place.gallery.entries()) {
        validateImageObject(image, `${label} gallery #${galleryIndex + 1}`);
        const key = image?.sourceUrl || image?.url;
        if (key && seen.has(key)) problems.push(`${label}: duplicate gallery image ${key}`);
        if (key) seen.add(key);
      }
    }
  }
}

const today = hobartDate();
for (const [index, event] of events.entries()) {
  const label = `event #${index + 1} ${event.name || '(unnamed event)'}`;
  for (const field of ['slug', 'name', 'town', 'region', 'startDate', 'endDate', 'categories', 'summary', 'sourceUrl', 'status', 'lastChecked']) {
    if (event[field] === undefined || event[field] === null || event[field] === '') problems.push(`${label}: missing ${field}`);
  }
  if (eventSlugs.has(event.slug)) problems.push(`${label}: duplicate slug ${event.slug}`);
  eventSlugs.add(event.slug);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(event.startDate || '') || !/^\d{4}-\d{2}-\d{2}$/.test(event.endDate || '')) problems.push(`${label}: invalid event date`);
  if (event.startDate && event.endDate && event.endDate < event.startDate) problems.push(`${label}: endDate is before startDate`);
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
const publicPlaces = places.filter((place) => place.status === 'active' && place.visibility !== 'suppressed').length;
console.log(`Validated ${places.length} places (${publicPlaces} public) and ${events.length} active events.`);
