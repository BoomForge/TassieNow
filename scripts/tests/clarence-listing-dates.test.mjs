import test from 'node:test';
import assert from 'node:assert/strict';
import {clarenceListingCardText} from '../discover/lib/clarence-listing-dates.mjs';
const anchors=html=>[...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];

test('Clarence listing dates never come from the preceding event card',()=>{
 const html='<article>Rotary Club - 4 Nov 2026</article>'+
  '<article><a href="/event/beyond-sound/">Beyond Sound</a>3 December 2026, 1:00 pm</article>';
 const links=anchors(html),ctx=clarenceListingCardText(html,links[0],links);
 assert.match(ctx,/3 December 2026/);
 assert.doesNotMatch(ctx,/4 Nov 2026/);
});
test('a missing card date must not borrow the next event date',()=>{
 const html='<article><a href="/event/undated/">An undated programme</a></article>'+
  '<article><a href="/event/next/">Next event</a>4 November 2026</article>';
 const links=anchors(html);
 const one=clarenceListingCardText(html,links[0],links);
 assert.doesNotMatch(one,/4 November 2026/);
 assert.match(clarenceListingCardText(html,links[1],links),/4 November 2026/);
});
test('single-card text is capped and never absorbs trailing page content',()=>{
 const html='<article><a href="/event/one/">One event</a>20 October 2026</article>'+
  'x'.repeat(600)+'4 November 2026';
 const links=anchors(html),text=clarenceListingCardText(html,links[0],links);
 assert.match(text,/20 October 2026/);
 assert.doesNotMatch(text,/4 November 2026/);
});

test('Glenorchy /event/ links keep their own council listing-card date',()=>{
 const markup='<article><a href="/event/world-kindness-day-2026/">World Kindness Day</a>13 Nov 2026</article>'+
  '<article><a href="/event/family-fun-day-childrens-week-2026/">Family Fun Day – Children’s Week 2026</a>28 Oct 2026</article>';
 const list=anchors(markup);
 assert.equal(list.length,2);
 const first=clarenceListingCardText(markup,list[0],list);
 const second=clarenceListingCardText(markup,list[1],list);
 assert.match(first,/World Kindness Day/);
 assert.match(first,/13 Nov 2026/);
 assert.doesNotMatch(first,/28 Oct 2026/);
 assert.match(second,/28 Oct 2026/);
 assert.doesNotMatch(second,/13 Nov 2026/);
});
test('Glenorchy importer explicitly targets singular /event/ detail paths',async()=>{
 const {readFile}=await import('node:fs/promises');
 const src=await readFile(new URL('../discover/events.mjs',import.meta.url),'utf8');
 assert.match(src,/name:'Glenorchy City Council'[^\\n]+detail:\/\\\\\/event\\\\\/\/i,textMode:'never'/);
});
