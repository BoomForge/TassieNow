import test from 'node:test';
import assert from 'node:assert/strict';
import {parksTasHoursAreForListing,shouldRemoveParksContactHours} from '../../src/lib/parks-hours-source-guard.mjs';

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

test('previous contaminated place hours are safely removed only for known targets',()=>{
 const sample={name:'Friendly Beaches',openingHours:'Mo-Su 09:00-16:00',
  detailSources:{openingHours:{type:'official-website',url:'https://parks.tas.gov.au/explore-our-parks/freycinet-national-park'}}};
 assert.equal(shouldRemoveParksContactHours(sample),true);
 assert.equal(shouldRemoveParksContactHours({...sample,name:'Freycinet Visitor Centre'}),false);
 assert.equal(shouldRemoveParksContactHours({...sample,managedManually:true}),false);
 assert.equal(shouldRemoveParksContactHours({...sample,detailSources:{openingHours:{type:'manual'}}}),false);
 assert.equal(shouldRemoveParksContactHours({...sample,name:'Friendly Beaches',openingHours:'24 hours'}),false);
 assert.equal(shouldRemoveParksContactHours({...sample,detailSources:{openingHours:{type:'official-website',url:'https://www.tahuneadventures.com.au'}}}),false);
});
