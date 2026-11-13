import test from 'node:test';
import assert from 'node:assert/strict';
import {absoluteEventUrl,repairImportedEventLinks} from '../../src/lib/event-url-policy.mjs';

test('JSON-LD object, array and javascript URLs are not valid event links',()=>{
 for(const value of [{url:'https://example.org/event'},['https://example.org/event'],'javascript:alert(1)','/relative','not a url',null]){
  assert.equal(absoluteEventUrl(value),null,String(value));
 }
 assert.equal(absoluteEventUrl('https://www.amtf.org.au/'),'https://www.amtf.org.au/');
});

test('a source-backed festival record uses the verified organiser, not a malformed JSON-LD URL',()=>{
 const input={
  name:'Australian Musical Theatre Festival',startDate:'2027-05-19',endDate:'2027-05-23',
  eventUrl:{'@id':'https://somewhere.invalid/event'},sourceUrl:'https://www.discovertasmania.com.au/whats-on/'
 };
 const corrected=repairImportedEventLinks(input);
 assert.equal(corrected.valid,true);
 assert.equal(corrected.event.eventUrl,'https://www.amtf.org.au/');
 assert.deepEqual(input.eventUrl,{'@id':'https://somewhere.invalid/event'});
});

test('a festival discovery index falls back to its verified organiser link',()=>{
 const sourceUrl='https://www.discovertasmania.com.au/whats-on/';
 const checked=repairImportedEventLinks({name:'Australian Musical Theatre Festival',startDate:'2027-05-19',endDate:'2027-05-23',eventUrl:sourceUrl,sourceUrl});
 assert.equal(checked.event.eventUrl,'https://www.amtf.org.au/');
});

test('other invalid event URLs fall back only to the original trusted source, with no invented booking link',()=>{
 const event={name:'Regional fair',eventUrl:['https://malformed.example.org'],sourceUrl:'https://example.org/events/',ticketUrl:{bad:'jsonld'},ticketProvider:'Eventbrite',priceFrom:99};
 const checked=repairImportedEventLinks(event);
 assert.equal(checked.valid,true);
 assert.equal(checked.event.eventUrl,'https://example.org/events/');
 assert.equal(checked.event.ticketUrl,undefined);
 assert.equal(checked.event.ticketProvider,undefined);
 assert.equal(checked.event.priceFrom,undefined);
});

test('invalid event URLs with no trustworthy source are rejected',()=>{
 const checked=repairImportedEventLinks({name:'Unknown',eventUrl:{url:'bad'},sourceUrl:'not a source'});
 assert.equal(checked.valid,false);
});
