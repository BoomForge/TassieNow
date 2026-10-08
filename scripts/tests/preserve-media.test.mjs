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
