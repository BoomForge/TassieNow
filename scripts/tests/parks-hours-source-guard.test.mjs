import test from 'node:test';
import assert from 'node:assert/strict';
import {parksTasHoursAreForListing} from '../../src/lib/parks-hours-source-guard.mjs';

test('Parks Tasmania contact hours cannot become natural attraction opening hours',()=>{
 const url='https://parks.tas.gov.au/explore-our-parks/southwest-national-park';
 for(const name of ['Southwest National Park','Arve Falls Lookout','Freycinet National Park','Wineglass Bay Lookout','Friendly Beaches','Tahune Airwalk Cafe']){
  assert.equal(parksTasHoursAreForListing(name,url),false,name);
 }
});
test('real staffed visitor centres and offices may carry Parks Tasmania opening hours',()=>{
 const url='https://parks.tas.gov.au/explore-our-parks/freycinet-national-park';
 assert.equal(parksTasHoursAreForListing('Freycinet Visitor Centre',url),true);
 assert.equal(parksTasHoursAreForListing('Huonville Office',url),true);
 assert.equal(parksTasHoursAreForListing('Freycinet National Park',url),false);
});
test('other independent operators retain their own legitimate hours',()=>{
 assert.equal(parksTasHoursAreForListing('Tahune Airwalk Cafe','https://www.tahuneadventures.com.au/'),true);
 assert.equal(parksTasHoursAreForListing('A local gallery','https://example.com/hours'),true);
});
