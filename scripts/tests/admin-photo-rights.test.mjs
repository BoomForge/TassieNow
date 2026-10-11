import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptAdminPhoto, photoLicence } from '../../functions/_lib/photo-rights.js';
import { readFileSync } from 'node:fs';

const proposed={
 name:'Ross Village Market',image_url:'https://example.org/market-photo.jpg', image_display_mode:'external-embed',
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
  {image_url:'https://example.org/images/categories/markets.svg'},
  {image_url:'https://lh3.googleusercontent.com/a/review-photo.jpg'}
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

test('photo page links the original source and licence for accountable attribution',()=>{
 const source=readFileSync('src/pages/place/[slug].astro','utf8');
 assert.match(source,/href=\{place\.image\.sourceUrl\}/);
 assert.match(source,/href=\{place\.image\.licenseUrl\}/);
});

import { photoSourceLink } from '../../functions/_lib/photo-sources.js';

test('source-only links require original source and place identity, never a reuse licence',()=>{
 const link=photoSourceLink({photo_link_url:'https://example.org/gallery/market',
  photo_link_title:'Ross market photos',photo_link_credit:'Local organiser',
  photo_source_confirmed:true},'2026-10-11');
 assert.equal(link.kind,'external-source-link');
 assert.equal(link.sourceUrl,'https://example.org/gallery/market');
 assert.ok(!('license' in link));
 assert.ok(!('url' in link));
 assert.throws(()=>photoSourceLink({photo_link_url:'https://google.com/search?q=market',
  photo_source_confirmed:true,photo_link_title:'Market'},'2026-10-11'));
 assert.throws(()=>photoSourceLink({photo_link_url:'https://example.org/market',photo_link_title:'Market'},'2026-10-11'));
});
test('external display requires a licence while a link only does not',()=>{
 assert.throws(()=>acceptAdminPhoto({...proposed,image_rights_confirmed:false},null,'2026-10-11'));
 assert.equal(acceptAdminPhoto(proposed,null,'2026-10-11').useMode,'external-embed');
 assert.throws(()=>acceptAdminPhoto({...proposed,image_display_mode:'hosted'},null,'2026-10-11'));
 const hosted=acceptAdminPhoto({...proposed,image_url:'/uploads/admin/2026-10/market-photo.webp',
  image_display_mode:'hosted'},null,'2026-10-11');
 assert.equal(hosted.useMode,'hosted');
});
test('external photo source links never become hero photos in API or page markup',()=>{
 const source=readFileSync('src/pages/place/[slug].astro','utf8');
 assert.match(source,/Original photo sources/);
 assert.match(source,/href=\{link.sourceUrl\}/);
 assert.match(source,/place\.image\?\.isFallback/);
 const api=readFileSync('functions/api/admin/catalogue.js','utf8');
 assert.match(api,/heroPhotoChanged: false/);
 assert.match(api,/photoSourceLink\(body/);
 const preservation=readFileSync('scripts/merge-previous-catalogue.mjs','utf8');
 assert.match(preservation,/'photoLinks'/);
});
