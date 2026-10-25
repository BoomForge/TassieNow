import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import events from '../../src/data/events.json' with {type:'json'};
import overrides from '../../src/data/event-overrides.json' with {type:'json'};
import {applyReviewedEventCorrection} from '../discover/lib/reviewed-event-corrections.mjs';
const redirects=readFileSync(new URL('../../public/_redirects',import.meta.url),'utf8');
const selected=events.filter(e=>e.eventUrl?.startsWith('https://theatrenorth.com.au/'));

test('original sixteen canonical Theatre North shows remain verified as new listings appear',()=>{
 const originalUrls=new Set(Object.values(overrides)
  .filter(v=>v.eventUrl?.startsWith('https://theatrenorth.com.au/'))
  .map(v=>v.eventUrl));
 const canonical=selected.filter(e=>originalUrls.has(e.eventUrl));
 assert.equal(originalUrls.size,16,'the sixteen reviewed source identities must remain protected');
 assert.equal(canonical.length,16,'all sixteen original shows must still exist');
 assert.equal(new Set(selected.map(e=>e.eventUrl)).size,selected.length,'newly added shows must have unique source URLs');
 assert.equal(new Set(selected.map(e=>e.slug)).size,selected.length,'newly added shows must have unique slugs');
 for(const e of canonical){
  assert.equal(e.venue,'Albert Hall',e.slug);
  assert.equal(e.address,'47 Tamar Street, Launceston TAS 7250',e.slug);
  assert.equal(e.town,'Launceston',e.slug);
  assert.ok(e.presenter && e.presenter.length>3,'show presenter separate: '+e.slug);
  assert.ok(!/Albert Hall, Launceston|\b\d{2}\s(?:Nov|Dec|Feb|Apr|Jul|Sep)\b/.test(e.name),'event card fragments in '+e.name);
  assert.ok(e.summary.includes('See Theatre North'),e.slug);
 }
});

test('legacy long-card slugs redirect to source-keyed canonical show URLs',()=>{
 const originals=Object.entries(overrides).filter(([key,v])=>v.eventUrl?.startsWith('https://theatrenorth.com.au/') && key!==v.fields?.slug);
 assert.equal(originals.length,16);
 for(const [old,v] of originals){
  const current=selected.filter(e=>e.eventUrl===v.eventUrl);
  assert.equal(current.length,1,old);
  assert.equal(current[0].slug,v.fields.slug);
  assert.equal(current[0].name,v.fields.name);
  for(const root of ['/event/','/events/']){
   assert.ok(redirects.includes(root+old+'/ /event/'+v.fields.slug+'/ 301'),'missing redirect '+old);
  }
  const reimported=applyReviewedEventCorrection({...current[0],slug:'unsafe-related-events-card',name:'Wrong show Albert Hall, Launceston 18 Nov'},overrides);
  assert.equal(reimported.slug,v.fields.slug,'reimport canonical correction for '+old);
  assert.equal(reimported.name,v.fields.name);
  assert.equal(reimported.presenter,v.fields.presenter);
 }
});

test('The 60 Four retains its independently sourced local start and end times',()=>{
 const e=selected.find(x=>x.eventUrl==='https://theatrenorth.com.au/the-60-four-27');
 assert.ok(e);
 assert.equal(e.name,'The 60 Four – Studio 64');
 assert.equal(e.startDate,'2027-09-03');
 assert.equal(e.startTime,'19:30');
 assert.equal(e.endTime,'21:40');
});
