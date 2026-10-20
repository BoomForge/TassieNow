import {test} from 'node:test';
import assert from 'node:assert/strict';
import {balancedByRegion,selectOsmCandidates,commonsFileFromOsmImage} from '../discover/lib/osm-selection.mjs';

const place=(name,sourceId,latitude,longitude,category='Food & Drink',region='Hobart & South')=>({name,slug:name.toLowerCase().replaceAll(' ','-'),sourceId,latitude,longitude,town:'Hobart',region,categories:[category],_score:10});
const opts={retainVerifiedMedia:(next,old)=>{if(old.image)next.image=old.image;},verifiedMedia:image=>Boolean(image&&!image.isFallback)};
test('food capacity is independent from walks and other attractions',()=>{
  const cafes=Array.from({length:5},(_,i)=>place('Cafe '+i,'node/'+i,-42.9+i*.01,147.3));
  const walks=Array.from({length:6},(_,i)=>place('Trail '+i,'way/'+i,-42.7+i*.01,147.8,'Nature & Walks'));
  const result=selectOsmCandidates([...walks,...cafes],[],new Map(),opts,{coreLimit:2,foodLimit:4});
  assert.equal(result.stats.selectedFood,4);
  assert.equal(result.stats.selectedOther,2);
  assert.equal(result.selected.length,6);
});
test('same-name venues in different locations survive with unique deterministic slugs',()=>{
  const h=place('The Corner Cafe','node/10',-42.88,147.32);
  const l=place('The Corner Cafe','node/11',-41.44,147.14,'Food & Drink','Launceston & North');
  l.town='Launceston';
  const first=selectOsmCandidates([h,l],[],new Map(),opts);
  assert.equal(first.selected.length,2);
  assert.equal(new Set(first.selected.map(item=>item.slug)).size,2);
  const oldMap=new Map(first.selected.map(item=>[item.sourceId,item]));
  const repeated=selectOsmCandidates([h,l].map(item=>({...item})),[],oldMap,opts);
  assert.deepEqual(new Set(repeated.selected.map(item=>item.slug)),new Set(first.selected.map(item=>item.slug)));
});
test('same-name records at same coordinates deduplicate, but neighbouring shops do not',()=>{
  const result=selectOsmCandidates([
    place('River Coffee','node/101',-42.90,147.30),
    place('River Coffee','way/101',-42.9001,147.3001),
    place('River Bakery','node/102',-42.9001,147.3001)
  ],[],new Map(),opts);
  assert.equal(result.selected.length,2);
  assert.equal(result.stats.deduplicated,1);
});
test('matching previous source IDs retain verified photo evidence',()=>{
  const p=place('Mountain Coffee','node/7',-42.9,147.3);
  const image={url:'https://upload.wikimedia.org/example.jpg',license:'CC BY',sourceUrl:'https://commons.wikimedia.org/wiki/File:example.jpg',isFallback:false};
  const result=selectOsmCandidates([p],[],new Map([[p.sourceId,{...p,image}]]),opts);
  assert.deepEqual(result.selected[0].image,image);
  assert.equal(result.stats.preservedImages,1);
});
test('region balancing does not starve small regions',()=>{
  const a=[...Array.from({length:10},(_,i)=>place('South '+i,'node/s'+i,-42.5,147.2,'Food & Drink')),
    place('West Coffee','node/w1',-42.0,145.1,'Food & Drink','West Coast')];
  assert.ok(balancedByRegion(a,3).some(p=>p.region==='West Coast'));
});

test('new same-name chain branches never steal an existing published venue slug',()=>{
  const old=place('Harbour Cafe','node/100',-42.9,147.3);
  old.image={url:'https://upload.wikimedia.org/test.jpg',isFallback:false};
  const newLocation=place('Harbour Cafe','node/200',-41.44,147.14,'Food & Drink','Launceston & North');
  newLocation._score=100;
  const result=selectOsmCandidates([newLocation,old].map(p=>({...p})),[],new Map([[old.sourceId,old]]),opts);
  assert.equal(result.selected.find(p=>p.sourceId===old.sourceId).slug,'harbour-cafe');
  assert.notEqual(result.selected.find(p=>p.sourceId===newLocation.sourceId).slug,'harbour-cafe');
});

test('only Commons-tagged photos enter licensed image lookup',()=>{
  assert.equal(commonsFileFromOsmImage('File:Launceston Cafe.jpg'),'Launceston Cafe.jpg');
  assert.equal(commonsFileFromOsmImage('https://commons.wikimedia.org/wiki/File:Cafe_Dining.jpg'),'Cafe Dining.jpg');
  assert.equal(commonsFileFromOsmImage('https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Cafe_photo.jpg/800px-Cafe_photo.jpg'),'Cafe photo.jpg');
  assert.equal(commonsFileFromOsmImage('https://restaurant.example.com/hero.jpg'),null);
});

test('Sky King short business name and complete same-address restaurant merge conservatively',()=>{
 const short=place('Sky King','node/12348261338',-41.180000,146.360000,'Food & Drink','North West');
 short.address='132 William St, Devonport TAS 7310';
 short.town='Devonport';
 const full=place('Sky King Chinese Restaurant & Takeaway','way/1323357562',-41.180052,146.360043,'Food & Drink','North West');
 full.address='132 William Street, Devonport TAS 7310';
 full.phone='+61 3 6424 7306';full.town='Devonport';
 const output=selectOsmCandidates([short,full],[],new Map(),opts);
 assert.equal(output.stats.deduplicated,1);
 assert.equal(output.selected.length,1);
 assert.equal(output.selected[0].sourceId,'way/1323357562');
 assert.equal(output.selected[0].phone,'+61 3 6424 7306');
});
test('same address and nearby coordinates do not merge distinct food traders',()=>{
 const a=place('Sunrise Coffee','node/1',-41.19,146.35,'Food & Drink','North West');
 const b=place('Sunrise Coffee Art Gallery','way/2',-41.19002,146.35002,'Food & Drink','North West');
 a.address=b.address='42 Main Road Devonport TAS 7310';
 assert.equal(selectOsmCandidates([a,b],[],new Map(),opts).selected.length,2);
 const distant=place('Sky King Chinese Restaurant & Takeaway','way/3',-41.20,146.36,'Food & Drink','North West');
 distant.address='132 William Street Devonport TAS 7310';
 assert.equal(selectOsmCandidates([a,distant],[],new Map(),opts).selected.length,2);
});
