import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {correctDoverMobileServiceCentre} from '../../src/lib/dover-mobile-event-correction.mjs';
import events from '../../src/data/events.json' with {type:'json'};
const redirects=readFileSync(new URL('../../public/_redirects',import.meta.url),'utf8');
const source='https://www.huonvalley.tas.gov.au/event/australian-government-mobile-service-centre-dover/';
const canonical='australian-government-mobile-service-centre-dover-2026-10-29-dover';
const title='Australian Government Mobile Service Centre – Dover';
test('Dover one-day service replaces Huonville next-card date pairing and keeps first-party identity',()=>{
 const bad=[
  {name:title,slug:'australian-government-mobile-service-centre-dover-2026-10-29-huonville',town:'Huonville',startDate:'2026-10-29',endDate:'2026-10-29',eventUrl:'https://www.huonvalley.tas.gov.au/events/'},
  {name:title,slug:'australian-government-mobile-service-centre-dover-2026-10-30-huonville',town:'Huonville',startDate:'2026-10-30',endDate:'2026-11-01',eventUrl:source},
  {name:'Spring in the Vines',slug:'spring-in-the-vines-2026',startDate:'2026-10-30',endDate:'2026-11-01',eventUrl:'https://www.huonvalley.tas.gov.au/event/spring-in-the-vines/'}
 ];
 const corrected=correctDoverMobileServiceCentre(bad);
 assert.equal(corrected.length,2);
 const d=corrected.find(e=>e.slug===canonical);
 assert.ok(d);
 assert.equal(d.eventUrl,source);
 assert.equal(d.town,'Dover');
 assert.equal(d.region,'Hobart & South');
 assert.equal(d.startDate,'2026-10-29');
 assert.equal(d.endDate,'2026-10-29');
 assert.equal(d.startTime,'09:00');
 assert.equal(d.endTime,'15:30');
 assert.equal(d.venue,'Opposite Dover RSL');
 assert.match(d.address,/Chapman Avenue/);
 assert.match(d.summary,/Centrelink, Medicare, myGov/);
 assert.ok(corrected.some(e=>e.name==='Spring in the Vines'&&e.endDate==='2026-11-01'),
  'different next-card event is untouched');
 assert.deepEqual(correctDoverMobileServiceCentre(corrected),corrected,'already canonical is stable');
});
test('never mistake earlier Dover mobile service year or unrelated mobile visits for current session',()=>{
 const older={name:title,slug:'dover-2025',startDate:'2025-11-25',eventUrl:source};
 const southArm={name:'Mobile service centre – South Arm',startDate:'2026-11-03',eventUrl:'https://www.ccc.tas.gov.au/event/mobile-service-centre-south-arm/'};
 const input=[older,southArm];
 assert.equal(correctDoverMobileServiceCentre(input),input);
});
test('canonical current catalogue and both retired Dover Huonville URLs match council date',()=>{
 const relevant=events.filter(x=>x.name===title);
 assert.equal(relevant.length,1);
 const e=relevant[0];
 assert.equal(e.slug,canonical);
 assert.equal(e.startDate,'2026-10-29');
 assert.equal(e.endDate,'2026-10-29');
 assert.equal(e.startTime,'09:00');
 assert.equal(e.endTime,'15:30');
 assert.equal(e.venue,'Opposite Dover RSL');
 assert.equal(e.town,'Dover');
 assert.equal(e.eventUrl,source);
 for(const old of ['australian-government-mobile-service-centre-dover-2026-10-29-huonville','australian-government-mobile-service-centre-dover-2026-10-30-huonville']){
  for(const pref of ['/event/','/events/'])
   assert.ok(redirects.includes(pref+old+'/ /event/'+canonical+'/ 301'),old);
 }
});
