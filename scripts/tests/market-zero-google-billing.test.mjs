import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {googleMarketSearchUrl,googleMarketImageSearchUrl} from '../../src/lib/google-market-photos.mjs';

const page=readFileSync('src/pages/place/[slug].astro','utf8');
const market=readFileSync('src/components/MarketVisitorPhotos.astro','utf8');
const research=readFileSync('scripts/enrich-images.mjs','utf8');

test('market photo UX uses free external links and never needs Google Cloud',()=>{
 assert.match(market,/googleMarketSearchUrl/);
 assert.match(market,/View visitor photos on Google Maps/);
 assert.match(market,/suggest-update/);
 for(const banned of ['PUBLIC_GOOGLE_MAPS_API_KEY','apiKey','gmp-place-details',
   'maps.importLibrary','searchByText']){
  assert.equal(market.includes(banned),false,'Unexpected paid market integration: '+banned);
 }
});
test('all place pages avoid Google Maps API loads even if an old key remains configured',()=>{
 assert.equal(page.includes('PUBLIC_GOOGLE_MAPS_API_KEY'),false);
 assert.equal(page.includes('maps.importLibrary'),false);
 assert.equal(page.includes('<gmp-place-details>'),false);
 assert.match(page,/<MarketVisitorPhotos /);
});
test('ordinary Google Maps market links need no key or billing account',()=>{
 const url=googleMarketSearchUrl('Salamanca Market','Hobart');
 assert.equal(new URL(url).hostname,'www.google.com');
 assert.equal(new URL(url).pathname,'/maps/search/');
 assert.ok(new URL(url).searchParams.get('query').includes('Hobart Tasmania'));
});
test('market discovery only adds images with exact identity and locality',()=>{
 assert.match(research,/isMarketPlace\(place\)/);
 assert.match(research,/fullIdentity/);
 assert.match(research,/tasmanian/);
 assert.match(research,/locality/);
 assert.match(research,/permittedLicence/);
});

test('free Google Images searches do not require a paid developer API',()=>{
 const url=new URL(googleMarketImageSearchUrl('Farm Gate Market','Hobart'));
 assert.equal(url.origin,'https://www.google.com');
 assert.equal(url.pathname,'/search');
 assert.equal(url.searchParams.get('tbm'),'isch');
 assert.ok(url.searchParams.get('q').includes('Farm Gate Market Hobart Tasmania'));
});
