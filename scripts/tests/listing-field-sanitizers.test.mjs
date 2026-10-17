import test from 'node:test';
import assert from 'node:assert/strict';
import { normaliseStructuredAddress, normaliseTelephone, safeBookingUrl, structuredBookingUrl } from '../../src/lib/listing-field-sanitizers.mjs';

test('decodes percent-encoded telephone spacing before digit normalization', () => {
  assert.equal(normaliseTelephone('tel:0419%20403%20467'), '0419 403 467');
  assert.equal(normaliseTelephone('0419 403 467').replace(/[^+\d]/g, ''), '0419403467');
});

test('normalises malformed Tasmanian structured addresses', () => {
  assert.equal(normaliseStructuredAddress({streetAddress:'100A Main Road, moonah',addressLocality:'Tas',addressRegion:'Tas',postalCode:'7009'}), '100A Main Road, moonah, TAS, 7009');
  assert.equal(normaliseStructuredAddress({streetAddress:'1 Bayfield St, Rosny Park',addressLocality:'Rosny Park',addressRegion:'CA',postalCode:'7018'}), '1 Bayfield St, Rosny Park, TAS, 7018');
});

test('rejects search templates and boolean reservation flags', () => {
  assert.equal(safeBookingUrl('https://farmgatemarket.com.au/?s={search_term_string}'), null);
  assert.equal(safeBookingUrl('https://farmgatemarket.com.au/?s=%7Bsearch_term_string%7D'), null);
  assert.equal(safeBookingUrl('yes'), null);
  assert.equal(safeBookingUrl('https://no'), null);
  assert.equal(structuredBookingUrl({potentialAction:{'@type':'SearchAction',target:{urlTemplate:'https://example.com/?s={search_term_string}'}}}), null);
  assert.equal(structuredBookingUrl({reservationUrl:'https://tickets.example.com/book'}), 'https://tickets.example.com/book');
});
