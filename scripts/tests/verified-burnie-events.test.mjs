import test from 'node:test';
import assert from 'node:assert/strict';
import {applyVerifiedBurnieEvent,restoreVerifiedBurnieEvents} from '../discover/lib/verified-burnie-events.mjs';

const event = (name, eventUrl, startDate='2026-10-21') => ({
  name, eventUrl, startDate, endDate:startDate, town:'Burnie', slug:'old-slug'
});

test('corrects the independently verified Burnie Council events', () => {
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

test('Burnie household chemical drop-off survives page-two list omissions until its actual date',()=>{
 const official='https://www.burnie.tas.gov.au/Community/Whats-On-Events/2026/Free-Household-Chemical-Disposal';
 const restored=restoreVerifiedBurnieEvents([], '2026-10-20');
 assert.equal(restored.length,2,'both independently verified Burnie page-two events restored');
 assert.equal(restored[0].eventUrl,official);
 assert.equal(restored[0].slug,'free-household-chemical-disposal-2026-11-15-burnie');
 assert.equal(restored[0].startDate,'2026-11-15');
 assert.equal(restored[0].startTime,'10:00');
 assert.equal(restored[0].endTime,'13:00');
 assert.match(restored[0].address,/289 Mooreville Road/);
 assert.deepEqual(restoreVerifiedBurnieEvents(restored,'2026-10-21'),restored,'no duplicate');
 assert.deepEqual(restoreVerifiedBurnieEvents([],'2026-11-16'),[],'past event never revived');
 const stale=applyVerifiedBurnieEvent(event('Free Household Chemical Disposal',official,'2026-10-31'),'2026-10-20');
 assert.equal(stale.startDate,'2026-11-15');
 assert.equal(stale.slug,'free-household-chemical-disposal-2026-11-15-burnie');
 assert.equal(stale.venue,'Burnie Waste Transfer Station');
});


test('Tassie Pop Culture Market stays correct after missing council pagination or re-dating',()=>{
 const url='https://www.burnie.tas.gov.au/Community/Whats-On-Events/2026/TasPop-Geek-market';
 const restored=restoreVerifiedBurnieEvents([],'2026-10-20');
 const market=restored.find(e=>e.eventUrl===url);
 assert.ok(market,'verified future market restored');
 assert.equal(market.startDate,'2026-12-12');
 assert.equal(market.startTime,'10:00');
 assert.equal(market.endTime,'14:00');
 assert.equal(market.town,'Upper Burnie');
 assert.match(market.address,/242 Mount Street/);
 assert.ok(market.categories.includes('Markets'));
 assert.equal(restoreVerifiedBurnieEvents([market],'2026-10-20').length,1,'does not duplicate a live market');
 const old=applyVerifiedBurnieEvent({...market,startDate:'2026-06-20',town:'Burnie'},'2026-10-20');
 assert.equal(old.slug,market.slug,'old date corrected to current official session');
 assert.deepEqual(restoreVerifiedBurnieEvents([],'2026-12-13'),[],'expired markets stay expired');
});
