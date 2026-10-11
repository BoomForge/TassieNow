import test from 'node:test';
import assert from 'node:assert/strict';
import {renderEventPoster,eventDisplayImage,eventDisplayAlt} from '../../src/lib/event-posters.mjs';

test('unsourced event uses unique editorial artwork instead of generic category art',()=>{
 const a={name:'Pickleball School Holiday Sessions',town:'Devonport',
  startDate:'2026-10-13',slug:'pickleball-2026',image:{isFallback:true,url:'/images/categories/events.svg'}};
 const b={...a,name:'Birdwatching in Devonport',slug:'birdwatch-2026'};
 assert.equal(eventDisplayImage(a),'/images/event-posters/pickleball-2026.svg');
 assert.equal(eventDisplayAlt(a),'Original TassieNow illustrated event card for Pickleball School Holiday Sessions');
 assert.notEqual(renderEventPoster(a),renderEventPoster(b));
 assert.match(renderEventPoster(a),/Pickleball School Holiday Sessions/);
 assert.match(renderEventPoster(a),/13 OCT 2026/);
 assert.match(renderEventPoster(a),/Devonport/);
 assert.match(renderEventPoster(a),/not a photograph or organiser poster/i);
});
test('real licensed event photo always supersedes original editorial artwork',()=>{
 const a={slug:'test-event',name:'Event',
  image:{isFallback:false,url:'https://commons.wikimedia.org/photo.jpg',alt:'Actual event photo'}};
 assert.equal(eventDisplayImage(a),a.image.url);
 assert.equal(eventDisplayAlt(a),'Actual event photo');
});
test('event text is XML-escaped, not executable markup',()=>{
 const svg=renderEventPoster({name:'Danger <script>alert(1)</script> & Family',
   town:'Cygnet & Huon',startDate:'2026-11-12',slug:'safe-event'});
 assert.equal(svg.includes('<script>'),false);
 assert.match(svg,/&lt;script&gt;/);
 assert.match(svg,/Cygnet &amp; Huon/);
 assert.match(svg,/<svg /);
 assert.match(svg,/<\/svg>$/);
});
test('very long titles remain bounded by a three-line visual treatment',()=>{
 const svg=renderEventPoster({name:'An exceptionally long workshop title about an incredibly interesting community event that exceeds several hundred characters by design',
   town:'Hobart',slug:'long-name'});
 const lines=(svg.match(/<tspan /g)||[]).length;
 assert.ok(lines<=3);
});
