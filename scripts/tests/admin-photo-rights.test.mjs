import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptAdminPhoto, photoLicence } from '../../functions/_lib/photo-rights.js';
import { readFileSync } from 'node:fs';

const proposed={
 name:'Ross Village Market',image_url:'https://example.org/market-photo.jpg',
 image_alt:'Stalls at Ross Village Market, Ross',
 image_attribution:'Example Photographer',image_license:'CC BY-SA 2.0',
 image_source_url:'https://www.flickr.com/photos/example/12345',
 image_rights_confirmed:true
};

test('verified licence is normalized to a canonical Creative Commons URL',()=>{
 const media=acceptAdminPhoto(proposed,null,'2026-10-11');
 assert.equal(media.license,'CC BY-SA 2.0');
 assert.equal(media.licenseUrl,'https://creativecommons.org/licenses/by-sa/2.0/');
 assert.equal(media.rightsEvidence.status,'owner-attested');
 assert.equal(media.isFallback,false);
});
test('credits, Google searches and unknown rights never silently become real photos',()=>{
 for(const change of [
  {image_rights_confirmed:false},
  {image_attribution:'Owner supplied'},
  {image_license:'Copyright, credit provided'},
  {image_source_url:'https://www.google.com/search?tbm=isch&q=market'},
  {image_url:'https://example.org/images/categories/markets.svg'}
 ])assert.throws(()=>acceptAdminPhoto({...proposed,...change},null,'2026-10-11'));
});
test('direct permission needs a dated scoped documented grant',()=>{
 assert.throws(()=>acceptAdminPhoto({...proposed,image_license:'Rights-holder permission'},null,'2026-10-11'));
 const image=acceptAdminPhoto({...proposed,image_license:'Rights-holder permission',
  image_permission_notes:'Market organiser granted website display and resizing on 2026-10-11; credit Example Photographer.'},null,'2026-10-11');
 assert.equal(image.license,'Rights-holder permission');
});
test('public-domain evidence must be specific and CC noncommercial licence is rejected',()=>{
 assert.throws(()=>photoLicence('CC BY-NC 4.0'));
 assert.throws(()=>acceptAdminPhoto({...proposed,image_license:'Public domain'},null,'2026-10-11'));
});
test('existing published photos are unchanged by a different catalogue edit',()=>{
 const old=acceptAdminPhoto(proposed,null,'2026-10-11');
 const unchanged=acceptAdminPhoto({...proposed,image_license_url:old.licenseUrl},old,'2026-10-12');
 assert.equal(unchanged,old);
});
test('image-only catalogue edits do not turn a discovered business into a manual-only listing',()=>{
 const source=readFileSync('functions/api/admin/catalogue.js','utf8');
 assert.match(source,/const listingChanged = editable\.some/);
 assert.match(source,/else if \(place\.image !== previousImage/);
 assert.match(source,/imageManagedManually = true/);
});
test('admin UI offers CC-filtered Google discovery and source-based rights attestation',()=>{
 const source=readFileSync('src/pages/admin.astro','utf8');
 assert.match(source,/photo-google-cc/);
 assert.match(source,/searchParams\.set\('tbs','il:cl'\)/);
 assert.match(source,/photo-candidate-review/);
 assert.match(source,/image_rights_confirmed/);
 assert.match(source,/\/api\/admin\/photo-research/);
});
