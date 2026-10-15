import test from 'node:test';
import assert from 'node:assert/strict';
import {applyVerifiedBurnieEvent} from '../discover/lib/verified-burnie-events.mjs';

const event = (name, eventUrl, startDate='2026-10-21') => ({
  name, eventUrl, startDate, endDate:startDate, town:'Burnie', slug:'old-slug'
});

test('corrects the three independently verified Burnie Council events', () => {
  const pink = applyVerifiedBurnieEvent(event('PinkUp Burnie', 'https://www.burnie.tas.gov.au/Community/Whats-On-Events/2026/Pink-Up-Your-Town'), '2026-10-16');
  assert.equal(pink.startDate, '2026-10-22');
  assert.equal(pink.slug, 'pinkup-burnie-2026-10-22-burnie');

  const race = applyVerifiedBurnieEvent(event('Burnie Ten', 'https://www.burnie.tas.gov.au/Community/Whats-On-Events/2026/Burnie-Ten'), '2026-10-16');
  assert.equal(race.startDate, '2026-10-25');
  assert.match(race.venue, /Wilson and Cattley/);
  assert.equal(race.slug, 'burnie-ten-2026-10-25-burnie');

  const book = applyVerifiedBurnieEvent(event('ACOTAR 6 Midnight Release Event', 'https://www.burnie.tas.gov.au/Community/Whats-On-Events/2026/ACOTAR-6-Midnight-Release-Event', '2026-10-26'), '2026-10-16');
  assert.equal(book.priceFrom, 10);
  assert.equal(book.bookingRequired, true);
  assert.match(book.summary, /10:30 pm/);

  const market = applyVerifiedBurnieEvent(event('Book Market : Burnie Emu Bay Lions Club', 'https://www.burnie.tas.gov.au/Community/Whats-On-Events/2026/Book-Market-Burnie-Emu-Bay-Lions-Club', '2026-11-07'), '2026-10-16');
  assert.equal(market.town, 'Wivenhoe');
  assert.equal(market.slug, 'book-market-burnie-emu-bay-lions-club-2026-11-07-wivenhoe');
  assert.match(market.venue, /Wivenhoe Shed/);
});

test('leaves unrelated and differently sourced records unchanged', () => {
  const original = event('Book Market', 'https://example.test/event');
  assert.equal(applyVerifiedBurnieEvent(original, '2026-10-16'), original);
});
