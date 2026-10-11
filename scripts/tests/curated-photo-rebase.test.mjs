import test from 'node:test';
import assert from 'node:assert/strict';
import {applyVerifiedPhotoPicks} from '../discover/lib/verified-photo-picks.mjs';

const placeholder=()=>({
  url:'/images/categories/markets.svg',isFallback:true,license:'Site artwork',attribution:'TassieNow'
});
const farm=(name='Farm Gate Market',slug='farm-gate-market')=>({
  name,slug,status:'active',sourceType:'curated',image:placeholder()
});

test('restores Farm Gate licensed media even without an OSM sourceId',()=>{
  const listing=farm();
  assert.equal(listing.sourceId,undefined);
  assert.equal(applyVerifiedPhotoPicks([listing]),1);
  assert.equal(listing.image.sourceMethod,'verified-curated');
  assert.equal(listing.image.isFallback,false);
  assert.equal(listing.image.license,'CC BY 2.0');
  assert.match(listing.image.sourceUrl,/commons.wikimedia.org/);
});

test('never overwrites a previously selected real photo',()=>{
  const listing=farm();
  listing.image={url:'https://example.org/owned.jpg',isFallback:false,attribution:'Owner'};
  assert.equal(applyVerifiedPhotoPicks([listing]),0);
  assert.equal(listing.image.url,'https://example.org/owned.jpg');
});

test('does not substitute a photo for another market or inactive listing',()=>{
  const other=farm('Another Market');
  const inactive=farm();
  inactive.status='inactive';
  assert.equal(applyVerifiedPhotoPicks([other,inactive]),0);
  assert.equal(other.image.isFallback,true);
  assert.equal(inactive.image.isFallback,true);
});

test('reapplying picks is idempotent',()=>{
  const listing=farm();
  assert.equal(applyVerifiedPhotoPicks([listing]),1);
  assert.equal(applyVerifiedPhotoPicks([listing]),0);
});
