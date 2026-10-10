import test from 'node:test';
import assert from 'node:assert/strict';
import {SOURCES,verifiedRegionalEvent} from '../discover/verified-regional-events.mjs';
import {selectOsmCandidates} from '../discover/lib/osm-selection.mjs';

test('regional festival only publishes with BOTH official identity and current dates',()=>{
 const source=SOURCES.find(s=>s.region==='Central Tasmania');
 const valid='HIGHLANDS BUSHFEST 2026 will be held on Saturday 21 and Sunday 22 November 2026 in Bothwell, Tasmania.';
 const event=verifiedRegionalEvent(source,valid,'2026-10-09');
 assert.equal(event?.region,'Central Tasmania');
 assert.equal(event?.startDate,'2026-11-21');
 assert.equal(verifiedRegionalEvent(source,'HIGHLANDS BUSHFEST 2026 dates unconfirmed','2026-10-09'),null);
 assert.equal(verifiedRegionalEvent(source,valid,'2026-11-23'),null);
});
test('West Coast event dates cannot be inferred from unrelated titles',()=>{
 const source=SOURCES.find(s=>s.event.includes('Mineral'));
 assert.equal(verifiedRegionalEvent(source,'Join Heritage and Mineral Fair 2026 sometime next year','2026-10-09'),null);
 const event=verifiedRegionalEvent(source,'Heritage and Mineral Fair on 7th and 8th of November 2026 in Zeehan.','2026-10-09');
 assert.equal(event?.region,'West Coast');
});
test('independent food van capacity survives 1:1,000 café competition',()=>{
 const p=(name,id,categories,region='Hobart & South')=>({name,slug:name.replaceAll(' ','-').toLowerCase(),sourceType:'openstreetmap',sourceId:'node/'+id,region,town:'Hobart',categories,latitude:-42.8+id*.001,longitude:147.1,_score:10});
 const cafes=Array.from({length:150},(_,i)=>p('Cafe '+i,i,['Food & Drink','Café']));
 const vendors=Array.from({length:4},(_,i)=>p('Van '+i,300+i,['Food & Drink','Food Van','Mobile Vendor'],'West Coast'));
 const stats=selectOsmCandidates([...cafes,...vendors],[],new Map(),{retainVerifiedMedia:()=>{},verifiedMedia:()=>false},{coreLimit:10,foodLimit:10,vendorLimit:4}).stats;
 assert.equal(stats.selectedFood,14);
 assert.equal(stats.selectedVendors,4);
});

test('Brixhibition Sorell 10–11 October is kept despite Hobart branding',()=>{
  const source=SOURCES.find(item=>item.event==='Brixhibition Hobart 2026');
  assert.ok(source);
  assert.equal(source.town,'Sorell');
  assert.equal(source.region,'Hobart & South');
  const organiserHtml='<h1>Brixhibition Hobart 2026</h1><p>South East Basketball Stadium, 13 Montagu Street, Sorell, Tasmania</p><p>Saturday 10th &amp; Sunday 11th October 2026</p>';
  const event=verifiedRegionalEvent(source,organiserHtml,'2026-10-10');
  assert.equal(event?.startDate,'2026-10-10');
  assert.equal(event?.endDate,'2026-10-11');
  assert.equal(event?.eventUrl,'https://www.brixhibition.com/brixhibitiontickets.html');
  assert.equal(verifiedRegionalEvent(source,organiserHtml.replace('2026','2025'),'2026-10-10'),null);
  assert.equal(verifiedRegionalEvent(source,organiserHtml,'2026-10-12'),null);
});
