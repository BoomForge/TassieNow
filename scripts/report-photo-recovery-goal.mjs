import fs from 'node:fs/promises';

// Fixed baseline: photographed public listings in 11 October 2026 audit.
// Net hero-photo coverage is a progress indicator; it does not certify
// that every photo is a unique image or that it was verified live.
const BASELINE={places:286,events:87,missingPlaces:1866,missingEvents:82};
const GOAL=Math.floor((BASELINE.missingPlaces+BASELINE.missingEvents)/2)+1;

export function photoRecoveryProgress(audit){
  const places=Number(audit?.places?.media?.realHeroCoverage?.count||0);
  const events=Number(audit?.events?.media?.licensedHeroCoverage?.count||0);
  const netAdditionalPhotos=places+events-BASELINE.places-BASELINE.events;
  const remaining=(Number(audit?.places?.public||0)-places)+
    (Number(audit?.events?.active||0)-events);
  const fraction=Math.max(0,netAdditionalPhotos)/(BASELINE.missingPlaces+BASELINE.missingEvents);
  return {
    measuredAt:audit?.generatedAt||null,
    baselineDate:'2026-10-11',
    baselineMissing:BASELINE.missingPlaces+BASELINE.missingEvents,
    baselinePhotographed:BASELINE.places+BASELINE.events,
    targetNewHeroPhotos:GOAL,
    observedPlaceHeroPhotos:places,
    observedEventHeroPhotos:events,
    netAdditionalHeroPhotos:netAdditionalPhotos,
    recoveredPercentOfBaselineMissing:Number((fraction*100).toFixed(2)),
    currentMissingPlaceAndEventHeroes:remaining,
    goalReached:netAdditionalPhotos>=GOAL,
    definition:'Net count of licensed real-photo hero coverage, not unreviewed leads, repeated gallery images or synthetic artwork.'
  };
}

if(process.argv[1] && import.meta.url===new URL('file://'+process.argv[1]).href){
  const audit=JSON.parse(await fs.readFile(new URL('../src/data/catalogue-audit.json',import.meta.url),'utf8'));
  const result=photoRecoveryProgress(audit);
  await fs.mkdir(new URL('../reports/',import.meta.url),{recursive:true});
  await fs.writeFile(new URL('../reports/photo-recovery-progress.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
  if(process.env.GITHUB_STEP_SUMMARY)
    await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,
      '\n## Real-photo recovery target\n'+
      'Net additional approved photo heroes: **'+result.netAdditionalHeroPhotos+'/'+result.targetNewHeroPhotos+
      '** ('+result.recoveredPercentOfBaselineMissing+'% of 11 October missing baseline).\n'+
      'Real photos missing now: **'+result.currentMissingPlaceAndEventHeroes+'**.\n'+
      (result.goalReached?'50% recovery target reached.':'50% target NOT yet reached; source candidates must not be counted as approved images.')+'\n');
  console.log('REAL-PHOTO-RECOVERY '+JSON.stringify(result));
}
