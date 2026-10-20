import test from 'node:test';
import assert from 'node:assert/strict';
import events from '../../src/data/events.json' with {type:'json'};
import overrides from '../../src/data/event-overrides.json' with {type:'json'};
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../../scripts/sanitize-events.mjs',import.meta.url),'utf8');
test('Rosny Farm entries are an opportunity not a fictitious calendar event',()=>{
 const records=events.filter(e=>/poochibald.*art prize call for entries/i.test(e.name||''));
 // Past opportunities may be pruned entirely after 18 Oct. No stale active
 // event must be reintroduced simply to satisfy a fixture assertion.
 assert.ok(records.length<=1);
 if(records.length){
  const e=records[0];
  assert.equal(e.status,'inactive');
  assert.equal(e.visibility,'suppressed');
  assert.equal(e.startDate,'2026-08-12');
  assert.equal(e.endDate,'2026-10-18');
  assert.ok(e.eventUrl.startsWith('https://rosnyfarm.com.au/event/'));
 }
 const override=Object.entries(overrides).find(([slug])=>/poochibald.*call-for-entries/.test(slug));
 assert.ok(override,'canonical source override must remain available');
 assert.equal(override[1].fields.visibility,'suppressed');
 assert.equal(override[1].fields.status,'inactive');
 assert.match(src,/poochibald\.\*art prize call for entries/i);
});
test('fake boilerplate Rosny Farm import event is never left in active source data',()=>{
 assert.equal(events.filter(e=>e.status==='active'&&/for\s*,?\s*visit the event on rosny farm/i.test(e.name||'')).length,0);
 assert.match(src,/for visit the event on rosny farm/);
});
