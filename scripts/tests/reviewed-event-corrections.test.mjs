import test from 'node:test';
import assert from 'node:assert/strict';
import events from '../../src/data/events.json' with { type:'json' };
import overrides from '../../src/data/event-overrides.json' with { type:'json' };
import {normaliseEventSourceUrl,applyReviewedEventCorrection} from '../discover/lib/reviewed-event-corrections.mjs';
import {readFileSync} from 'node:fs';
const redirects=readFileSync(new URL('../../public/_redirects',import.meta.url),'utf8');
const expected=[
 ['halloween-fest-hobart-2026-10-31-hobart','2026-10-31','Hobart City Hall','10:00',2],
 ['showcase-2026-2026-11-06-hobart','2026-11-06','Procreate — In-house Cinema','17:00',1],
 ['launnie-monthly-storytelling-2026-2026-11-04-launceston','2026-11-04','Du Cane Brewery & Dining Hall — The Map Room','18:00',1],
 ['barefoot-social-bowls-2026-10-22-currie','2026-10-22','King Island Golf and Bowling Club','16:30',2]
];
test('the corrected four events have one canonical record each',()=>{
 for(const [slug,date,venue,time] of expected){
  const records=events.filter(e=>e.slug===slug);
  assert.equal(records.length,1,slug);
  assert.equal(records[0].startDate,date);
  assert.equal(records[0].venue,venue);
  assert.equal(records[0].startTime,time);
 }
});
test('Halloween ticket session list includes all four official times and no duplicates',()=>{
 const event=events.find(x=>x.slug===expected[0][0]);
 assert.deepEqual(event.sessions.map(x=>x.startTime),['10:00','12:00','14:00','15:00']);
 assert.equal(events.filter(x=>x.eventUrl?.split('?')[0]===event.eventUrl).length,1);
 assert.equal(event.image.sourceMethod,'verified-event-venue');
});
test('verified redirects cover previous source slugs',()=>{
 const aliases=['halloween-fest-hobart-2026-10-30-hobart','sat-oct-31-10am-halloween-fest-hobart-hobart-2026-10-31-hobart',
  'barefoot-social-bowls-2026-10-14-currie'];
 for(const alias of aliases){
  assert.ok(overrides[alias],alias);
  assert.match(redirects,new RegExp('/event/'+alias+' /event/'+overrides[alias].fields.slug+' 301'));
 }
});
test('tracking-only Humanitix referral aliases collapse to canonical URL',()=>{
 const url='https://events.humanitix.com/halloween-fest-hobart?hxref=foo&hxchl=bar&utm_source=x';
 assert.equal(normaliseEventSourceUrl(url),'https://events.humanitix.com/halloween-fest-hobart');
 const corrected=applyReviewedEventCorrection({slug:'misnamed-humanitix-card',eventUrl:url,startDate:'2026-10-30',town:'Hobart'},overrides);
 assert.equal(corrected.slug,'halloween-fest-hobart-2026-10-31-hobart');
 assert.equal(corrected.startDate,'2026-10-31');
 assert.equal(normaliseEventSourceUrl('https://events.humanitix.com/halloween-fest-hobart?dateId=123'),
  'https://events.humanitix.com/halloween-fest-hobart?dateId=123');
});
test('old source aliases are repaired after any future discovery regeneration',()=>{
 for(const [slug,date,venue,time] of expected){
  const original=events.find(e=>e.slug===slug);
  const reintroduced=applyReviewedEventCorrection({...original,slug:'new-bad-search-card',startDate:'2026-10-17',venue:'Venue'},overrides);
  assert.equal(reintroduced.startDate,date);assert.equal(reintroduced.slug,slug);
  assert.equal(reintroduced.venue,venue);
 }
});

