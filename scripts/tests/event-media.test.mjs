import test from 'node:test';
import assert from 'node:assert/strict';
import {permittedLicence,imageIsPublishable,preserveEventImages,metaImageCandidates,eventTitleMatchesFile} from '../discover/lib/event-media.mjs';

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
