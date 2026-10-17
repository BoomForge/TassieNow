import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const places=JSON.parse(fs.readFileSync(new URL('../../src/data/places.json',import.meta.url),'utf8'));
const events=JSON.parse(fs.readFileSync(new URL('../../src/data/events.json',import.meta.url),'utf8'));
const eventOverrides=JSON.parse(fs.readFileSync(new URL('../../src/data/event-overrides.json',import.meta.url),'utf8'));
const overrides=JSON.parse(fs.readFileSync(new URL('../../src/data/place-overrides.json',import.meta.url),'utf8'));
const sanitiser=fs.readFileSync(new URL('../sanitize-events.mjs',import.meta.url),'utf8');
const eventPage=fs.readFileSync(new URL('../../src/pages/event/[slug].astro',import.meta.url),'utf8');

test('accepted AI Ops listing corrections are source-staged',()=>{
  const ash=places.find((item)=>item.slug==='ashgrove-cheese-factory');
  assert.equal(ash.openingHours,'Mo-Su 08:30-17:00');
  assert.equal(overrides['ashgrove-cheese-factory'].openingHours,'Mo-Su 08:30-17:00');
  const four=places.find((item)=>item.slug==='the-four-mile');
  assert.equal(four.image.isFallback,true);
  assert.equal(four.image.sourceUrl,null);
  assert.equal(overrides['the-four-mile'].image.isFallback,true);
  const floral=events.find((item)=>item.slug==='city-of-hobart-floral-shows-2026-11-13-hobart');
  assert.equal(floral.endDate,'2026-11-14');
  assert.equal(floral.venue,'Waterside Pavilion');
  assert.equal(eventOverrides[floral.slug].fields.endDate,'2026-11-14');
  assert.equal(eventOverrides[floral.slug].fields.venue,'Waterside Pavilion');
  assert.equal(floral.address,'Mawson Place, Hobart TAS 7000');
  assert.deepEqual(floral.sessions,[{date:'2026-11-13',startTime:'13:00',endTime:'17:00'},{date:'2026-11-14',startTime:'09:00',endTime:'17:00'}]);
  assert.match(eventPage,/Event session times/);
  assert.equal(events.some((item)=>item.slug.startsWith('disclaimer-events-listed-are-organised-by-local-groups')),false);
  assert.match(sanitiser,/events listed are organised by local groups/);
});


test('AI Ops listing sanitation batch is present in source data',()=>{
  const crab=places.find((p)=>p.slug==='crabtree-crop-and-crafts-market-crabtree');
  assert.equal(crab.phone,'0419 403 467');
  assert.equal(places.find((p)=>p.slug==='the-hangout-cafe-and-restaurant').address,'100A Main Road, Moonah, TAS 7009');
  const mr=places.find((p)=>p.slug==='mr-burger');
  assert.equal(mr.address,'1 Bayfield St, Rosny Park, TAS 7018');
  assert.equal(mr.town,'Rosny Park');
  const invalid=["farm-gate-market","bass-strait-maritime-centre","lilydale-village-market","cygnet-market","frogmore-creek-wines","bark-mill-tavern-and-bakery","cygnet-old-bank-conservatory-cafe","nara-thai","richmond-bakery","waterfront-cafe","willie-smith-s-apple-shed","ashgrove-cheese-factory","tasman-sea-salt","hokkaido-sushi-cambridge","solo-pasta-and-pizza","magic-curries","prem-s-seafood-bar-and-grill","libby-s-cafe"];
  assert.deepEqual(invalid.filter((slug)=>places.find((p)=>p.slug===slug)?.bookingUrl),[]);
});
