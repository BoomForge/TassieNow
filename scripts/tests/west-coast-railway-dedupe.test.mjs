import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {dedupeWestCoastRailwayPlaces} from '../../src/lib/west-coast-railway-dedupe.mjs';

const parent={slug:'west-coast-wilderness-railway',name:'West Coast Wilderness Railway',
 town:'Queenstown',website:'https://wcwr.com.au/',phone:'+61 3 6471 0100',
 sourceType:'wikidata',categories:['Things to Do']};
const extra={slug:'west-coast-wilderness-railway-strahan',name:'West Coast Wilderness Railway',
 town:'Strahan',sourceType:'openstreetmap',summary:'Visitor attraction near Strahan'};
test('one documented railway operator retains its complete listing',()=>{
 const original=[{slug:'unrelated'},extra,parent];
 const result=dedupeWestCoastRailwayPlaces(original);
 assert.equal(result.removed,1);
 assert.equal(result.places.length,2);
 assert.ok(result.places.includes(parent));
 assert.ok(!result.places.includes(extra));
 assert.equal(original.length,3,'pure no-input mutation');
});
test('never remove a manually curated station or independently rich listing',()=>{
 for(const props of [{managedManually:true},{website:'https://wcwr.com.au/'},{phone:'03 1234 1234'},
  {sourceType:'operator'},{bookingUrl:'https://wcwr.com.au/tickets'}]){
  const a={...extra,...props};
  assert.equal(dedupeWestCoastRailwayPlaces([parent,a]).removed,0,JSON.stringify(props));
 }
});
test('do not collapse lookalike railway operators without canonical ownership proof',()=>{
 const a={...parent,website:'https://other-operator.example/'};
 assert.equal(dedupeWestCoastRailwayPlaces([a,extra]).removed,0);
 assert.equal(dedupeWestCoastRailwayPlaces([extra]).removed,0);
 assert.equal(dedupeWestCoastRailwayPlaces([{...parent,name:'Different Railway'},extra]).removed,0);
});
test('public old Strahan permalink is redirected to the original canonical listing',()=>{
 const rules=fs.readFileSync(new URL('../../public/_redirects',import.meta.url),'utf8');
 assert.match(rules,/\/place\/west-coast-wilderness-railway-strahan \/place\/west-coast-wilderness-railway\/ 301/);
 assert.match(rules,/\/place\/west-coast-wilderness-railway-strahan\/ \/place\/west-coast-wilderness-railway\/ 301/);
});
