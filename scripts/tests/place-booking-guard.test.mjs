import test from 'node:test';
import assert from 'node:assert/strict';
import { safePlaceBookingUrl, suspectBookingSlugs } from '../../src/lib/place-booking-guard.mjs';

test('blocks wrong Hastings Caves ticket URL on an unrelated park but not its actual destination', () => {
  const url='https://parks.tas.gov.au/Pages/Hastings-Caves-State-Reserve.aspx';
  assert.equal(safePlaceBookingUrl({slug:'wineglass-bay-lookout',bookingUrl:url}),null);
  assert.equal(safePlaceBookingUrl({slug:'mount-field-national-park',bookingUrl:url}),null);
  assert.equal(safePlaceBookingUrl({slug:'hastings-caves-state-reserve',bookingUrl:url}),url);
});

test('rejects all eighteen vetted false ticket destinations but preserves unrelated real tickets', () => {
  assert.equal(suspectBookingSlugs.size,18);
  for (const slug of suspectBookingSlugs) {
    assert.equal(safePlaceBookingUrl({slug,bookingUrl:'https://example.org/?s={search_term_string}'}),null);
    assert.equal(safePlaceBookingUrl({slug,bookingUrl:'https://example.org'}),null);
  }
  assert.equal(safePlaceBookingUrl({slug:'verified-ticketed-event',bookingUrl:'https://tickets.example.org/event/123'}),'https://tickets.example.org/event/123');
});

test('rejects HTML-entity nested URL on Southwest National Park while keeping genuine bookings', () => {
  const wrong='https://parks.tas.gov.au/explore-our-parks/https&#58;//www.eventbrite.com.au/e/mt-anne-shelf-camp-lonely-tarns-circuit-walker-registration-tickets-189386097917?aff=ebdsoporgprofile';
  for (const slug of ['southwest-national-park','southwest-national-park-2']) {
    assert.equal(safePlaceBookingUrl({slug,bookingUrl:wrong}),null);
  }
  assert.equal(safePlaceBookingUrl({slug:'southwest-national-park',bookingUrl:'https://passes.parks.tas.gov.au/'}),'https://passes.parks.tas.gov.au/');
});
