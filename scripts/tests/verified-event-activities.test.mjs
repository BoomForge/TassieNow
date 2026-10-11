import test from 'node:test';
import assert from 'node:assert/strict';
import {applyVerifiedActivityPhotos,verifiedActivitySources} from '../discover/lib/verified-event-activities.mjs';
import {imageIsPublishable,eventImagePriority} from '../discover/lib/event-media.mjs';

const fallback=()=>({url:'/images/categories/events.svg',isFallback:true});
const item=name=>({slug:name,name,town:'Burnie',status:'active',image:fallback()});
test('curated illustrative sources carry independent copyright and credit',()=>{
 assert.ok(verifiedActivitySources.length>=15);
 for(const entry of verifiedActivitySources){
  assert.ok(entry.sourceUrl.startsWith('https://commons.wikimedia.org/wiki/File:'));
  assert.ok(entry.url.startsWith('https://upload.wikimedia.org/wikipedia/commons/'));
  assert.ok(entry.credit);
  assert.ok(entry.licenseUrl.startsWith('https://creativecommons.org/licenses/by-sa/'));
  assert.ok(entry.scene);
 }
});
test('only specific listed activity names receive an appropriate labelled photo',()=>{
 const names=[
  'Roller Skating School Holiday Program','Pickleball School Holiday Sessions',
  'Burnie Orchid Society Show','National Bird Week – Aussie Bird Count',
  'Home Composting Workshop','Diwali - Festival of Light in Burnie',
  'Orava Quartet','Spoke Motorcycle Festival','Archery Come N Try',
  'Brixhibition Hobart 2026','Halloween Fest Hobart',
  'Carols by Candlelight','Bicheno Food and Wine Festival 2026',
  'City of Hobart Floral Shows'
 ];
 const events=names.map(item);
 assert.equal(applyVerifiedActivityPhotos(events),names.length);
 for(const e of events){
  assert.equal(imageIsPublishable(e.image),true);
  assert.equal(e.image.mediaType,'activity-illustrative');
  assert.match(e.image.caption,/does not depict the advertised event in Tasmania/);
 }
 assert.equal(applyVerifiedActivityPhotos(events),0);
});
test('do not fabricate photographs for vague names or unrelated subjects',()=>{
 const events=[
  item('The Canopy Burnie'),item('A Public Council Forum'),
  item('Second Glance Market'),item('Toolskool'),item('Ordinary Musical Evening')
 ];
 assert.equal(applyVerifiedActivityPhotos(events),0);
 assert.ok(events.every(e=>e.image.isFallback));
});
test('a verified named-venue image or approved poster stays preferred',()=>{
 const e=item('Halloween Fest Hobart');
 e.image={url:'https://upload.wikimedia.org/wikipedia/commons/x/xx/hall.jpg',isFallback:false,
   sourceMethod:'verified-event-venue',mediaType:'contextual',
   sourceUrl:'https://commons.wikimedia.org/wiki/File:Hall.jpg',
   license:'CC BY 4.0',licenseUrl:'https://creativecommons.org/licenses/by/4.0/',
   attribution:'Photographer',caption:'Actual venue, not event',
   matchEvidence:{verified:true,venue:'Hobart City Hall',town:'Hobart',
    sourceFilePage:'https://commons.wikimedia.org/wiki/File:Hall.jpg'}
 };
 assert.equal(eventImagePriority(e.image),3);
 assert.equal(applyVerifiedActivityPhotos([e]),0);
});