test('three City of Clarence wrong-date cards use source-specific corrections',()=>{
 const cases=[
  ['rotary-club-of-lindisfarne-talks-pam-scott-oam','2026-10-21','Motor Yacht Club of Tasmania','18:15'],
  ['beyond-sound-the-music-in-all-of-us','2026-12-03','Rosny Library','13:00'],
  ['international-day-of-people-with-disability-come-and-try-golf','2026-10-26','Golf Park Hobart',null]
 ];
 for(const [prefix,date,venue,time] of cases){
  const item=events.find(x=>x.slug.startsWith(prefix));
  assert.ok(item,prefix);
  const corrected=applyReviewedEventCorrection(item,overrides);
  assert.equal(corrected.startDate,date,prefix);
  assert.equal(corrected.endDate,date,prefix);
  assert.equal(corrected.venue,venue,prefix);
  if(time)assert.equal(corrected.startTime,time,prefix);
  if(prefix.includes('pam-scott')){
   assert.equal(corrected.address,'1 Ford Parade, Lindisfarne TAS 7015');
   assert.match(corrected.summary,/forensic scientist/i,'neighbouring council event summary must not leak into Pam Scott');
  }
  const reimported=applyReviewedEventCorrection({...item,slug:'new-search-card-wrong-date',startDate:'2026-10-20'},overrides);
  assert.equal(reimported.startDate,date,'source URL survives reimport '+prefix);
 }
});


test('Skill Share 2027 false future date is corrected to its real past council session',()=>{
 const original={
  slug:'our-shared-space-skill-share-day-2027-01-14-rosny-park',
  name:'Our shared space - Skill share day',
  eventUrl:'https://www.ccc.tas.gov.au/event/our-shared-space-skill-share-day/',
  startDate:'2027-01-14',endDate:'2027-01-14',town:'Rosny Park'
 };
 for(const candidate of [original,{...original,slug:'regenerated-bad-date-from-neighbour'}]){
  const fixed=applyReviewedEventCorrection(candidate,overrides);
  assert.equal(fixed.startDate,'2026-10-20');
  assert.equal(fixed.endDate,'2026-10-20');
  assert.equal(fixed.startTime,'15:30');
  assert.equal(fixed.endTime,'16:30');
  assert.equal(fixed.venue,'Rosny Library');
  assert.match(fixed.address,/Bligh Street/);
 }
 assert.ok(!events.some(e=>e.eventUrl===original.eventUrl&&e.startDate==='2027-01-14'),
  'source data must not advertise an already completed event as January 2027');
});

test('agriCULTURED and Mind Blown keep official Tasmania-local event days and venue',()=>{
 const pairs=[
  ['agricultured-2026-2026-11-04-launceston','2026-11-05','2026-11-08','09:00','19:00','Launceston & Surrounds'],
  ['mind-blown-the-mentalist-and-the-medium-in-launceston-2026-11-07-launceston','2026-11-07','2026-11-07','18:45','22:00','The Tramsheds Function Centre']
 ];
 for(const [slug,first,last,begin,end,venue] of pairs){
  const sourceUrl=overrides[slug]?.eventUrl;
  const matches=events.filter(e=>e.slug===slug||(sourceUrl&&e.eventUrl===sourceUrl));
  assert.equal(matches.length,1,'One correct event exists under verified source URL: '+slug);
  const e=matches[0];
  const fixed=applyReviewedEventCorrection(e,overrides);
  assert.equal(fixed.startDate,first);
  assert.equal(fixed.endDate,last);
  assert.equal(fixed.startTime,begin);
  assert.equal(fixed.endTime,end);
  assert.equal(fixed.venue,venue);
  const changedSlug={...e,slug:'future-reimport-new-slug'};
  const fixedAgain=applyReviewedEventCorrection(changedSlug,overrides);
  assert.equal(fixedAgain.startDate,first,'stable official URL correction survives reimport');
 }
 const blown=applyReviewedEventCorrection(events.find(e=>e.eventUrl==='https://events.humanitix.com/mindblown'),overrides);
 assert.equal(blown.town,'Invermay');
 assert.equal(blown.address,'4 Invermay Road, Invermay TAS 7248');
});


