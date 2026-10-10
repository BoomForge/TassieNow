// Compare the committed image coverage report with the actual catalogue.
// This never changes content; it fails CI on stale or misleading photo totals.
import fs from 'node:fs';
import { imageIsPublishable } from './discover/lib/event-media.mjs';

const read = path => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), 'utf8'));
const events = read('../src/data/events.json');
const places = read('../src/data/places.json');
const audit = read('../src/data/catalogue-audit.json');
const parts = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Hobart', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
const date = key => parts.find(part => part.type === key)?.value;
const today = `${date('year')}-${date('month')}-${date('day')}`;
const active = events.filter(event => event.status === 'active' && event.endDate >= today);
const publicPlaces = places.filter(place => place.status === 'active' && place.visibility !== 'suppressed');
const food = publicPlaces.filter(place => (place.categories || []).includes('Food & Drink'));
const photographed = items => items.filter(item => item.image && !item.image.isFallback).length;
const licensed = active.filter(event => imageIsPublishable(event.image)).length;
const comparisons = {
  'audit date': [audit.generatedAt, today],
  'active events': [audit.events.active, active.length],
  'published licensed event photographs': [audit.events.media.licensedHeroCoverage.count, licensed],
  'events using generic artwork': [audit.events.media.stillUsingCategoryArtwork, active.length - photographed(active)],
  'public places': [audit.places.public, publicPlaces.length],
  'place hero photographs': [audit.places.media.realHeroCoverage.count, photographed(publicPlaces)],
  'food listings': [audit.places.foodDiscovery.listings, food.length],
  'food hero photographs': [audit.places.foodDiscovery.media.realHeroCoverage.count, photographed(food)]
};
let failures = 0;
for (const [label, [reported, actual]] of Object.entries(comparisons)) {
  if (reported !== actual) {
    console.error(`STALE COVERAGE: ${label}: report=${reported}, actual=${actual}`);
    failures++;
  }
}
const unpublishable = active.filter(event => event.image && !event.image.isFallback && !imageIsPublishable(event.image));
if (unpublishable.length) {
  console.error(`UNVERIFIED EVENT IMAGES: ${unpublishable.length}`);
  failures++;
}
if (failures) process.exit(1);
console.log(`Verified catalogue coverage: ${licensed}/${active.length} event photos, ${photographed(publicPlaces)}/${publicPlaces.length} place heroes and ${photographed(food)}/${food.length} food heroes.`);
