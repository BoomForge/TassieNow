import test from 'node:test';
import assert from 'node:assert/strict';
import {photoRecoveryProgress} from '../report-photo-recovery-goal.mjs';
const baseline={generatedAt:'2026-10-11',
 places:{public:2152,media:{realHeroCoverage:{count:286}}},
 events:{active:169,media:{licensedHeroCoverage:{count:87}}}};
test('starts at zero recovered from 11 October baseline',()=>{
 const result=photoRecoveryProgress(baseline);
 assert.equal(result.baselineMissing,1948);
 assert.equal(result.targetNewHeroPhotos,975);
 assert.equal(result.netAdditionalHeroPhotos,0);
 assert.equal(result.currentMissingPlaceAndEventHeroes,1948);
 assert.equal(result.goalReached,false);
});
test('fails 50-percent target at 974 real image upgrades',()=>{
 const data=structuredClone(baseline);
 data.places.media.realHeroCoverage.count+=974;
 assert.equal(photoRecoveryProgress(data).goalReached,false);
});
test('requires 975 actual approved listing photo heroes; candidate research does not count',()=>{
 const data=structuredClone(baseline);
 data.places.public+=975;
 data.places.media.realHeroCoverage.count+=975;
 data.researchCandidates=5000;
 const result=photoRecoveryProgress(data);
 assert.equal(result.netAdditionalHeroPhotos,975);
 assert.equal(result.goalReached,true);
 assert.equal(result.currentMissingPlaceAndEventHeroes,1948);
 assert.equal(result.recoveredPercentOfBaselineMissing,50.05);
});
