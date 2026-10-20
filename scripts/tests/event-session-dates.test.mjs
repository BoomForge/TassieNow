import test from 'node:test';
import assert from 'node:assert/strict';
import {eventOccursOnLocalDay,eventOccursWithin} from '../../src/lib/event-session-dates.js';
const season={startDate:'2026-02-01',endDate:'2026-12-31'};
test('first-Sunday Franklin movies are not daily for the whole 2026 season',()=>{
 const e={...season,name:'Franklin Movie Nights'};
 assert.equal(eventOccursOnLocalDay(e,'2026-10-20'),false);
 assert.equal(eventOccursOnLocalDay(e,'2026-10-25'),false);
 assert.equal(eventOccursOnLocalDay(e,'2026-11-01'),true);
 assert.equal(eventOccursOnLocalDay(e,'2026-11-08'),false);
 assert.equal(eventOccursWithin(e,'2026-10-31','2026-11-01'),true);
});
test('Wednesday recurring library program only shows on Wednesdays',()=>{
 const e={name:'Rock and Rhyme at Huonville Library',startDate:'2026-01-14',endDate:'2026-12-23'};
 assert.equal(eventOccursOnLocalDay(e,'2026-10-20'),false);
 assert.equal(eventOccursOnLocalDay(e,'2026-10-21'),true);
 assert.equal(eventOccursWithin(e,'2026-10-24','2026-10-25'),false);
});
test('known recurring weekly bowls only show on scheduled Thursdays',()=>{
 const e={name:'Barefoot Social Bowls',startDate:'2026-10-22',endDate:'2027-03-25',schedule:{frequency:'weekly',daysOfWeek:['Thursday']}};
 assert.equal(eventOccursOnLocalDay(e,'2026-10-22'),true);
 assert.equal(eventOccursOnLocalDay(e,'2026-10-23'),false);
 assert.equal(eventOccursWithin(e,'2026-10-24','2026-10-25'),false);
});
test('unknown season-length series fail closed until organiser schedule exists',()=>{
 const e={name:'Surges Bay Supporters – Community Events',startDate:'2026-01-01',endDate:'2026-12-31'};
 assert.equal(eventOccursOnLocalDay(e,'2026-10-20'),false);
 assert.equal(eventOccursWithin(e,'2026-10-24','2026-10-25'),false);
});
test('one-day events and genuinely continuous festival days still appear',()=>{
 const single={name:'One day',startDate:'2026-10-25',endDate:'2026-10-25'};
 const festival={name:'Weeklong festival',startDate:'2026-10-19',endDate:'2026-10-25'};
 assert.equal(eventOccursOnLocalDay(single,'2026-10-25'),true);
 assert.equal(eventOccursOnLocalDay(single,'2026-10-24'),false);
 assert.equal(eventOccursOnLocalDay(festival,'2026-10-20'),true);
 assert.equal(eventOccursWithin(festival,'2026-10-24','2026-10-25'),true);
 assert.equal(eventOccursWithin(single,'2026-10-26','2026-10-27'),false);
});
test('explicit session dates take precedence over any season range',()=>{
 const e={...season,name:'Evening program',schedule:{sessionDates:['2026-10-22','2026-10-29']}};
 assert.equal(eventOccursOnLocalDay(e,'2026-10-22'),true);
 assert.equal(eventOccursOnLocalDay(e,'2026-10-23'),false);
});
