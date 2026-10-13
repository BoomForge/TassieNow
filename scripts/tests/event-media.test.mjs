import test from 'node:test';
import assert from 'node:assert/strict';
import {permittedLicence,imageIsPublishable,preserveEventImages,metaImageCandidates,eventTitleMatchesFile,shouldUpgradeEventImage} from '../discover/lib/event-media.mjs';

const original={
 slug:'brixhibition-hobart-2026-2026-10-10-sorell',
 name:'Brixhibition Hobart 2026',town:'Sorell',region:'Hobart & South',
 startDate:'2026-10-10',
 image:{
  url:'https://upload.wikimedia.org/wikipedia/commons/thumb/test.jpg',
  attribution:'Original photographer',license:'CC BY 4.0',
  licenseUrl:'https://creativecommons.org/licenses/by/4.0/',
  sourceMethod:'commons-event',matchEvidence:{verified:true,eventName:'Brixhibition Hobart 2026',sourceFileTitle:'Brixhibition Hobart 2026'},isFallback:false
 }
};
const category=()=>({url:'/images/categories/events.svg',isFallback:true});
test('existing licensed media survives replacement discovery record',()=>{
 const incoming={...original,image:category()};
 assert.equal(preserveEventImages([incoming],[original]),1);
 assert.equal(incoming.image.url,original.image.url);
 assert.equal(incoming.image.attribution,'Original photographer');
});
test('never attach the image of another event in a different town',()=>{
 const incoming={...original,town:'Launceston',slug:'different',image:category()};
 assert.equal(preserveEventImages([incoming],[original]),0);
 assert.equal(incoming.image.isFallback,true);
});
test('copyright is NOT a CC licence',()=>{
 assert.equal(permittedLicence('All rights reserved','https://brixhibition.com/'),false);
 assert.equal(permittedLicence('CC BY 4.0','https://creativecommons.org/licenses/by/4.0/'),true);
 assert.equal(permittedLicence('CC BY-SA 4.0','https://creativecommons.org/licenses/by-sa/4.0/'),true);
 assert.equal(permittedLicence('CC BY-NC 4.0',''),false);
 assert.equal(imageIsPublishable({...original.image,license:'All rights reserved',licenseUrl:null}),false);
});
test('extract official page image links without granting rights',()=>{
 const html='<meta property="og:image" content="/images/brix-2026.jpg">'
  +'<img src="data55/images/Image18.jpg" alt="Brixhibition pirate ships">'
  +'<img src="/favicon.png" alt="favicon">'
  +'<img src="https://unrelated.example/img.jpg">';
 const candidates=metaImageCandidates(html,'https://www.brixhibition.com/');
 assert.equal(candidates.length,2);
 assert.equal(candidates[0].url,'https://www.brixhibition.com/images/brix-2026.jpg');
 assert.equal(candidates[1].url,'https://www.brixhibition.com/data55/images/Image18.jpg');
 assert.ok(candidates.every(c=>c.rights==='permission-needed'));
});

test('reject Adelaide sculpture as photograph of JackJumpers basketball match',()=>{
 const file='File:36ERS letter sculpture at Adelaide Entertainment Centre, 9 January 2026.jpg';
 assert.equal(eventTitleMatchesFile('Tasmania JackJumpers v Adelaide 36ers',file),false);
 assert.equal(imageIsPublishable({...original.image,matchEvidence:{verified:true,eventName:'Tasmania JackJumpers v Adelaide 36ers',sourceFileTitle:file}}),false);
});
test('accept a filename that names the specific event and matching year',()=>{
 assert.equal(eventTitleMatchesFile('Brixhibition Hobart 2026','File:Brixhibition Hobart 2026 display.jpg'),true);
 assert.equal(eventTitleMatchesFile('Brixhibition Hobart 2026','File:Brixhibition Hobart 2024 display.jpg'),false);
});
test('reject generic concert or venue photograph as event identity evidence',()=>{
 assert.equal(eventTitleMatchesFile('Tasmania JackJumpers v Adelaide 36ers','File:Adelaide 36ers venue.jpg'),false);
});

