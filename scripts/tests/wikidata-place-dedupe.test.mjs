import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dedupeIdenticalWikidataPlaces,dedupeReviewedBeaconsfieldCentre} from '../../src/lib/wikidata-place-dedupe.mjs';

const base=(slug,id,extra={})=>({
 slug,name:'Trowunna Wildlife Park',town:'Tasmania',region:'North West',
 latitude:-41.55577,longitude:146.45228,sourceType:'wikidata',
 sourceId:id,wikidata:id,categories:['Things to Do'],
 image:{url:'/images/categories/discover.svg',isFallback:true},
 ...extra
});
test('one exact same-QID attraction per place; preserve reviewed address, useful categories and photo metadata',()=>{
 const rich=base('trowunna-wildlife-park','Q21924192',{
  town:'Mole Creek',address:'1892 Mole Creek Road, Mole Creek TAS 7304',
  categories:['Wildlife','Family'],image:{url:'https://images.example/photo.jpg',isFallback:false,attribution:'Named photographer',license:'CC BY 4.0'}
 });
 const other=base('trowunna-wildlife-park-2','Q21924192',{categories:['Things to Do'],gallery:[{sourceUrl:'https://commons.wikimedia.org/wiki/File:Known.jpg',attribution:'Named author',license:'CC BY 4.0'}]});
 const result=dedupeIdenticalWikidataPlaces([other,rich]);
 assert.equal(result.removed,1);
 assert.equal(result.groups,1);
 assert.equal(result.places.length,1);
 const p=result.places[0];
 assert.equal(p.slug,'trowunna-wildlife-park');
 assert.equal(p.town,'Mole Creek');
 assert.match(p.address,/Mole Creek/);
 assert.deepEqual(new Set(p.categories),new Set(['Wildlife','Family','Things to Do']));
 assert.equal(p.gallery.length,1);
 assert.deepEqual(result.aliases,[{from:'trowunna-wildlife-park-2',to:'trowunna-wildlife-park',qid:'Q21924192'}]);
 assert.equal(dedupeIdenticalWikidataPlaces(result.places).removed,0,'idempotent');
});
test('never merge merely similar names, different QIDs, different locations or owner-managed records',()=>{
 const a=base('bluff-beach','Q1',{name:'Bluff Beach',latitude:-42.74,longitude:147.89});
 const b=base('bluff-beach-2','Q2',{name:'Bluff Beach',latitude:-40.1,longitude:148});
 const distant=base('southwest-national-park','Q3',{name:'Southwest National Park',latitude:-42.8336,longitude:146.149});
 const distant2=base('southwest-national-park-2','Q3',{name:'Southwest National Park',latitude:-42.9333,longitude:146.1333});
 const manual=base('curated-entry','Q4',{managedManually:true});
 const manual2=base('curated-entry-2','Q4');
 const osm=base('other-source','Q21924192',{sourceType:'openstreetmap'});
 const subject=[a,b,distant,distant2,manual,manual2,osm];
 const r=dedupeIdenticalWikidataPlaces(subject);
 assert.equal(r.removed,0);
 assert.equal(r.places.length,subject.length);
});
test('same QID but different place names are retained for manual review',()=>{
 const a=base('ross-bakery','Q103817798',{name:'Ross Bakery'});
 const b=base('ross-bakery-inn','Q103817798',{name:'Ross Bakery Inn'});
 assert.equal(dedupeIdenticalWikidataPlaces([a,b]).removed,0);
});
test('verified old same-ID place URLs have matching 301s before a future build consolidates them',()=>{
 const redirects=readFileSync(new URL('../../public/_redirects',import.meta.url),'utf8');
 const pairs=[
 ['trowunna-wildlife-park-2','trowunna-wildlife-park'],
 ['tasmania-zoo-2','tasmania-zoo'],
 ['zoodoo-wildlife-park-2','zoodoo-wildlife-park'],
 ['hobart-zoo-2','hobart-zoo'],
 ['coningham-beach-2','coningham-beach'],
 ['coningham-beach-3','coningham-beach'],
 ['something-wild-wildlife-sanctuary-2','something-wild-wildlife-sanctuary'],
 ['little-christmas-island-nature-reserve-2','little-christmas-island-nature-reserve'],
 ['governor-island-marine-nature-reserve-2','governor-island-marine-nature-reserve'],
 ['nudists-beach-2','nudists-beach'],
 ['edgcumbe-beach-2','edgcumbe-beach'],
 ['beagle-marine-park-2','beagle-marine-park'],
 ['black-pyramid-rock-2','black-pyramid-rock'],
 ['australasian-golf-museum-2','australasian-golf-museum']
 ];
 assert.equal(pairs.length,14);
 for(const [from,to] of pairs){
  for(const oldPrefix of ['/place/','/places/'])
   assert.ok(redirects.includes(oldPrefix+from+'/ /place/'+to+'/ 301'),from+' -> '+to);
 }
});
test('Wikidata importer consolidates repeated within-batch QIDs, not just already stored IDs',()=>{
 const source=readFileSync(new URL('../discover/wikidata-import.mjs',import.meta.url),'utf8');
 assert.match(source,/newCandidateByQid=new Map\(\)/);
 assert.match(source,/const queued=newCandidateByQid\.get\(id\)/);
 assert.match(source,/queued\.categories=\[\.\.\.new Set/);
 assert.match(source,/newCandidateByQid\.set\(id,fresh\)/);
});


test('Beaconsfield has one official museum despite OSM and Wikidata identity sources',()=>{
 const osm={slug:'beaconsfield-mine-and-heritage-centre',name:'Beaconsfield Mine & Heritage Centre',sourceType:'openstreetmap',wikidata:'Q4876028',
 latitude:-41.2017508,longitude:146.814144,website:'https://www.beaconsfieldheritage.com.au/',phone:'0363831473',
 town:'Beaconsfield',categories:['Museums'],image:{isFallback:true}};
 const wikidata={slug:'beaconsfield-mine-and-heritage-centre-2',name:'Beaconsfield Mine and Heritage Centre',sourceType:'wikidata',sourceId:'Q4876028',wikidata:'Q4876028',
 latitude:-41.2017,longitude:146.816,website:'https://www.beaconsfieldheritage.com.au/',phone:'03 6383 1473',
 town:'Beaconsfield',address:'West Street, Beaconsfield, Tasmania 7270',categories:['Museums','Art & Culture']};
 const merged=dedupeReviewedBeaconsfieldCentre([wikidata,osm]);
 assert.equal(merged.removed,1);
 assert.equal(merged.places.length,1);
 assert.equal(merged.places[0].slug,osm.slug);
 assert.equal(merged.places[0].name,'Beaconsfield Mine and Heritage Centre');
 assert.equal(merged.places[0].address,wikidata.address);
 assert.ok(merged.places[0].categories.includes('Art & Culture'));
 assert.deepEqual(merged.aliases,[{from:wikidata.slug,to:osm.slug,qid:'Q4876028'}]);
 assert.equal(dedupeReviewedBeaconsfieldCentre(merged.places).removed,0);
 const redirects=readFileSync(new URL('../../public/_redirects',import.meta.url),'utf8');
 for(const root of ['/place/','/places/'])
  assert.ok(redirects.includes(root+wikidata.slug+'/ /place/'+osm.slug+'/ 301'));
});
test('cross-source museum protection rejects unverified same-name or edited places',()=>{
 const valid={slug:'beaconsfield-mine-and-heritage-centre',name:'Beaconsfield Mine & Heritage Centre',
  sourceType:'openstreetmap',wikidata:'Q4876028',latitude:-41.2017508,longitude:146.814144,
  website:'https://www.beaconsfieldheritage.com.au/',phone:'0363831473'};
 const match={...valid,slug:'beaconsfield-mine-and-heritage-centre-2',
  sourceType:'wikidata',sourceId:'Q4876028',name:'Beaconsfield Mine and Heritage Centre',latitude:-41.2017,longitude:146.816};
 for(const changed of [{...match,website:'https://example.org/'},
    {...match,phone:'03 6333 1111'},{...match,latitude:-42},
    {...match,sourceId:'Q22'},{...match,managedManually:true}]){
  const source=[{...valid},{...changed}];
  const result=dedupeReviewedBeaconsfieldCentre(source);
  assert.equal(result.removed,0,'unsafe unverified source merger refused');
 }
});
