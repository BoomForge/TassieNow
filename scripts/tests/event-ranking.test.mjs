import test from 'node:test';
import assert from 'node:assert/strict';
import {rankEventDiscovery} from '../../src/lib/event-ranking.js';

const cases=[
 {name:'Year-long community group',startDate:'2026-01-01',endDate:'2026-12-31'},
 {name:'Brixhibition Hobart 2026',startDate:'2026-10-10',endDate:'2026-10-11',town:'Sorell'},
 {name:'Saturday community market',occurrenceDate:'2026-10-10'},
 {name:'Sunday display',startDate:'2026-10-11',endDate:'2026-10-11'},
 {name:'Older exhibition',startDate:'2026-09-01',endDate:'2026-10-12'}
];
test('today puts time-specific Sorell events and markets before year-long items',()=>{
 const ranked=rankEventDiscovery(cases.filter(x=>x.startDate!=='2026-10-11'),'2026-10-10','2026-10-10');
 assert.equal(ranked[0].name,'Brixhibition Hobart 2026');
 assert.equal(ranked[1].name,'Saturday community market');
 assert.equal(ranked.at(-1).name,'Year-long community group');
});
test('weekend maintains chronological order for fresh events and markets',()=>{
 const ranked=rankEventDiscovery(cases,'2026-10-10','2026-10-11');
 assert.deepEqual(ranked.slice(0,3).map(x=>x.name),['Brixhibition Hobart 2026','Saturday community market','Sunday display']);
 assert.equal(ranked.at(-1).name,'Year-long community group');
});
test('ranking does not mutate its input or remove entries',()=>{
 const before=cases.map(x=>x.name);const ranked=rankEventDiscovery(cases,'2026-10-10','2026-10-11');
 assert.deepEqual(cases.map(x=>x.name),before);
 assert.equal(ranked.length,cases.length);
});
