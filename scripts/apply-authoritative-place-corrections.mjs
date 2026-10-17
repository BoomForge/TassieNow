import fs from 'node:fs/promises';
import overrides from '../src/data/place-overrides.json' with { type: 'json' };
import { sanitiseListingFields } from '../src/lib/listing-field-sanitizers.mjs';
import { safePlaceBookingUrl } from '../src/lib/place-booking-guard.mjs';

const file = new URL('../src/data/places.json', import.meta.url);
const places = JSON.parse(await fs.readFile(file, 'utf8'));
const sourceBacked = new Set(['ashgrove-cheese-factory','willie-smith-s-apple-shed','1830','calcified-forest','archers-knob','bird-hide','point-vision','springlawn-bird-hide-lookout','tasmanian-produce-market','hastings-thermal-springs','crabtree-crop-and-crafts-market-crabtree','the-hangout-cafe-and-restaurant','bento-legana','mr-burger']);
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
  if (sourceBacked.has(place.slug) && overrides[place.slug]?.liveDisplayOverride === true &&
      !place.managedManually && typeof overrides[place.slug].town === 'string' && place.town !== overrides[place.slug].town) {
    place.town = overrides[place.slug].town;
    fieldsCorrected++;
  }
  // Verified false-match correction: never show an unrelated photo as The Four Mile.
  if (place.slug === 'the-four-mile' && overrides[place.slug]?.image?.isFallback === true) {
    place.image = structuredClone(overrides[place.slug].image);
    place.detailSources ||= {};
    if (overrides[place.slug].detailSources?.image) place.detailSources.image = structuredClone(overrides[place.slug].detailSources.image);
    fieldsCorrected++;
  }
  if (sourceBacked.has(place.slug) && overrides[place.slug]?.removePhone === true) {
    delete place.phone;
    fieldsCorrected++;
  }
  if (sourceBacked.has(place.slug) && overrides[place.slug]?.liveDisplayOverride === true && !place.managedManually) {
    const review = overrides[place.slug];
    if (review.removeOpeningHours === true) { delete place.openingHours; fieldsCorrected++; }
    if (review.removeSchedule === true) { delete place.schedule; fieldsCorrected++; }
    if (review.overrideOfficialSource === true && review.officialSource?.url?.startsWith('https://')) {
      place.officialSource = structuredClone(review.officialSource);
      fieldsCorrected++;
    }
  }
  if (place.slug === 'hastings-thermal-springs' && !place.managedManually &&
      place.image?.isFallback === true && overrides[place.slug]?.image?.sourceUrl?.startsWith('https://commons.wikimedia.org/wiki/File:')) {
    place.image = structuredClone(overrides[place.slug].image);
    place.detailSources ||= {};
    place.detailSources.image = structuredClone(overrides[place.slug].detailSources.image);
    fieldsCorrected++;
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
