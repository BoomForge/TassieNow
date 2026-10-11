import test from 'node:test';
import assert from 'node:assert/strict';
import {applyVerifiedActivityPhotos,verifiedActivitySources,canonicalCommonsImageUrl} from '../discover/lib/verified-event-activities.mjs';
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

test('second pass finds accurate, labelled photographs for overlooked event activities',()=>{
 const events=[
  'Emu Valley Rhododendron Garden Party',
  'AI Unpacked (Part 1 of 2): An Introduction to Generative AI for Small Business',
  'Intro to Computing at Burnie Library',
  'Rock and Rhyme at Huonville Library',
  'Starting your Family History Search + morning tea',
  'Mandarin Lessons',
  'ACOTAR 6 Midnight Release Event',
  'Community Bake Days',
  'Franklin Movie Nights',
  'North West Film Society – I Swear',
  'Come and try – disability golf',
  '2027 King Island Pro Am',
  'Fundamental Pilates'
 ].map(item);
 assert.equal(applyVerifiedActivityPhotos(events),events.length);
 for(const event of events){
  assert.equal(imageIsPublishable(event.image),true,event.name);
  assert.equal(event.image.mediaType,'activity-illustrative');
  assert.match(event.image.caption,/does not depict the advertised event in Tasmania/);
 }
});
test('image URLs are derived from canonical Wikimedia Commons filenames, never guessed CDN hashes',()=>{
 const source='https://commons.wikimedia.org/wiki/File:Pickleball_Players.jpg';
 assert.equal(canonicalCommonsImageUrl(source),
  'https://upload.wikimedia.org/wikipedia/commons/1/1f/Pickleball_Players.jpg');
 const books=verifiedActivitySources.find(s=>s.topic==='books and reading');
 assert.ok(canonicalCommonsImageUrl(books.sourceUrl).includes('/2/2a/Books_on_shelves_IMG_8422.jpg'));
});
test('a broken historical activity CDN path repairs without replacing licensed event-specific photos',()=>{
 const broken=item('Fundamental Pilates');
 const source=verifiedActivitySources.find(s=>s.topic==='pilates');
 broken.image={
  url:'https://upload.wikimedia.org/wikipedia/commons/0/00/Pilates_Training.jpg',
  sourceUrl:source.sourceUrl,sourceMethod:'verified-event-activity',
  attribution:source.credit,license:source.license,licenseUrl:source.licenseUrl,
  caption:'Illustration',mediaType:'activity-illustrative',isFallback:false,
  matchEvidence:{verified:true,verifiedType:'activity-illustrative',topic:'pilates',
   eventName:broken.name,sourceFilePage:source.sourceUrl}
 };
 assert.equal(applyVerifiedActivityPhotos([broken]),1);
 assert.equal(broken.image.url,canonicalCommonsImageUrl(source.sourceUrl));
 assert.equal(applyVerifiedActivityPhotos([broken]),0);
});
