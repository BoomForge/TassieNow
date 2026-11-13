import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import events from '../../src/data/events.json' with {type:'json'};
import overrides from '../../src/data/event-overrides.json' with {type:'json'};
import {applyReviewedEventCorrection} from '../discover/lib/reviewed-event-corrections.mjs';
import {tasmaniaDate} from '../../src/lib/market-seo.mjs';
const currentDay=tasmaniaDate();
const canonicalDate=(v)=>v.fields?.endDate||v.fields?.startDate||v.fields?.slug?.match(/\d{4}-\d{2}-\d{2}/)?.[0];
const redirects=readFileSync(new URL('../../public/_redirects',import.meta.url),'utf8');
const selected=events.filter(e=>e.eventUrl?.startsWith('https://theatrenorth.com.au/'));


test('original sixteen reviewed Theatre North sources survive expiry and new show imports',()=>{
 const original=Object.values(overrides).filter(v=>v.eventUrl?.startsWith('https://theatrenorth.com.au/'));
 const originalUrls=new Set(original.map(v=>v.eventUrl));
 assert.equal(originalUrls.size,16,'all sixteen reviewed source identities remain protected');
 for(const rule of original){
  const matching=selected.filter(e=>e.eventUrl===rule.eventUrl);
  const expiry=canonicalDate(rule);
  assert.ok(expiry,'reviewed Theatre North record must have a recoverable date');
  assert.equal(matching.length,expiry>=currentDay?1:0,rule.eventUrl+' current catalogue');
  const e=matching[0]||applyReviewedEventCorrection({slug:rule.fields.slug,eventUrl:rule.eventUrl},overrides);
  assert.equal(e.venue,'Albert Hall',e.slug);
  assert.equal(e.address,'47 Tamar Street, Launceston TAS 7250',e.slug);
  assert.equal(e.town,'Launceston',e.slug);
  assert.ok(e.presenter && e.presenter.length>3,'show presenter separate: '+e.slug);
  assert.ok(!/Albert Hall, Launceston|\b\d{2}\s(?:Nov|Dec|Feb|Apr|Jul|Sep)\b/.test(e.name),'event card fragments in '+e.name);
  assert.ok(e.summary.includes('See Theatre North'),e.slug);
 }
 assert.equal(new Set(selected.map(e=>e.eventUrl)).size,selected.length,'unique source URLs');
 assert.equal(new Set(selected.map(e=>e.slug)).size,selected.length,'unique current slugs');
});


test('all sixteen historical Theatre North aliases still redirect and correct future reimports',()=>{
 const originals=Object.entries(overrides).filter(([key,v])=>v.eventUrl?.startsWith('https://theatrenorth.com.au/') && key!==v.fields?.slug);
 assert.equal(originals.length,16);
 for(const [old,v] of originals){
  const current=selected.filter(e=>e.eventUrl===v.eventUrl);
  assert.equal(current.length,canonicalDate(v)>=currentDay?1:0,old);
  const source=current[0]||{slug:old,eventUrl:v.eventUrl};
  const e=applyReviewedEventCorrection(source,overrides);
  assert.equal(e.slug,v.fields.slug);
  assert.equal(e.name,v.fields.name);
  for(const root of ['/event/','/events/'])
   assert.ok(redirects.includes(root+old+'/ /event/'+v.fields.slug+'/ 301'),'missing redirect '+old);
  const reimported=applyReviewedEventCorrection({...source,slug:'unsafe-related-events-card',name:'Wrong show Albert Hall, Launceston 18 Nov'},overrides);
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
