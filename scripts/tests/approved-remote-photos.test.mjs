import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyApprovedRemotePick,applyApprovedRemotePhotos} from '../discover/lib/approved-remote-photos.mjs';
const pick={kind:'place',slug:'example-market',name:'Example Market',town:'Hobart',
 image:{url:'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/example.jpg/1280px-example.jpg',
 sourceUrl:'https://commons.wikimedia.org/wiki/File:Example.jpg',alt:'The exact Example Market stalls',
 attribution:'Original photographer',license:'CC BY 4.0',licenseUrl:'https://creativecommons.org/licenses/by/4.0/'},
 evidence:{status:'verified-open-licence',rightsPage:'https://commons.wikimedia.org/wiki/File:Example.jpg',
 checkedAt:'2026-10-13',identity:'Example Market stalls located in Hobart, Tasmania',
 rightsDetails:'Original file description identifies the photographer and offers CC BY 4.0 commercial-use permission.'}};
const place={slug:'example-market',name:'Example Market',town:'Hobart',status:'active',visibility:'public',image:{isFallback:true}};
test('accept original, independently sourced, reusable external image without rehosting',()=>{
 assert.equal(verifyApprovedRemotePick(pick),null);
 const records=[structuredClone(place)];
 const r=applyApprovedRemotePhotos(records,[],[pick],new Set([pick.image.url]));
 assert.equal(r.placesAdded,1);
 assert.equal(records[0].image.url,pick.image.url);
 assert.equal(records[0].image.useMode,'external-embed');
 assert.equal(records[0].image.sourceMethod,'ai-verified-remote');
 assert.equal(records[0].image.attribution,'Original photographer');
});
test('reject official site image without original-source reuse rights',()=>{
 const p=structuredClone(pick);p.image.license='All rights reserved';
 assert.match(verifyApprovedRemotePick(p),/licence/);
 const r=applyApprovedRemotePhotos([structuredClone(place)],[],[p],new Set([p.image.url]));
 assert.equal(r.placesAdded,0);
});
test('reject Google thumbnail, missing attribution and unverified source',()=>{
 const p=structuredClone(pick);p.image.url='https://lh3.googleusercontent.com/example.jpg';
 assert.match(verifyApprovedRemotePick(p),/search-engine/);
 const q=structuredClone(pick);q.image.attribution='';
 assert.match(verifyApprovedRemotePick(q),/author/);
 const v=structuredClone(pick);v.evidence.status='link-discovered';
 assert.match(verifyApprovedRemotePick(v),/evidence/);
});
test('preserve existing approved images, prevent identity mixups and HTTP failures',()=>{
 const already={...structuredClone(place),image:{url:'https://test.example/legit.jpg',isFallback:false}};
 const wrong={...structuredClone(place),name:'A different market'};
 assert.equal(applyApprovedRemotePhotos([already],[],[pick],new Set([pick.image.url])).placesAdded,0);
 assert.equal(already.image.url,'https://test.example/legit.jpg');
 assert.equal(applyApprovedRemotePhotos([wrong],[],[pick],new Set([pick.image.url])).placesAdded,0);
 assert.equal(applyApprovedRemotePhotos([structuredClone(place)],[],[pick],new Set()).placesAdded,0);
});
test('publish verified event images only for exact dated event identity and labelled context',()=>{
 const p=structuredClone(pick);p.kind='event';p.image.mediaType='contextual';p.image.caption='Venue image, not the current event';
 const futureDate=new Date(Date.now()+14*86400000).toISOString().slice(0,10);
 const events=[{slug:p.slug,name:p.name,town:p.town,status:'active',startDate:futureDate,endDate:futureDate,image:{isFallback:true}}];
 assert.equal(verifyApprovedRemotePick(p),null);
 assert.equal(applyApprovedRemotePhotos([],events,[p],new Set([p.image.url])).eventsAdded,1);
 assert.equal(events[0].image.mediaType,'contextual');
 const expired=[{...structuredClone(events[0]),startDate:'2020-01-01',endDate:'2020-01-01',image:{isFallback:true}}];
 assert.equal(applyApprovedRemotePhotos([],expired,[p],new Set([p.image.url])).eventsAdded,0,'expired events must never receive newly published photographs');
 const bad=structuredClone(p);delete bad.image.caption;
 assert.match(verifyApprovedRemotePick(bad),/caption/);
});
