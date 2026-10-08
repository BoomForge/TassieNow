import fs from 'node:fs/promises';

const out = new URL('../src/data/operations-report.json', import.meta.url);
const repository = process.env.GITHUB_REPOSITORY || 'BoomForge/TassieNow';
const token = process.env.GITHUB_TOKEN;
const now = new Date();
const watched = [
  ['discover.yml', 200], ['events.yml', 18], ['catalogue-quality.yml', 42],
  ['images.yml', 42], ['quality.yml', 42], ['automation-health.yml', 18], ['indexnow.yml', 200]
];
const report = { generatedAt:now.toISOString(), workflows:[], site:{status:'unknown'}, failures:[] };
for (const [name, thresholdHours] of watched) {
  let entry={name,status:'unknown',lastScheduled:null,lastResult:null,url:null};
  try {
    if (!token) throw Error('GitHub token unavailable');
    const url='https://api.github.com/repos/'+repository+'/actions/workflows/'+name+'/runs?per_page=12';
    const response=await fetch(url,{headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(15000)});
    if (!response.ok) throw Error('GitHub HTTP '+response.status);
    const runs=(await response.json()).workflow_runs || [];
    const last=runs[0],scheduled=runs.find(x=>x.event==='schedule');
    entry.lastScheduled=scheduled?.created_at||null;
    entry.lastResult=last?.conclusion||last?.status||null;
    entry.url=last?.html_url||null;
    if(!scheduled) entry.status='missing-scheduled-run';
    else if((now-Date.parse(scheduled.created_at))/3600000>thresholdHours) entry.status='stale';
    else if(scheduled.status!=='completed'&&(now-Date.parse(scheduled.created_at))/3600000>6) entry.status='stalled';
    else if(scheduled.conclusion==='failure') entry.status='failed';
    else entry.status='ok';
  }catch(error){entry.status='unknown';entry.error=String(error.message);}
  if(entry.status!=='ok')report.failures.push({component:name,status:entry.status,action:'Inspect workflow schedule, permission and job logs'});
  report.workflows.push(entry);
}
try {
  const r=await fetch('https://tassienow.com/',{redirect:'follow',signal:AbortSignal.timeout(12000)});
  const html=await r.text();
  report.site={status:r.ok&&html.includes('TassieNow')?'ok':'failed',httpCode:r.status};
}catch(error){report.site={status:'failed',error:String(error.message)};}
if(report.site.status!=='ok')report.failures.push({component:'Public homepage',status:report.site.status,action:'Check DNS, TLS, Cloudflare Pages and deployment logs'});
await fs.writeFile(out,JSON.stringify(report,null,2)+'\n');
if(process.env.GITHUB_STEP_SUMMARY){
 const lines=['## TassieNow operations report','Observed: '+report.generatedAt,'Site: '+report.site.status,'Issues: '+report.failures.length];
 for(const failure of report.failures)lines.push('- '+failure.component+': '+failure.status+' — '+failure.action);
 await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,lines.join('\n')+'\n');
}
console.log('Recorded actual monitoring results; issues: '+report.failures.length);
