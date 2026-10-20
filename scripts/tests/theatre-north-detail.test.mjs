import test from 'node:test';
import assert from 'node:assert/strict';
import {theatreNorthDetail} from '../discover/lib/theatre-north-detail.mjs';

test('official show H1 and venue beat the flattened listing-card presenter and date',()=>{
 const html='<nav><h1>What\'s On</h1></nav><section>'+
 '<p>The Music Group presents</p><h1 class="show">Björn Again</h1>'+
 '<p>ABBA Forever Tour</p><h4>Event Venue</h4>'+
 '<p>Albert Hall, Launceston</p><h4>Event Dates & Times</h4></section>';
 assert.deepEqual(theatreNorthDetail(html),{name:'Björn Again',venue:'Albert Hall, Launceston'});
});
test('no detail venue or no credible show heading gives no invented metadata',()=>{
 assert.equal(theatreNorthDetail('<h1>GIANT - The Play</h1><p>Details soon</p>'),null);
 assert.equal(theatreNorthDetail('<h1>What\'s On</h1><h4>Event Venue</h4><p>Albert Hall</p>'),null);
 assert.equal(theatreNorthDetail('<h1>Event</h1><h4>Event Venue</h4><p>Albert Hall</p>'),null);
});
test('safe encoded show titles and exact venue labels are decoded',()=>{
 const html='<h1>The Sweet (UK) &amp; Friends</h1><h4>Event Venue</h4><p>Albert Hall, Launceston</p>';
 assert.deepEqual(theatreNorthDetail(html),{name:'The Sweet (UK) & Friends',venue:'Albert Hall, Launceston'});
});
