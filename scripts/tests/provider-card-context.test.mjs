import test from 'node:test';
import assert from 'node:assert/strict';
import {providerCardContext} from '../discover/lib/provider-card-context.mjs';
const links=html=>[...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
test('Humanitix cards never inherit previous event dates',()=>{
 const h='<article>4 Nov 2026 — other show</article>'+
  '<article><a href="https://events.humanitix.com/big-top">Halloweek Big Top</a>31 Oct 2026 9pm — Hobart</article>';
 const c=providerCardContext(h,links(h)[0]);
 assert.match(c,/31 Oct 2026/);
 assert.doesNotMatch(c,/4 Nov 2026/);
});
test('undated ticket cannot borrow date or venue from following card',()=>{
 const h='<article><a href="https://events.humanitix.com/unknown">Unknown event</a></article>'+
  '<article><a href="https://events.humanitix.com/next">Next event</a>29 Nov 2026 Twisted Lime</article>';
 const a=links(h),c=providerCardContext(h,a[0]);
 assert.doesNotMatch(c,/29 Nov 2026/);
 assert.doesNotMatch(c,/Twisted Lime/);
 assert.match(providerCardContext(h,a[1]),/29 Nov 2026/);
});
test('provider card extraction stops at next hyperlink even inside same section',()=>{
 const h='<section><a href="https://events.humanitix.com/first">First</a>1 Nov 2026 '+
  '<a href="https://events.humanitix.com/second">Second</a>2 Nov 2026</section>';
 const a=links(h);
 assert.match(providerCardContext(h,a[0]),/1 Nov 2026/);
 assert.doesNotMatch(providerCardContext(h,a[0]),/2 Nov 2026/);
});
