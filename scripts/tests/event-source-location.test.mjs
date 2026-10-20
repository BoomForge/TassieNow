import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceEventLocation} from '../../src/lib/event-source-location.mjs';

test('official Burnie event place and full street address survive structured ingestion',()=>{
 const item={name:'Not Just Books',address:{'@type':'PostalAddress',streetAddress:'40 Wilson Street',addressLocality:'Burnie',postalCode:'7320'}};
 assert.deepEqual(sourceEventLocation(item),{venue:'Not Just Books',address:'40 Wilson Street, Burnie 7320',locality:'Burnie'});
});
test('placeholder venue and street-address-as-venue are never passed off as Place name',()=>{
 assert.equal(sourceEventLocation({name:'Venue',address:{streetAddress:'1 Main Road'}}).venue,null);
 assert.equal(sourceEventLocation({name:'78 Burgess Street',address:{addressLocality:'Bicheno'}}).venue,null);
 assert.equal(sourceEventLocation({name:'TBA'}).venue,null);
 assert.equal(sourceEventLocation({name:'Rosny Library',address:{streetAddress:'Bligh Street',addressLocality:'Rosny Park'}}).venue,'Rosny Library');
});
test('empty source location does not invent a venue or street',()=>{
 assert.deepEqual(sourceEventLocation(null),{venue:null,address:null,locality:null});
 assert.deepEqual(sourceEventLocation({address:{addressLocality:'Hobart'}}),{venue:null,address:null,locality:'Hobart'});
});
test('HTML entity encodings and raw street strings remain plain safe text',()=>{
 assert.deepEqual(sourceEventLocation({name:'Cafe &amp; Gallery',address:'25 Collins Street, Hobart'}),{venue:'Cafe & Gallery',address:'25 Collins Street, Hobart',locality:null});
});