test('Writing Life previous-day UTC date is corrected without resurrecting an expired event',()=>{
 const old={
  slug:'read-write-publish-writing-life-2026-2026-10-18-launceston',
  eventUrl:'https://events.humanitix.com/read-write-publish-writing-life-2026',
  name:'Read, Write, Publish... Writing Life 2026',
  startDate:'2026-10-18',endDate:'2026-10-19',town:'Launceston'
 };
 for(const candidate of [old,{...old,slug:'future-reimport-with-utc-date'}]){
  const fixed=applyReviewedEventCorrection(candidate,overrides);
  assert.equal(fixed.startDate,'2026-10-19');
  assert.equal(fixed.endDate,'2026-10-19');
  assert.equal(fixed.startTime,'09:45');
  assert.equal(fixed.endTime,'16:00');
  assert.match(fixed.venue,/River's Edge/);
 }
 assert.ok(!events.some(e=>e.eventUrl===old.eventUrl && e.startDate==='2026-10-18'),
  'TassieNow must not resurrect the erroneous 18 October listing');
});


test('Clarence disability golf and Beyond Sound canonical pages and redirects are source-accurate',()=>{
 const specs=[
  {url:'https://www.ccc.tas.gov.au/event/come-and-try-disability-golf/',
   slug:'international-day-of-people-with-disability-come-and-try-golf-2026-10-26-cambridge',
   old:['international-day-of-people-with-disability-come-and-try-golf-2026-10-21-rosny-park','come-and-try-disability-golf-2026-10-21-rosny-park'],
   date:'2026-10-26',town:'Cambridge',venue:'Golf Park Hobart',start:'14:30',end:'15:30'},
  {url:'https://www.ccc.tas.gov.au/event/beyond-sound-the-music-in-all-of-us/',
   slug:'beyond-sound-the-music-in-all-of-us-2026-12-03-rosny-park',
   old:['beyond-sound-the-music-in-all-of-us-2026-11-04-rosny-park'],
   date:'2026-12-03',town:'Rosny Park',venue:'Rosny Library',start:'13:00',end:'15:00'}
 ];
 for(const spec of specs){
  const matching=events.filter(e=>e.eventUrl===spec.url);
  assert.equal(matching.length,1,'one source-specific record for '+spec.url);
  const e=matching[0];
  assert.equal(e.slug,spec.slug);
  assert.equal(e.startDate,spec.date);
  assert.equal(e.endDate,spec.date);
  assert.equal(e.startTime,spec.start);
  assert.equal(e.endTime,spec.end);
  assert.equal(e.town,spec.town);
  assert.equal(e.venue,spec.venue);
  assert.ok(e.summary?.length>120,'specific first-party summary');
  for(const old of spec.old){
   const expected='/event/'+old+'/ /event/'+spec.slug+'/ 301';
   assert.ok(redirects.includes(expected),'missing safe legacy alias '+old);
   assert.ok(!events.some(event=>event.slug===old),'do not publish original incorrect slug');
  }
  const reset={...e,slug:'bad-previous-card-date',startDate:'2026-10-21',town:'Rosny Park',startTime:undefined,venue:'Venue'};
  const corrected=applyReviewedEventCorrection(reset,overrides);
  assert.equal(corrected.slug,spec.slug,'source URL survives regenerated wrong slug');
  assert.equal(corrected.startDate,spec.date);
  assert.equal(corrected.town,spec.town);
  assert.equal(corrected.startTime,spec.start);
 }
 const golf=events.find(e=>e.eventUrl===specs[0].url);
 assert.equal(golf.image.isFallback,true,'unrelated US green image must not depict an advertised Tasmanian clinic');
 assert.equal(golf.image.attribution,'TassieNow');
 assert.match(golf.summary,/registration is essential/i);
 const sound=events.find(e=>e.eventUrl===specs[1].url);
 assert.match(sound.summary,/Auslan interpreter/i);
});
