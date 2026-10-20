import test from 'node:test';
import assert from 'node:assert/strict';
import events from '../../src/data/events.json' with { type:'json' };
import overrides from '../../src/data/event-overrides.json' with { type:'json' };
import {eventDisplayImage} from '../../src/lib/event-posters.mjs';
for(const slug of ['spoke-motorcycle-festival-2027-02-26-little-swanport','voices-through-art-arch-lived-experience-art-campaign-2026-10-18-burnie']){
 test(slug+' preserves non-photo editorial cover',()=>{
   // A later import can legitimately move a live event's date (and slug).
   // Media policy applies to the current same-title record, not only an old slug.
   const item=events.find(e=>e.slug===slug) || events.find(e=>
     slug.startsWith('voices-through-art-') &&
     /voices through art.*lived experience art campaign/i.test(e.name||''));
   assert.ok(item,'expected current event with verified fallback artwork');
   assert.equal(item.image.isFallback,true);
   assert.equal(item.image.sourceUrl,null);
   assert.equal(overrides[slug].fields.image.isFallback,true);
   assert.equal(eventDisplayImage(item),'/images/event-posters/'+encodeURIComponent(item.slug)+'.svg');
 });
}
