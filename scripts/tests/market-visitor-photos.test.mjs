import test from 'node:test';
import assert from 'node:assert/strict';
import {isMarketPlace,selectPhotoEnrichmentTargets} from '../discover/lib/image-enrichment-targets.mjs';
import {chooseExactGoogleMarket,googleMarketSearchUrl} from '../../src/lib/google-market-photos.mjs';

const entry=(slug,categories)=>({slug,categories});
test('reserve slots for markets without starving food and other listings',()=>{
 const records=[
  ...Array.from({length:30},(_,i)=>entry('market'+i,['Markets'])),
  ...Array.from({length:80},(_,i)=>entry('food'+i,['Food & Drink'])),
  ...Array.from({length:100},(_,i)=>entry('place'+i,['Nature & Walks']))
 ];
 const {targets,marketTargetCount,foodQuota}=selectPhotoEnrichmentTargets(records,40,2120);
 assert.equal(targets.length,40);
 assert.equal(new Set(targets.map(x=>x.slug)).size,40);
 assert.ok(marketTargetCount>=10);
 assert.ok(foodQuota>=12);
 assert.ok(targets.some(x=>x.slug.startsWith('place')));
 assert.equal(isMarketPlace(records[0]),true);
});
test('underfilled market category yields spare quota to other sources',()=>{
 const data=[entry('market',['Markets']),...Array.from({length:30},(_,i)=>entry('other'+i,['Museums']))];
 const res=selectPhotoEnrichmentTargets(data,20,2120);
 assert.equal(res.marketTargetCount,1);
 assert.equal(res.targets.length,20);
});
test('Google result must be the exact market and matching town/state',()=>{
 const market={name:'Salamanca Market',town:'Hobart',latitude:-42.886,lng:147.332,longitude:147.332};
 const records=[
  {id:'same-name-wrong-state',displayName:'Salamanca Market',
    formattedAddress:'Melbourne Victoria Australia',location:{lat:-37.81,lng:144.96}},
  {id:'wrong-market',displayName:'Salamanca Farm Market',
    formattedAddress:'Hobart TAS Australia',location:{lat:-42.886,lng:147.332}},
  {id:'correct',displayName:'Salamanca Market',
    formattedAddress:'Salamanca Pl, Hobart TAS 7000, Australia',location:{lat:-42.887,lng:147.334}}
 ];
 assert.equal(chooseExactGoogleMarket(records,market)?.id,'correct');
 assert.equal(chooseExactGoogleMarket(records.slice(0,2),market),null);
 assert.equal(chooseExactGoogleMarket([...records,records[2]],market),null);
});
test('market visitor link searches Google Maps without copying review photos',()=>{
 const url=googleMarketSearchUrl('Salamanca Market','Hobart');
 assert.match(url,/google\.com\/maps\/search\//);
 assert.ok(decodeURIComponent(url).includes('Salamanca Market Hobart Tasmania'));
});
