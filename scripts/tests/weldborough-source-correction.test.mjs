import test from 'node:test';
import assert from 'node:assert/strict';
import { correctWeldboroughSource } from '../../src/lib/weldborough-source-correction.mjs';

test('Weldborough must not inherit Cradle Mountain phone, email, walk facts or hours',()=>{
 const place={
  slug:'weldborough-pass-rainforest-walk',
  name:'Weldborough Pass Rainforest Walk',
  town:'Weldborough',
  summary:'10 minute circuit, 431m at Cradle Mountain Interpretation Centre',
  phone:'03 6492 1110',email:'Cradle@parks.tas.gov.au',
  website:'https://parks.tas.gov.au/explore-our-parks/cradle-mountain/pencil-pine-falls-and-rainforest-walk',
  officialSource:{url:'https://parks.tas.gov.au/explore-our-parks/cradle-mountain/pencil-pine-falls-and-rainforest-walk'},
  sourceUrl:'https://www.openstreetmap.org/way/123',
  openingHours:'Mo-Su 00:00-12:00',
  schedule:{summary:'Daily at 00:00'},
  detailSources:{phone:{url:'https://parks.tas.gov.au/'},email:{url:'https://parks.tas.gov.au/'},openingHours:{url:'https://parks.tas.gov.au/'}}
 };
 assert.equal(correctWeldboroughSource(place),true);
 for(const key of ['phone','email','website','officialSource','openingHours','schedule'])assert.equal(key in place,false,key);
 assert.equal(place.sourceUrl,'https://www.openstreetmap.org/way/123');
 assert.match(place.summary,/Weldborough Pass State Reserve/);
 assert.doesNotMatch(place.summary,/431m|Cradle Mountain/);
 assert.equal(Object.keys(place.detailSources).length,0);
 assert.equal(correctWeldboroughSource(place),false,'idempotent');
});
test('genuine manual work and unrelated Cradle Mountain Rainforest Walk remain unchanged',()=>{
 const source={slug:'weldborough-pass-rainforest-walk',managedManually:true,phone:'03 6492 1110',openingHours:'Unknown'};
 const other={slug:'cradle-mountain-rainforest-walk',phone:'03 6492 1110',website:'https://parks.tas.gov.au/explore-our-parks/cradle-mountain'};
 const ownerCopy=structuredClone(source),otherCopy=structuredClone(other);
 assert.equal(correctWeldboroughSource(source),false);
 assert.equal(correctWeldboroughSource(other),false);
 assert.deepEqual(source,ownerCopy);
 assert.deepEqual(other,otherCopy);
});
test('legitimate unrelated Weldborough guide is retained, no arbitrary data erasure',()=>{
 const place={slug:'weldborough-pass-rainforest-walk',
  website:'https://wheredownunder.au/destinations/weldborough-pass-rainforest-walk',
  phone:'03 1234 5678',summary:'A short loop among myrtle trees at Weldborough Pass',
  openingHours:'Check local signage'};
 assert.equal(correctWeldboroughSource(place),false);
 assert.equal(place.phone,'03 1234 5678');
 assert.equal(place.openingHours,'Check local signage');
});
