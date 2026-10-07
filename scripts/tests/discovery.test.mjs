import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonical, discover, extractCandidates, matchPlace, parseSchedule, publicationProblems } from '../discover/lib/official-discovery.mjs';
import { robotsAllows } from '../discover/official-markets.mjs';
import { readCatalogue } from '../../functions/_lib/github.js';
import { onRequestGet } from '../../functions/api/admin/discovery.js';

const source = { id:'council', name:'Council', url:'https://council.tas.gov.au/markets', trust:'government', headings:true, region:'Launceston & North' };
const market = { '@type':'Place', name:'Small Village Market', address:{streetAddress:'12 Hall Road',addressLocality:'Liffey',addressRegion:'Tasmania',addressCountry:'AU'}, geo:{latitude:-41.65,longitude:146.88}, url:'https://council.tas.gov.au/small-market', description:'Every Sunday, local produce and handmade goods.' };
const html = item => `<main><script type="application/ld+json">${JSON.stringify(item)}</script></main>`;
test('discovers graph/list items and publishes a verified recurring market exactly once', async () => {
  const result = await discover({ sources:[source], places:[], fetchPage:async()=>html({'@graph':[{'@type':'ItemList', itemListElement:[{item:market}]}]}), now:new Date('2026-10-07') });
  assert.equal(result.places.length,1); assert.equal(result.places[0].town,'Liffey'); assert.equal(result.places[0].sourceType,'official-discovery');
  assert.equal(result.places[0].schedule.frequency,'weekly');
  const second = await discover({sources:[source],places:result.places,previous:result.candidates,fetchPage:async()=>html(market)});
  assert.equal(second.places.length,1); assert.equal(second.report.added.length,0);
});
test('unverified and one-off markets enter review rather than acquiring fabricated locations or dates', async () => {
  const oneOff = {...market, '@type':'Event',description:'Local makers',startDate:'2026-12-01'};
  const result = await discover({sources:[source],places:[],fetchPage:async()=>html(oneOff)});
  assert.equal(result.places.length,0); assert.ok(result.candidates[0].reasons.some(r=>r.includes('schedule')));
  const candidate = extractCandidates(html({...market,geo:undefined}),source)[0];
  assert.ok(publicationProblems(candidate,source).some(r=>r.includes('coordinates')));
  assert.ok(publicationProblems({...candidate,latitude:-37,longitude:145},source).some(r=>r.includes('coordinates')));
});
test('monthly ordinal schedules remain monthly; seasonal exceptions require review', () => {
  assert.deepEqual(parseSchedule('First and third Sunday of every month','https://example.com').weeksOfMonth,[1,3]);
  assert.equal(parseSchedule('2nd Saturday of each month','https://example.com').frequency,'monthly');
  assert.equal(parseSchedule('2nd Saturday of each month (September to April, excluding January)','https://example.com'),null);
});
test('directory extraction keeps the address and schedule inside its own heading section', () => {
  const page = '<main><h3>Liffey Valley Markets</h3><p>2nd Saturday of each month. September to April, excluding January.</p><p><strong>LOCATION:</strong> Liffey Hall, 1443 Liffey Rd, Liffey<br></p><h3>Ross Village Markets</h3><p>Third Sunday of each month.</p><p><strong>LOCATION:</strong> Ross Town Hall, Church Street, Ross<br></p></main>';
  const found = extractCandidates(page,source);
  assert.equal(found[0].town,'Liffey'); assert.equal(found[0].schedule,null);
  assert.equal(found[1].town,'Ross'); assert.deepEqual(found[1].schedule.weeksOfMonth,[3]);
  assert.equal(found[0].url,source.url);
  assert.equal(canonical(undefined,source.url),null);
});
test('a failed source preserves catalogue and previous review evidence without claiming a new check', async () => {
  const places = [{name:'Existing Market',slug:'existing',town:'Ross'}], previous=[{id:'old',name:'Old Market',lastSeen:'2026-09-01',status:'review'}];
  const result = await discover({sources:[source],places:structuredClone(places),previous,fetchPage:async()=>{throw new Error('HTTP 403');}});
  assert.deepEqual(result.places,places); assert.equal(result.candidates[0].lastSeen,'2026-09-01'); assert.equal(result.report.totals.failedSources,1);
});
test('refreshes source-owned schedules while preserving curated and manual records', async () => {
  const initial = await discover({sources:[source],places:[],fetchPage:async()=>html(market)});
  const monthly = {...market,description:'Third Sunday of each month.'};
  const refreshed = await discover({sources:[source],places:initial.places,fetchPage:async()=>html(monthly)});
  assert.equal(refreshed.places[0].schedule.frequency,'monthly');
  const manual = {...refreshed.places[0],managedManually:true,summary:'Owner description'};
  const saved = structuredClone(manual);
  const result = await discover({sources:[source],places:[manual],fetchPage:async()=>html(market)});
  assert.deepEqual(result.places[0],saved);
});
test('discovery dashboard endpoint requires the existing owner session', async () => {
  const response = await onRequestGet({request:new Request('https://tassienow.com/api/admin/discovery'),env:{}});
  assert.equal(response.status,401);
});
test('shared directory URLs do not conflate different markets; aliases and towns deduplicate safely', () => {
  const p={name:'Ross Village Market',town:'Ross',website:source.url};
  assert.equal(matchPlace({name:'Ross Village Markets',town:'Ross',url:source.url},[p]),p);
  assert.equal(matchPlace({name:'Liffey Valley Market',town:'Liffey',url:source.url},[p]),undefined);
  assert.equal(matchPlace({name:p.name,town:'Hobart',url:p.website},[p]),undefined);
});
test('outgoing links stay in the approved host and footer noise does not publish', async () => {
  const result = await discover({sources:[source],places:[],fetchPage:async url => {assert.equal(new URL(url).hostname,'council.tas.gov.au');return '<main><a href="https://facebook.com/smallmarket">Small Market</a></main><footer><a href="/market">Footer Market</a></footer>';}});
  assert.equal(result.places.length,0); assert.equal(result.candidates.length,1);
});
test('robots respects specific agents, wildcard paths, allow and disallow', () => {
  assert.equal(robotsAllows('User-agent: *\nDisallow: /private\nAllow: /private/public','https://example.com/private/public'),true);
  assert.equal(robotsAllows('User-agent: *\nDisallow: /private','https://example.com/private/market'),false);
  assert.equal(robotsAllows('User-agent: *\nDisallow: /\nUser-agent: TassieNow\nAllow: /markets','https://example.com/markets'),true);
});
test('owner review can load a catalogue above the GitHub Contents API inline size limit', async () => {
  const original = globalThis.fetch, urls = [];
  globalThis.fetch = async url => { urls.push(url); return Response.json(url.includes('/git/blobs/')
    ? { content: btoa('[{"name":"Existing Market"}]'), encoding:'base64' }
    : { sha:'large-catalogue-sha', content:'', encoding:'none' }); };
  try {
    const result = await readCatalogue({env:{GITHUB_TOKEN:'test-only'}});
    assert.equal(result.places[0].name,'Existing Market'); assert.equal(result.sha,'large-catalogue-sha');
    assert.ok(urls[1].endsWith('/git/blobs/large-catalogue-sha'));
  } finally { globalThis.fetch = original; }
});
