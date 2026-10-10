import test from 'node:test';
import assert from 'node:assert/strict';
import {featuredTicketLinks,parseTicketEvent} from '../discover/independent-ticketebo.mjs';

test('candidate discovery selects only event-shaped Ticketebo links and deduplicates',()=>{
 const html='<a href="/tasmanian-brick-enthusiasts/brixhibition-hobart-2026">View this event</a>'
  +'<a href="/tasmanian-brick-enthusiasts/brixhibition-hobart-2026">View this event</a>'
  +'<a href="https://evil.example/sneaky/bad">Untrusted</a>'
  +'<a href="/contact">Contact</a>';
 assert.deepEqual(featuredTicketLinks(html),['https://www.ticketebo.com.au/tasmanian-brick-enthusiasts/brixhibition-hobart-2026']);
});
const eventHtml=(name,location,date)=>'<html><h1>'+name+'</h1><section>WHERE <h2>'+location+'</h2></section><section>WHEN <h2>'+date+'</h2></section><h2>Choose Items</h2></html>';
const url='https://www.ticketebo.com.au/tasmanian-brick-enthusiasts/brixhibition-hobart-2026';
test('Sorell exhibition uses WHERE venue, not Hobart wording in the title',()=>{
 const event=parseTicketEvent(eventHtml('Brixhibition Hobart 2026','South East Basketball Stadium, 13 Montagu Street, Sorell, TAS 7172','Saturday 10 October 2026 until Sunday 11 October 2026'),url,'2026-10-10');
 assert.equal(event?.town,'Sorell');
 assert.equal(event?.region,'Hobart & South');
 assert.equal(event?.startDate,'2026-10-10');
 assert.equal(event?.endDate,'2026-10-11');
 assert.equal(event?.eventUrl,url);
});
test('reject mainland location and events without explicit dates',()=>{
 assert.equal(parseTicketEvent(eventHtml('Brixhibition Hobart 2026','Sydney NSW 2000','Saturday 10 October 2026'),url,'2026-10-10'),null);
 assert.equal(parseTicketEvent(eventHtml('Brixhibition Hobart 2026','Sorell TAS 7172','Dates to be confirmed'),url,'2026-10-10'),null);
 assert.equal(parseTicketEvent(eventHtml('Brixhibition Hobart 2026','Sorell TAS 7172','Saturday 10 October 2026'),url,'2026-10-12'),null);
});
