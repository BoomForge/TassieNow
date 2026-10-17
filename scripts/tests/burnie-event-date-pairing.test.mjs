import test from 'node:test';
import assert from 'node:assert/strict';
import { burnieListingCardDate, localEventCalendarDate } from '../../scripts/discover/lib/burnie-calendar-dates.mjs';
import { applyVerifiedBurnieEvent } from '../../scripts/discover/lib/verified-burnie-events.mjs';

test('Burnie event date belongs to its own link, never neighbouring cards',()=>{
 const current='<strong>09 Nov 2026</strong><h3>National Recycling Week</h3>09 November 2026';
 const preceding='<h3>Burnie in Bloom</h3>07 Nov 2026';
 assert.equal(burnieListingCardDate(current).startDate,'2026-11-09');
 assert.equal(burnieListingCardDate(preceding).startDate,'2026-11-07');
 assert.equal(burnieListingCardDate('<h3>Event with no own date</h3>'),null);
});
test('structured Burnie midnight timestamps retain local event date',()=>{
 assert.equal(localEventCalendarDate('2026-11-01T00:00:00+11:00'),'2026-11-01');
 assert.equal(localEventCalendarDate('2026-10-31T00:00:00+11:00'),'2026-10-31');
 assert.equal(localEventCalendarDate('2026-11-31T00:00:00+11:00'),null);
});
test('verified Burnie events correct a wrong parsed date and rebuild canonical slug',()=>{
 const url='https://www.burnie.tas.gov.au/Community/Whats-On-Events/2026/In-Conversation-with-Alan-Carter';
 const corrected=applyVerifiedBurnieEvent({eventUrl:url,name:'In Conversation with Alan Carter',town:'Burnie',slug:'in-conversation-with-alan-carter-2026-11-09-burnie',startDate:'2026-11-09'},'2026-10-18');
 assert.equal(corrected.startDate,'2026-11-10');
 assert.equal(corrected.slug,'in-conversation-with-alan-carter-2026-11-10-burnie');
 assert.equal(corrected.startTime,'14:30');
 assert.match(corrected.venue,/Europa Cafe/);
});
test('weekly and duplicate council records collapse onto the verified canonical event',()=>{
 const source='https://www.burnie.tas.gov.au/Community/Whats-On-Events/2026/Second-Glance-Market';
 const old=applyVerifiedBurnieEvent({eventUrl:source,name:'Second Glance Market',town:'Burnie',startDate:'2026-10-28'},'2026-10-18');
 const correct=applyVerifiedBurnieEvent({eventUrl:source,name:'Second Glance Market',town:'Burnie',startDate:'2026-10-31'},'2026-10-18');
 assert.equal(old.slug,correct.slug);
 assert.equal(old.startDate,'2026-10-31');
});
test('National Recycling Week retains all seven advertised days',()=>{
 const source='https://www.burnie.tas.gov.au/Community/Whats-On-Events/2026/National-Recycling-Week';
 const e=applyVerifiedBurnieEvent({eventUrl:source,name:'National Recycling Week',town:'Burnie',startDate:'2026-11-08'},'2026-10-18');
 assert.equal(e.startDate,'2026-11-09');assert.equal(e.endDate,'2026-11-15');
 assert.equal(e.venue,'Burnie Council City Offices, 80 Wilson Street, Burnie');
});
test('unverified council or other sources are never rewritten',()=>{
 const normal={eventUrl:'https://example.org/anything',name:'Another event',startDate:'2026-11-01'};
 assert.equal(applyVerifiedBurnieEvent(normal,'2026-10-18'),normal);
});

test('Peter FitzSimons retains verified 12 November event date after discovery',()=>{
 const url='https://www.burnie.tas.gov.au/Community/Whats-On-Events/2026/In-Conversation-with-Peter-FitzSimons';
 const p=applyVerifiedBurnieEvent({eventUrl:url,name:'In Conversation with Peter FitzSimons',startDate:'2026-11-10',town:'Burnie'},'2026-10-18');
 assert.equal(p.startDate,'2026-11-12');
 assert.equal(p.startTime,'18:00');
 assert.equal(p.slug,'in-conversation-with-peter-fitzsimons-2026-11-12-burnie');
});
