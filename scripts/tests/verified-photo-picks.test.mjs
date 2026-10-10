import test from 'node:test';
import assert from 'node:assert/strict';
import {applyVerifiedPhotoPicks,verifiedPhotoPicks} from '../discover/lib/verified-photo-picks.mjs';
import {permittedLicence} from '../discover/lib/event-media.mjs';
test('curated photo has source, attributable commercial-use licence, and identity evidence',()=>{
 const image=verifiedPhotoPicks[0].image;
 assert.ok(image.matchEvidence.verified);
 assert.ok(image.sourceUrl.includes('Tessellated-Pavement_Tasmania'));
 assert.equal(permittedLicence(image.license,image.licenseUrl),true);
 assert.equal(image.attribution,'Felix Andrews (Floybix)');
});
test('attach photo to the exact named listing once and preserve later',()=>{
 const place={slug:'tessallated-pavement',name:'Tessallated Pavement',status:'active',image:{isFallback:true}};
 const other={slug:'tessallated-pavement',name:'Not the actual location',status:'active',image:{isFallback:true}};
 assert.equal(applyVerifiedPhotoPicks([place,other]),1);
 assert.equal(place.image.isFallback,false);
 assert.equal(other.image.isFallback,true);
 assert.equal(applyVerifiedPhotoPicks([place,other]),0);
});
test('never overwrite a verified or manually approved photo',()=>{
 const photo={url:'https://example.org/approved.jpg',isFallback:false};
 const place={slug:'tessallated-pavement',name:'Tessallated Pavement',status:'active',image:photo};
 assert.equal(applyVerifiedPhotoPicks([place]),0);
 assert.equal(place.image,photo);
});
