import test from 'node:test';
import assert from 'node:assert/strict';
import {photoSearchQueries,openverseCandidate,mergePlacePhotoReview}
  from '../discover/lib/openverse-photo-candidates.mjs';

const place={slug:'farm-gate-market',name:'Farm Gate Market',town:'Hobart'};
const work={
  id:'222111aa-1abc-4bcd-9876-f00db1234567',
  title:'Farm Gate Market on Bathurst Street in Hobart, Tasmania',
  creator:'Example Photographer',
  license:'by',
  license_version:'2.0',
  license_url:'https://creativecommons.org/licenses/by/2.0/',
  foreign_landing_url:'https://www.flickr.com/photos/test/1234567/',
  url:'https://live.staticflickr.com/1234/farm-market.jpg',
  category:'photograph',
  width:1600,height:1100,source:'flickr',mature:false,tags:[]
};
const checkedAt='2026-10-11T00:00:00.000Z';

test('queries exact place with town and Tasmania, without Google billing',()=>{
  assert.deepEqual(photoSearchQueries(place),[
    '"Farm Gate Market" Hobart','Farm Gate Market Hobart Tasmania','"Farm Gate Market" Tasmania'
  ]);
});
test('retains strong photographic leads without claiming publication approval',()=>{
  const candidate=openverseCandidate(place,work,checkedAt);
  assert.equal(candidate.id,'openverse:'+work.id);
  assert.equal(candidate.credit,'Example Photographer');
  assert.equal(candidate.licence,'BY 2.0');
  assert.equal(candidate.rights,'independent-verification-needed');
  assert.equal(candidate.identity,'candidate-not-verified');
  assert.equal(candidate.observedAt,checkedAt);
});
test('rejects wrong town or similarly named business in another area',()=>{
  assert.equal(openverseCandidate(place,{...work,title:'Farm Gate Market in Portland, Oregon',tags:[]}),null);
});
test('rejects category matches, generic photos and unrelated places',()=>{
  assert.equal(openverseCandidate(place,{...work,title:'Street food in Hobart Tasmania'}),null);
  assert.equal(openverseCandidate(place,{...work,title:'Farm Gate Market Hobart logo'}),null);
  assert.equal(openverseCandidate(place,{...work,title:'Farm Gate Market Hobart Victoria'}),null);
});
test('rejects restrictive, unverifiable and paid-risk image source metadata',()=>{
  for(const license of ['by-nc','by-nd','by-nc-sa','by-nc-nd','copyrighted','']){
    assert.equal(openverseCandidate(place,{...work,license}),null);
  }
  assert.equal(openverseCandidate(place,{...work,license_url:'https://unknown-license.test/by/2.0/'}),null);
  assert.equal(openverseCandidate(place,{...work,license_url:'https://example.com/?q=creativecommons.org/licenses/by/2.0/'}),null);
  assert.equal(openverseCandidate(place,{...work,license:'by',license_url:'https://creativecommons.org/licenses/by-nc/2.0/'}),null);
  assert.equal(openverseCandidate(place,{...work,foreign_landing_url:'http://flickr.com/photo/123'}),null);
  assert.equal(openverseCandidate(place,{...work,creator:''}),null);
  assert.equal(openverseCandidate(place,{...work,width:250}),null);
});
test('review queue preserves independently granted permissions when research repeats',()=>{
  const approved={...openverseCandidate(place,work,checkedAt),rights:'granted',
    permission:{verifiedAt:'2026-10-11',source:'https://example.org/permission'}};
  const original={ [place.slug]:{name:place.name,town:place.town,candidates:[approved]} };
  const found={ [place.slug]:{name:place.name,town:place.town,
    candidates:[openverseCandidate(place,work,'2026-10-12T00:00:00Z')]} };
  const result=mergePlacePhotoReview(original,found);
  assert.equal(result.added,0);
  assert.deepEqual(result.queue,original);
});
test('deduplicates review candidates across research runs and rejects slug name collision',()=>{
  const candidate=openverseCandidate(place,work,checkedAt);
  const first=mergePlacePhotoReview({}, {[place.slug]:{name:place.name,town:place.town,candidates:[candidate,candidate]}});
  assert.equal(first.added,1);
  const next=mergePlacePhotoReview(first.queue,{[place.slug]:{
    name:'Different Business',town:'Hobart',candidates:[{...candidate,id:'openverse:other'}]
  }});
  assert.equal(next.added,0);
  assert.equal(next.queue[place.slug].candidates.length,1);
});
test('respects bounded candidate capacity',()=>{
  const base={ [place.slug]:{name:place.name,town:place.town,candidates:[]} };
  const batch={ [place.slug]:{name:place.name,town:place.town,
    candidates:Array.from({length:20},(_,i)=>({id:'openverse:'+i,url:'https://example.org/'+i}))}};
  assert.equal(mergePlacePhotoReview(base,batch,{maxCandidates:4}).queue[place.slug].candidates.length,4);
});

test('merges results into an incomplete older review without overwriting its metadata',()=>{
 const existing={[place.slug]:{name:place.name,town:place.town,needs:'keep owner note'}};
 const {queue,added}=mergePlacePhotoReview(existing,{[place.slug]:{
   name:place.name,town:place.town,candidates:[openverseCandidate(place,work,checkedAt)]
 }});
 assert.equal(added,1);
 assert.equal(queue[place.slug].needs,'keep owner note');
 assert.equal(queue[place.slug].candidates.length,1);
});
