import test from 'node:test';
import assert from 'node:assert/strict';
import {applyVerifiedHistoricalEvents} from '../discover/lib/verified-event-history.mjs';
import {imageIsPublishable,eventImagePriority} from '../discover/lib/event-media.mjs';
const blank=()=>({url:'/images/categories/events.svg',isFallback:true});
test('2017 Burnie Ten photo is legitimate older edition of Burnie Ten 2026',()=>{
 const event={name:'Burnie Ten',town:'Burnie',startDate:'2026-10-18',status:'active',image:blank()};
 assert.equal(applyVerifiedHistoricalEvents([event]),1);
 assert.equal(imageIsPublishable(event.image),true);
 assert.equal(event.image.historicalYear,2017);
 assert.match(event.image.caption,/not a photograph of the 2026 event/);
 assert.equal(applyVerifiedHistoricalEvents([event]),0);
});
test('Do not use Burnie Ten photo for a different event or town',()=>{
 const other={name:'Burnie City Races',town:'Burnie',startDate:'2026-10-18',status:'active',image:blank()};
 const wrong={name:'Burnie Ten',town:'Hobart',startDate:'2026-10-18',status:'active',image:blank()};
 assert.equal(applyVerifiedHistoricalEvents([other,wrong]),0);
});
