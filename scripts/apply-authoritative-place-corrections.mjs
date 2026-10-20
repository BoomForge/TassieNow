import fs from 'node:fs/promises';
import overrides from '../src/data/place-overrides.json' with { type: 'json' };
import { sanitiseListingFields } from '../src/lib/listing-field-sanitizers.mjs';
import { safePlaceBookingUrl } from '../src/lib/place-booking-guard.mjs';
import { regionFor } from './discover/lib/regions.mjs';
import { shouldRemoveParksContactHours } from '../src/lib/parks-hours-source-guard.mjs';
import { correctWeldboroughSource } from '../src/lib/weldborough-source-correction.mjs';
import { dedupeWestCoastRailwayPlaces } from '../src/lib/west-coast-railway-dedupe.mjs';
import { dedupeIdenticalWikidataPlaces } from '../src/lib/wikidata-place-dedupe.mjs';
import { correctSalamancaPhotoCredit } from '../src/lib/salamanca-attribution-correction.mjs';

const file = new URL('../src/data/places.json', import.meta.url);
const places = JSON.parse(await fs.readFile(file, 'utf8'));
const sourceBacked = new Set(['ashgrove-cheese-factory','willie-smith-s-apple-shed','1830','calcified-forest','archers-knob','bird-hide','point-vision','springlawn-bird-hide-lookout','tasmanian-produce-market','hastings-thermal-springs','crabtree-crop-and-crafts-market-crabtree','the-hangout-cafe-and-restaurant','bento-legana','mr-burger','little-riva']);
let fieldsCorrected=0, bookingLinksRemoved=0;
for (const place of places) {
  if (correctWeldboroughSource(place)) fieldsCorrected++;
  // Correct the exact North West town rather than the separate southern Sorell.
  // Runs in the normal build to repair older curated and generated records alike.
  if (/^port\s+sorell$/i.test(String(place.town||'').trim())) {
    const correct=regionFor(place.latitude,place.longitude,place.town);
    if (place.region!==correct) { place.region=correct; fieldsCorrected++; }
  }
  // Source-specific branch/locality evidence overrides unrelated head-office
  // or state-level fallback addresses. Never overwrite owner-managed entries.
  if (['bakers-delight','trowunna-wildlife-park','coles-beach'].includes(place.slug) &&
      !place.managedManually && overrides[place.slug]?.liveDisplayOverride === true) {
    const review=overrides[place.slug];
    for (const field of ['name','town','region','address','phone','openingHours','summary']) {
      if (typeof review[field] !== 'string' || !review[field].trim()) continue;
      if (place[field] === review[field]) continue;
      place[field]=review[field];
      place.detailSources ||= {};
      if (review.detailSources?.[field])
        place.detailSources[field]=structuredClone(review.detailSources[field]);
      fieldsCorrected++;
    }
  }
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
  // Protect the public against two demonstrated foreign/mismatched hero images.
  // Use only existing first-party site category artwork, not unlicensed substitutes.
  if (['1830','central-channel-marine-conservation-area'].includes(place.slug) &&
      !place.managedManually && overrides[place.slug]?.image?.isFallback === true) {
    const approved=overrides[place.slug];
    if (place.image?.url !== approved.image.url || place.image?.isFallback !== true) {
      place.image=structuredClone(approved.image);
      place.detailSources ||= {};
      if (approved.detailSources?.image)
        place.detailSources.image=structuredClone(approved.detailSources.image);
      fieldsCorrected++;
    }
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
  // Previously imported Parks office/contact hours must not survive new builds.
  if (shouldRemoveParksContactHours(place)) {
    delete place.openingHours;
    if (place.detailSources) delete place.detailSources.openingHours;
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
// Preserve exact-source Commons author attribution during every standard build.
for(let i=0;i<places.length;i++){
 const corrected=correctSalamancaPhotoCredit(places[i]);
 if(corrected!==places[i]){places[i]=corrected;fieldsCorrected++;}
}
const railwayReview=dedupeWestCoastRailwayPlaces(places);
// Same exact Wikidata entity accidentally discovered under multiple P31 classes.
// Remove only source-identical same-name nearby copies; existing public aliases
// have independently reviewed 301s in public/_redirects.
const wikidataReview=dedupeIdenticalWikidataPlaces(railwayReview.places);
await fs.writeFile(file, JSON.stringify(wikidataReview.places,null,2)+'\n');
if(railwayReview.removed)console.log('Verified West Coast Railway duplicate removed: '+railwayReview.removed);
if(wikidataReview.removed)console.log('Same-entity Wikidata duplicates removed: '+wikidataReview.removed+' across '+wikidataReview.groups+' groups; '+wikidataReview.aliases.map(a=>a.from+'>'+a.to).join(', '));
console.log('Verified catalogue correction: '+fieldsCorrected+' source-backed fields updated; '+bookingLinksRemoved+' invalid booking links removed; '+places.length+' listings reviewed.');
