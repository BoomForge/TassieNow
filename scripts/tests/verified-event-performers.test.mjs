import test from 'node:test';
import assert from 'node:assert/strict';
import {applyVerifiedPerformerImages,verifiedPerformers} from '../discover/lib/verified-event-performers.mjs';
import {imageIsPublishable,eventImagePriority} from '../discover/lib/event-media.mjs';
const fallback=()=>({url:'/images/categories/events.svg',isFallback:true});
const record=name=>({name,slug:name,town:'Hobart',status:'active',image:fallback()});
test('four performer sources carry licence, author, source and photograph year',()=>{
 assert.equal(verifiedPerformers.length,5);
 for(const image of verifiedPerformers){
  assert.ok(image.credit);
  assert.ok(image.sourceUrl.startsWith('https://commons.wikimedia.org/wiki/File:'));
  assert.ok(image.licenseUrl.startsWith('https://creativecommons.org/'));
  assert.ok(image.year>=2000);
 }
});
test('name matching upgrades only correct event performer, including Björn Unicode',()=>{
 const events=[record('Geraldine Hickey Weight My Chest'),record('The Wiggles SPARKLE! BIG SHOW 2026'),
  record('Delta Goodrem - PURE World Tour'),
  record('Björn Again ABBA Forever Tour'),record('Ross Noble Cranium of Curiosities'),
  record('Wiggles photography workshop')];
 assert.equal(applyVerifiedPerformerImages(events),5);
 for(const event of events.slice(0,5)){
  assert.equal(event.image.mediaType,'performer-context');
  assert.equal(imageIsPublishable(event.image),true);
  assert.match(event.image.caption,/does not depict the advertised event/);
 }
 assert.equal(events[5].image.isFallback,true);
 assert.equal(applyVerifiedPerformerImages(events),0);
});
test('performer context supersedes venue context but not genuine event photographs',()=>{
 const event=record('The Wiggles SPARKLE! BIG SHOW 2026');
 event.image={url:'https://example.org/venue.jpg',sourceUrl:'https://commons.wikimedia.org/wiki/File:venue.jpg',
  attribution:'Photographer',license:'CC BY 4.0',licenseUrl:'https://creativecommons.org/licenses/by/4.0/',
  mediaType:'contextual',sourceMethod:'verified-event-venue',caption:'Venue not event',isFallback:false,
  matchEvidence:{verified:true,venue:'Arena',town:'Hobart',sourceFilePage:'https://commons.wikimedia.org/wiki/File:venue.jpg'}};
 assert.equal(applyVerifiedPerformerImages([event]),1);
 assert.ok(eventImagePriority(event.image)>3);
 event.image.mediaType='event-photo';
 event.image.sourceMethod='organiser-approved';
 event.image.usagePermission='granted';
 event.image.permissionEvidence={grantedBy:'Rights owner',verifiedAt:'2026-10-11',scope:'TassieNow website',
  evidenceUrl:'https://example.org/approval'};
 assert.equal(applyVerifiedPerformerImages([event]),0);
});
