import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectOriginalPage,originalSourceCandidates,selectPhotoLinkTargets,
  mergePhotoLinkResearch} from '../discover/lib/automatic-photo-sources.mjs';

const place=(slug,category='Markets')=>({
  slug,name:'Ross Village Market',town:'Ross',status:'active',visibility:'public',
  categories:[category],image:{isFallback:true},
  website:'https://visitross.example/events/ross-village-market/'
});
const event=(slug)=>({
  slug,name:'Second Glance Market',town:'Burnie',status:'active',
  image:{isFallback:true},eventUrl:'https://burnie.example/events/second-glance-market'
});
const relevant='<html><head><title>Ross Village Market | Visit Ross</title>'+
  '<meta property="og:image" content="https://cdn.example/photos/ross-stalls.jpg">'+
  '<meta property="og:image:width" content="1200">'+
  '<meta property="og:image:height" content="800"></head>'+
  '<body><h1>Ross Village Market</h1></body></html>';
const inspectedAt='2026-10-11T08:00:00Z';

test('automatically links original photo pages without copying or claiming image rights',()=>{
 const link=inspectOriginalPage(place('ross'),place('ross').website,relevant,inspectedAt);
 assert.equal(link.sourceUrl,'https://visitross.example/events/ross-village-market/');
 assert.equal(link.kind,'external-source-link');
 assert.equal(link.discoveryMethod,'original-page-open-graph');
 assert.equal(link.evidence.imageFoundOnPage,true);
 assert.equal(link.checkedAt,inspectedAt);
 assert.ok(!Object.hasOwn(link,'image'));
 assert.ok(!Object.hasOwn(link,'license'));
 assert.ok(!Object.hasOwn(link,'url'));
});
test('refuses generic site pages, logo thumbnails, wrong identity and small artwork',()=>{
 const base=place('ross');
 assert.equal(inspectOriginalPage(base,base.website,relevant.replaceAll('Ross Village Market','Another Market'),inspectedAt),null);
 assert.equal(inspectOriginalPage(base,base.website,relevant.replace('ross-stalls.jpg','site-logo.jpg'),inspectedAt),null);
 assert.equal(inspectOriginalPage(base,base.website,relevant.replace('content="1200"','content="120"'),inspectedAt),null);
 assert.equal(inspectOriginalPage(base,base.website,relevant.replace('ross-stalls.jpg','poster.svg'),inspectedAt),null);
});
test('finds subject-labelled images without open graph but not unlabelled stock art',()=>{
 const source=place('ross').website;
 const document='<html><title>Ross Village Market</title><img src="https://cdn.example/photos/ross-stalls.webp" alt="Ross Village Market stalls" width="960" height="600"></html>';
 assert.equal(inspectOriginalPage(place('ross'),source,document,inspectedAt).discoveryMethod,'original-page-labelled-image');
 assert.equal(inspectOriginalPage(place('ross'),source,document.replace('Ross Village Market stalls','Generic markets'),inspectedAt),null);
});
test('does not mistake Google or OSM search pages for primary photo sources',()=>{
 const p={...place('ross'),website:'https://www.google.com/search?q=ross',
    officialSource:{url:'https://www.openstreetmap.org/node/123'},sourceUrl:'https://www.facebook.com/posts/1'};
 assert.deepEqual(originalSourceCandidates(p),[]);
});
test('selects markets, food and events in balanced batches; leaves unavailable sources out',()=>{
 const markets=Array.from({length:16},(_,i)=>place('market-'+i));
 const food=Array.from({length:40},(_,i)=>({...place('food-'+i,'Food & Drink'),name:'Cafe '+i}));
 const other=Array.from({length:30},(_,i)=>({...place('other-'+i,'Nature & Walks'),name:'Beach '+i}));
 const events=Array.from({length:22},(_,i)=>({...event('event-'+i),name:'Book Fair '+i}));
 const list=selectPhotoLinkTargets([...markets,...food,...other],events,{scans:{}},40,inspectedAt);
 assert.equal(list.length,40);
 assert.equal(list.filter(x=>x.type==='place'&&x.record.categories.includes('Markets')).length,10);
 assert.equal(list.filter(x=>x.type==='place'&&x.record.categories.includes('Food & Drink')).length,16);
 assert.equal(list.filter(x=>x.type==='event').length,6);
 assert.equal(list.filter(x=>x.type==='place'&&x.record.categories.includes('Nature & Walks')).length,8);
 const scanned={scans:{'place:market-0':{checkedAt:inspectedAt,status:'no-photo-source'}}};
 const after=selectPhotoLinkTargets(markets,events,scanned,40,'2026-10-12T08:00:00Z');
 assert.ok(!after.some(x=>x.record.slug==='market-0'));
});
test('does not turn manually curated photo links into discovery tasks',()=>{
 const p={...place('with-link'),photoLinks:[{sourceUrl:'https://example.org/original'}]};
 assert.equal(selectPhotoLinkTargets([p],[],{scans:{}},20,inspectedAt).length,0);
});
test('rebase preserves concurrent links and review recency',()=>{
 const prior={version:1,places:{a:{sourceUrl:'https://a.example',checkedAt:'2026-10-10'}},
    events:{},scans:{'place:a':{status:'linked',checkedAt:'2026-10-10'}}};
 const current={version:1,generatedAt:inspectedAt,
    places:{a:{sourceUrl:'https://old.example',checkedAt:'2026-10-09'},b:{sourceUrl:'https://b.example',checkedAt:inspectedAt}},
    events:{},scans:{'place:a':{status:'unmatched',checkedAt:'2026-10-09'},'place:b':{status:'linked',checkedAt:inspectedAt}}};
 const merged=mergePhotoLinkResearch(prior,current);
 assert.equal(merged.places.a.sourceUrl,'https://a.example');
 assert.equal(merged.places.b.sourceUrl,'https://b.example');
 assert.equal(merged.scans['place:a'].status,'linked');
});
test('public pages use only source-page hrefs; no auto-source image embedding',()=>{
 const placeText=readFileSync('src/pages/place/[slug].astro','utf8');
 const eventText=readFileSync('src/pages/event/[slug].astro','utf8');
 const flow=readFileSync('.github/workflows/auto-photo-sources.yml','utf8');
 const runner=readFileSync('scripts/auto-link-photo-sources.mjs','utf8');
 assert.match(placeText,/import autoPhotoSources/);
 assert.match(placeText,/href=\{link.sourceUrl\}/);
 assert.match(eventText,/originalPhotoSource\.sourceUrl/);
 assert.doesNotMatch(placeText,/<img[^>]+autoPhotoSources/);
 assert.doesNotMatch(eventText,/<img[^>]+originalPhotoSource/);
 assert.match(flow,/schedule:/);
 assert.match(flow,/47 21,9 \* \* \*/);
 assert.match(runner,/heroPhotosAdded:0/);
});
