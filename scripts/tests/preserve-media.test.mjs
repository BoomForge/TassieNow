import test from 'node:test';
import assert from 'node:assert/strict';
import { retainVerifiedMedia, verifiedMedia } from '../discover/lib/preserve-media.mjs';

const photo=(name)=>({
 url:'https://upload.wikimedia.org/wikipedia/commons/thumb/'+name+'.jpg',
 sourceUrl:'https://commons.wikimedia.org/wiki/File:'+name+'.jpg',
 license:'CC BY-SA 4.0', attribution:'Test photographer',
 isFallback:false, sourceMethod:'wikidata-p18'
});
const place=(image=null)=>({sourceType:'openstreetmap',sourceId:'node/42',image,gallery:[]});

test('retains a provenance-verified hero and gallery when an importer resets media',()=>{
 const previous=place(photo('original'));
 previous.gallery=[photo('detail'),photo('original')];
 const next=retainVerifiedMedia(place({url:'/images/categories/food.svg',isFallback:true}),previous);
 assert.deepEqual(next.image,previous.image);
 assert.deepEqual(next.gallery,[photo('detail')]);
 assert.notEqual(next.image,previous.image);
});
test('never replaces a newly verified hero with an older one',()=>{
 const next=place(photo('new'));
 retainVerifiedMedia(next,place(photo('old')));
 assert.equal(next.image.sourceUrl,photo('new').sourceUrl);
});
test('rejects missing photo attribution or licence and mismatched identities',()=>{
 const unlicensed={...photo('wrong'),license:''};
 assert.equal(verifiedMedia(unlicensed),false);
 const next=place(null);
 retainVerifiedMedia(next,place(unlicensed));
 assert.equal(next.image,null);
 retainVerifiedMedia(next,{...place(photo('different')),sourceId:'node/900'});
 assert.equal(next.image,null);
});

test('retains licensed and attested locally hosted uploads but not arbitrary local files',()=>{
 const hosted={url:'/uploads/admin/2026-10/market.webp',sourceUrl:'https://example.org/photo/1',
  license:'Rights-holder permission',attribution:'Market owner',isFallback:false,
  useMode:'hosted',sourceMethod:'manual-reviewed',rightsEvidence:{status:'owner-attested'}};
 assert.equal(verifiedMedia(hosted),true);
 const next=retainVerifiedMedia(place(null),place(hosted));
 assert.equal(next.image.url,hosted.url);
 assert.equal(verifiedMedia({...hosted,rightsEvidence:undefined}),false);
 assert.equal(verifiedMedia({...hosted,url:'/images/categories/market.svg'}),false);
});
