import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyCommonsEventImage,approvedCandidateImage,eligibleCommonsImage} from '../discover/lib/event-image-policy.mjs';
import {imageIsPublishable,permittedLicence,preserveEventImages} from '../discover/lib/event-media.mjs';
const event={slug:'brixhibition-hobart-2026-2026-10-10-sorell',name:'Brixhibition Hobart 2026',
  town:'Sorell',startDate:'2026-10-10',status:'active'};
const info={
  descriptionurl:'https://commons.wikimedia.org/wiki/File:Brixhibition_Hobart_2024.jpg',
  thumburl:'https://upload.wikimedia.org/wikipedia/commons/brix.jpg',
  extmetadata:{
    ImageDescription:{value:'Brixhibition Hobart, Tasmania'},
    LicenseShortName:{value:'CC BY-SA 4.0'},
    LicenseUrl:{value:'https://creativecommons.org/licenses/by-sa/4.0/'},
    Artist:{value:'Test photographer'}
  }
};
test('licensed photograph from earlier edition is publishable with truthful year caption',()=>{
 const photo=eligibleCommonsImage(event,{title:'File:Brixhibition Hobart 2024.jpg'},info);
 assert.equal(photo.mediaType,'historical-event');
 assert.match(photo.caption,/2024/);
 assert.match(photo.caption,/not a photo of the 2026 event/);
 assert.equal(imageIsPublishable(photo),true);
 const incoming={...event,image:{url:'/images/categories/events.svg',isFallback:true}};
 assert.equal(preserveEventImages([incoming],[{...event,image:photo}]),1);
 assert.equal(incoming.image.mediaType,'historical-event');
});
test('licensed archived event poster is labelled artwork, not a historical photograph',()=>{
 const photo=eligibleCommonsImage(event,{title:'File:Brixhibition Hobart 2024 poster.jpg'},info);
 assert.equal(photo.mediaType,'event-artwork');
 assert.match(photo.caption,/Archived promotional artwork/);
 assert.equal(imageIsPublishable(photo),true);
});
test('present event artwork can be reused with explicit Commons rights',()=>{
 const photo=eligibleCommonsImage(event,{title:'File:Brixhibition Hobart 2026 poster.jpg'},info);
 assert.equal(photo.mediaType,'event-artwork');
});
test('opposing team sculpture, future editions and unrelated locations are rejected',()=>{
 const opponent={name:'Tasmania JackJumpers v Adelaide 36ers',town:'Glenorchy',startDate:'2026-10-16'};
 assert.equal(classifyCommonsEventImage(opponent,{title:'File:36ERS letter sculpture at Adelaide, 2026.jpg'},info),null);
 assert.equal(classifyCommonsEventImage(event,{title:'File:Brixhibition Hobart 2027.jpg'},info),null);
 assert.equal(classifyCommonsEventImage(event,{title:'File:Brixhibition Sydney 2024.jpg'},{
   extmetadata:{ImageDescription:{value:'Sydney, New South Wales'}}
 }),null);
});
test('named venue contextual photo is labelled, but generic theatre photo is rejected',()=>{
 const venueEvent={name:'Live Mediumship Show Medium Donna Young',town:'Hobart',
   startDate:'2026-10-17',venue:'Theatre Royal Hobart'};
 const contextual=classifyCommonsEventImage(venueEvent,
   {title:'File:Theatre Royal Hobart auditorium.jpg'},
   {extmetadata:{ImageDescription:{value:'Theatre Royal Hobart, Tasmania'}}});
 assert.equal(contextual.mediaType,'contextual');
 assert.match(contextual.caption,/does not depict the advertised event/);
 assert.equal(classifyCommonsEventImage({...venueEvent,venue:'Theatre'},
   {title:'File:Hobart theatre.jpg'},info),null);
});
test('organiser approval must be specific, evidenced and preserved',()=>{
 const base={
   url:'https://organiser.example/brixhibition.jpg',
   sourcePage:'https://organiser.example/events/brixhibition-2026',
   rights:'granted',eventIdentityVerified:true,
   imageType:'official-artwork',credit:'Tasmanian Brick Enthusiasts',
   permission:{grantedBy:'Tasmanian Brick Enthusiasts',verifiedAt:'2026-10-11',
     scope:'TassieNow website including commercial pages',
     evidenceUrl:'https://organiser.example/permissions/brixhibition'}
 };
 const valid=approvedCandidateImage(event,base);
 assert.equal(valid.mediaType,'official-artwork');
 assert.equal(imageIsPublishable(valid),true);
 assert.equal(approvedCandidateImage(event,{...base,rights:'permission-needed'}),null);
 assert.equal(approvedCandidateImage(event,{...base,permission:{...base.permission,evidenceUrl:null}}),null);
 assert.equal(approvedCandidateImage(event,{...base,eventIdentityVerified:false}),null);
});
test('historical organiser images require caption and year, no unlicensed image is publishable',()=>{
 const c={
   url:'https://organiser.example/2024.jpg',sourcePage:'https://organiser.example/2024',
   rights:'granted',eventIdentityVerified:true,imageType:'historical-event',
   credit:'Organiser',permission:{grantedBy:'Organiser',verifiedAt:'2026-10-11',
     evidenceUrl:'https://organiser.example/rights',scope:'TassieNow reuse'}
 };
 assert.equal(approvedCandidateImage(event,c),null);
 assert.equal(approvedCandidateImage(event,{...c,caption:'2024 archive',historicalYear:2024})?.mediaType,'historical-event');
 assert.equal(permittedLicence('CC BY-NC 4.0','https://creativecommons.org/licenses/by/4.0/'),false);
 assert.equal(permittedLicence('All rights reserved','https://creativecommons.org/licenses/by/4.0/'),false);
});
