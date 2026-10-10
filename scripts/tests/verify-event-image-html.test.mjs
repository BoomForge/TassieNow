import test from 'node:test';
import assert from 'node:assert/strict';
import {heroImageMatches} from '../discover/lib/verify-event-image-html.mjs';
const photo='https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Weltklasse_Z%C3%BCrich.jpg/1280px-Weltklasse_Z%C3%BCrich.jpg';
const page='https://tassienow.com/event/delta-goodrem/';
test('percent-encoded Unicode source URL is verified as published',()=>{
  const html='<figure><img class="detail-image" src="'+photo+'" alt="Delta"></figure>';
  assert.deepEqual(heroImageMatches(html,photo,page),{figure:true,photograph:true});
});
test('HTML-escaped query params and single quoted tag remain verifiable',()=>{
  const url=photo+'?width=1280&quality=80';
  const html="<img class='detail-image' alt='Delta' src='"+url.replace('&','&amp;')+"'>";
  assert.deepEqual(heroImageMatches(html,url,page),{figure:true,photograph:true});
});
test('credit in HTML is not evidence that the real hero image was published',()=>{
  const html='<img class="detail-image" src="https://example.org/fallback.svg"><span>Peter Arnold</span>';
  assert.deepEqual(heroImageMatches(html,photo,page),{figure:true,photograph:false});
});
test('a missing image element is not counted as published',()=>{
  assert.deepEqual(heroImageMatches('<span>Peter Arnold</span>',photo,page),{figure:false,photograph:false});
});
