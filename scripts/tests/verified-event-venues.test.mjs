import test from 'node:test';
import assert from 'node:assert/strict';
import {applyVerifiedEventVenueImages,verifiedEventVenues} from '../discover/lib/verified-event-venues.mjs';
import {imageIsPublishable,eventImagePriority,preserveEventImages} from '../discover/lib/event-media.mjs';
const fallback=()=>({url:'/images/categories/events.svg',isFallback:true});
test('known licence and photographer are preserved for both verified venues',()=>{
 assert.equal(verifiedEventVenues.length,2);
 for(const venue of verifiedEventVenues){
  assert.ok(venue.sourceUrl.startsWith('https://commons.wikimedia.org/wiki/File:'));
  assert.ok(venue.licenseUrl.includes('creativecommons.org/licenses/by'));
  assert.ok(venue.attribution);
 }
});
test('MyState Bank Arena appears on its actual Glenorchy match, without claiming the game is pictured',()=>{
 const events=[{name:'Tasmania JackJumpers v Adelaide 36ers',slug:'match',town:'Glenorchy',
  venue:'MyState Bank Arena',status:'active',image:fallback()}];
 assert.equal(applyVerifiedEventVenueImages(events),1);
 assert.equal(events[0].image.mediaType,'contextual');
 assert.match(events[0].image.caption,/does not depict the advertised event/);
 assert.equal(imageIsPublishable(events[0].image),true);
 assert.equal(applyVerifiedEventVenueImages(events),0);
});
test('Albert Hall is accepted only with named venue and matching Launceston',()=>{
 const good={name:'SEASON 26 Space Neighbours Albert Hall, Launceston 14 Oct',town:'Launceston',
  status:'active',image:fallback()};
 const bad={name:'SEASON 26 Space Neighbours Albert Hall, Launceston 14 Oct',town:'Hobart',
  status:'active',image:fallback()};
 assert.equal(applyVerifiedEventVenueImages([good,bad]),1);
 assert.equal(good.image.attribution,'Mattinbgn');
 assert.equal(bad.image.isFallback,true);
});
test('venue context cannot replace an approved or more specific event photo',()=>{
 const x={name:'Tasmania JackJumpers v Adelaide 36ers',town:'Glenorchy',
  venue:'MyState Bank Arena',status:'active',image:fallback()};
 applyVerifiedEventVenueImages([x]);
 const historical={...x.image,mediaType:'historical-event',caption:'Photo from the 2024 edition; not 2026',historicalYear:2024,
  sourceMethod:'organiser-approved',usagePermission:'granted',
  permissionEvidence:{grantedBy:'Rights holder',verifiedAt:'2026-10-11',evidenceUrl:'https://example.org/proof',
   scope:'TassieNow commercial website'}};
 historical.matchEvidence={verified:true};
 assert.ok(eventImagePriority(historical)>eventImagePriority(x.image));
 const newer={...x,image:fallback()},older={...x,image:historical};
 assert.equal(preserveEventImages([newer],[older]),1);
 assert.equal(newer.image.mediaType,'historical-event');
});
