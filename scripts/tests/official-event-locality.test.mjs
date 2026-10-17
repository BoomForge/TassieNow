import test from 'node:test';
import assert from 'node:assert/strict';
import events from '../../src/data/events.json' with { type:'json' };
import overrides from '../../src/data/event-overrides.json' with { type:'json' };
import {readFileSync} from 'node:fs';
const redirects=readFileSync(new URL('../../public/_redirects',import.meta.url),'utf8');
for(const [source,oldSlug,newSlug,town,venue,time] of [
 ['https://www.ccc.tas.gov.au/event/rotary-club-of-lindisfarne-talks-dr-bert-shugg/','rotary-club-of-lindisfarne-talks-dr-bert-shugg-2026-11-04-rosny-park','rotary-club-of-lindisfarne-talks-dr-bert-shugg-2026-11-04-lindisfarne','Lindisfarne','Motor Yacht Club of Tasmania','18:15'],
 ['https://www.devonport.tas.gov.au/events/the-great-bug-hunt-and-art-lab/','the-great-bug-hunt-and-art-lab-2026-10-25-devonport','the-great-bug-hunt-and-art-lab-2026-10-25-eugenana','Eugenana','The Tasmanian Arboretum','10:00']
]){
 test(oldSlug+' is canonicalised from its individual first-party source',()=>{
  const matching=events.filter(e=>e.eventUrl===source);
  assert.equal(matching.length,1);
  const e=matching[0];
  assert.equal(e.slug,newSlug);
  assert.equal(e.town,town);
  assert.equal(e.venue,venue);
  assert.equal(e.startTime,time);
  assert.ok(e.address?.includes(town));
  assert.deepEqual(overrides[oldSlug].fields.slug,newSlug);
  assert.equal(overrides[oldSlug].eventUrl,source);
  assert.ok(redirects.includes('/event/'+oldSlug+' /event/'+newSlug+' 301'));
  assert.ok(redirects.includes('/events/'+oldSlug+' /event/'+newSlug+' 301'));
 });
}