test('preserve rights while repairing a Commons CDN URL under the same verified source',()=>{
 const base={url:'https://upload.wikimedia.org/wikipedia/commons/0/00/Golf_green.jpg',
  sourceUrl:'https://commons.wikimedia.org/wiki/File:Golf_green.jpg',
  sourceMethod:'verified-event-activity',mediaType:'activity-illustrative',isFallback:false,
  attribution:'Dan Perry',license:'CC BY 2.0',licenseUrl:'https://creativecommons.org/licenses/by/2.0/',
  caption:'Illustrative photo: a golf green, not the advertised event',
  matchEvidence:{verified:true,verifiedType:'activity-illustrative',topic:'golf',
    eventName:'Disability golf',sourceFilePage:'https://commons.wikimedia.org/wiki/File:Golf_green.jpg'}};
 const fixed={...base,url:'https://upload.wikimedia.org/wikipedia/commons/6/62/Golf_green.jpg'};
 assert.equal(shouldUpgradeEventImage(base,fixed),true);
 assert.equal(shouldUpgradeEventImage(fixed,fixed),false);
 const different={...fixed,sourceUrl:'https://commons.wikimedia.org/wiki/File:Different.jpg'};
 assert.equal(shouldUpgradeEventImage(base,different),false);
 const unlicensed={...fixed,license:'All rights reserved',licenseUrl:null};
 assert.equal(shouldUpgradeEventImage(base,unlicensed),false);
});
test('event-specific photographs supersede contextual images but not in reverse',()=>{
 const context={url:'https://upload.wikimedia.org/wikipedia/commons/a/aa/hall.jpg',
  attribution:'Creator',license:'CC BY 4.0',licenseUrl:'https://creativecommons.org/licenses/by/4.0/',
  sourceMethod:'verified-event-venue',mediaType:'contextual',isFallback:false,
  caption:'Venue photo, not this event',matchEvidence:{verified:true,venue:'Hall',town:'Hobart',
    sourceFilePage:'https://commons.wikimedia.org/wiki/File:Hall.jpg'}};
 assert.equal(shouldUpgradeEventImage(context,original.image),true);
 assert.equal(shouldUpgradeEventImage(original.image,context),false);
});

test('official event photo recovery keeps externally hosted and lazy source images review-only', async()=>{
 const {researchOfficialEventImages}=await import('../discover/lib/event-photo-recovery.mjs');
 const html='<meta property="og:image" content="https://images.example.net/theatre.webp">'+
 '<img data-src="/wp-content/uploads/beauty-and-beast-jr.jpg" alt="Beauty and the Beast JR">'+
 '<img srcset="/tiny.webp 200w, /large.webp 1200w" alt="Official event">'+
 '<img src="/favicon.png" alt="logo">';
 const found=researchOfficialEventImages(html,'https://www.huonvalley.tas.gov.au/event/beauty-and-the-beast-jr/');
 assert.ok(found.some(c=>c.url==='https://images.example.net/theatre.webp'&&c.externalAssetHost===true));
 assert.ok(found.some(c=>c.url.endsWith('/wp-content/uploads/beauty-and-beast-jr.jpg')));
 assert.ok(found.some(c=>c.url.endsWith('/large.webp')));
 assert.ok(found.every(c=>c.rights==='permission-needed'));
 assert.ok(!found.some(c=>c.url.endsWith('/favicon.png')));
});
test('recovery prioritises confirmed source-image cases missing queue candidates',async()=>{
 const {selectEventPhotoRecoveryTargets}=await import('../discover/lib/event-photo-recovery.mjs');
 const beauty={slug:'beauty-and-the-beast-jr-2026-10-12-huonville',
  status:'active',startDate:'2026-10-12',endDate:'2026-10-17'};
 const other={slug:'older',status:'active',startDate:'2026-10-13',endDate:'2026-10-15'};
 const future={slug:'future',status:'active',startDate:'2026-12-01',endDate:'2026-12-02'};
 const sourceLinks={[beauty.slug]:{evidence:{imageFoundOnPage:true}}};
 const selected=selectEventPhotoRecoveryTargets([other,beauty,future],{
  today:'2026-10-13',limit:2,sourceLinks,review:{},slot:1});
 assert.equal(selected[0].slug,beauty.slug);
 assert.equal(selected.length,2);
 const whenReviewed=selectEventPhotoRecoveryTargets([other,beauty],{
  today:'2026-10-13',limit:1,sourceLinks,review:{
    [beauty.slug]:{candidates:[{url:'https://example.org/photo.jpg'}]}
  },slot:0});
 assert.equal(whenReviewed.length,1);
 assert.equal(whenReviewed[0].slug,other.slug);
});

test('original business/market discovery uses image metadata only as unverified leads',async()=>{
 const {researchOfficialEventImages}=await import('../discover/lib/event-photo-recovery.mjs');
 const html='<meta property="og:image" content="https://cdn.example.org/photos/cygnet-market.jpg">';
 const result=researchOfficialEventImages(html,'https://cygnetmarket.com.au/');
 assert.equal(result.length,1);
 assert.equal(result[0].rights,'permission-needed');
 assert.equal(result[0].externalAssetHost,true);
});
