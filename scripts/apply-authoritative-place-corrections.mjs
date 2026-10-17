import fs from 'node:fs/promises';
import overrides from '../src/data/place-overrides.json' with { type: 'json' };
import { sanitiseListingFields } from '../src/lib/listing-field-sanitizers.mjs';
import { safePlaceBookingUrl } from '../src/lib/place-booking-guard.mjs';

const file = new URL('../src/data/places.json', import.meta.url);
const places = JSON.parse(await fs.readFile(file, 'utf8'));
const sourceBacked = new Set(['ashgrove-cheese-factory','willie-smith-s-apple-shed']);
let fieldsCorrected=0, bookingLinksRemoved=0;
for (const place of places) {
  if (sourceBacked.has(place.slug) && overrides[place.slug]) {
    for (const field of ['openingHours','phone','address']) {
      if (typeof overrides[place.slug][field] === 'string' && overrides[place.slug][field].trim()
        && place[field] !== overrides[place.slug][field]) {
        place[field] = overrides[place.slug][field];
        fieldsCorrected++;
      }
    }
  }
  const original = place.bookingUrl;
  sanitiseListingFields(place);
  if (place.bookingUrl && !safePlaceBookingUrl(place)) {
    delete place.bookingUrl;
    if (place.detailSources) delete place.detailSources.bookingUrl;
  }
  if (original && !place.bookingUrl) bookingLinksRemoved++;
}
await fs.writeFile(file, JSON.stringify(places,null,2)+'\n');
console.log('Verified catalogue correction: '+fieldsCorrected+' source-backed fields updated; '+bookingLinksRemoved+' invalid booking links removed; '+places.length+' listings reviewed.');
