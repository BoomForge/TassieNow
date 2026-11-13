import test from 'node:test';
import assert from 'node:assert/strict';
import {oneTokenTitleIdentityMatches,quarantineTheKitchenSourceCollision} from '../../src/lib/place-source-identity.mjs';

test('a single shared word does not join an unrelated Parks walking track to The Kitchen',()=>{
 assert.equal(oneTokenTitleIdentityMatches('The Kitchen','Tasmans Arch and Devils Kitchen Circuit | Parks Tasmania'),false);
 assert.equal(oneTokenTitleIdentityMatches('The Kitchen','The Kitchen | A local café in Tasmania'),true);
 assert.equal(oneTokenTitleIdentityMatches('Little Riva','Little Riva - Turners Beach'),true);
});

test('the specifically identified OSM café is quarantined only when cross-entity enrichment is present',()=>{
 const place={slug:'the-kitchen',name:'The Kitchen',town:'Zeehan',sourceId:'node/2532004100',
  sourceUrl:'https://www.openstreetmap.org/node/2532004100',
  officialSource:{url:'https://parks.tas.gov.au/explore-our-parks/tasman-national-park/tasmans-arch-and-devils-kitchen-circuit'},
  summary:'Tasmans Arch and Devils Kitchen Circuit, Grade 1.',visibility:'public'};
 assert.equal(quarantineTheKitchenSourceCollision(place),true);
 assert.equal(place.visibility,'suppressed');
 assert.match(place.qualityHold,/Unverified cross-entity/);
 const other={...place,slug:'unrelated-kitchen',visibility:'public'};
 assert.equal(quarantineTheKitchenSourceCollision(other),false);
 assert.equal(other.visibility,'public');
});

test('do not suppress a manually managed listing or a correctly sourced café',()=>{
 const verified={slug:'the-kitchen',town:'Zeehan',sourceId:'node/2532004100',
 sourceUrl:'https://www.openstreetmap.org/node/2532004100',
 summary:'Local café with coffee and food',officialSource:{url:'https://example.com/cafe'},visibility:'public'};
 assert.equal(quarantineTheKitchenSourceCollision(verified),false);
 assert.equal(verified.visibility,'public');
 verified.summary='Tasmans Arch and Devils Kitchen Circuit';
 verified.managedManually=true;
 assert.equal(quarantineTheKitchenSourceCollision(verified),false);
});
