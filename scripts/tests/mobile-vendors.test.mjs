import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const vendors=JSON.parse(await readFile(new URL('../../src/data/mobile-vendors.json',import.meta.url),'utf8'));
test('mobile businesses have official evidence and no fabricated location pins',()=>{
 assert.ok(vendors.length>=3);
 assert.equal(new Set(vendors.map(v=>v.name.toLowerCase())).size,vendors.length);
 for(const vendor of vendors){
  const url=new URL(vendor.sourceUrl);
  assert.equal(url.protocol,'https:');
  assert.ok(vendor.sourceEvidence.length>25);
  assert.ok(vendor.region && vendor.town);
  for(const forbidden of ['latitude','longitude','address','openingHours','coordinates'])assert.equal(vendor[forbidden],undefined);
 }
});
test('temporarily paused vans are clearly marked, never advertised as presently open',()=>{
 const paused=vendors.filter(v=>v.state==='paused');
 assert.ok(paused.length);
 for(const v of paused){assert.match(v.summary,/off road|closed|paused/i);assert.match(v.pauseUntil,/^2026-\d\d-\d\d$/);}
});
test('food browse page exposes explicit mobile operators as food-van filter results',async()=>{
 const src=await readFile(new URL('../../src/pages/food/index.astro',import.meta.url),'utf8');
 assert.match(src,/import mobileVendors/);
 assert.match(src,/data-type="food-van"/);
 assert.match(src,/Source: official business website/);
 assert.match(src,/Temporarily off road/);
 assert.match(src,/No fixed trading address/);
});
