import fs from 'node:fs/promises';
import {imageIsPublishable} from './discover/lib/event-media.mjs';

const out = new URL('../src/data/operations-report.json', import.meta.url);
const repository = process.env.GITHUB_REPOSITORY || 'BoomForge/TassieNow';
const token = process.env.GITHUB_TOKEN;
const now = new Date();
// Frequencies are intentionally generous to account for GitHub schedule delays.
const watched = [
  ['discover.yml', 200], ['events.yml', 42], ['catalogue-quality.yml', 42],
  ['images.yml', 42], ['verify-published-photos.yml', 42], ['verify-published-event-images.yml', 42], ['verify-event-artwork.yml', 42], ['verify-event-image-files.yml', 42], ['event-photo-research.yml', 42], ['quality.yml', 42], ['automation-health.yml', 42],
  ['indexnow.yml', 200]
];
const onceOnly = ['recover-images.yml', 'production-smoke.yml'];

const report = {generatedAt:now.toISOString(),source:'Observed GitHub Actions and HTTP requests',workflows:[],site:{status:'unknown',checks:[]},failures:[]};
const ageHours = (value) => value ? (now - Date.parse(value)) / 3600000 : Infinity;

async function api(path) {
  if (!token) throw Error('GitHub Actions token unavailable');
  const response=await fetch('https://api.github.com/repos/'+repository+path,{
    headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},
    signal:AbortSignal.timeout(15000)
  });
  if (!response.ok) throw Error('GitHub HTTP '+response.status);
  return response.json();
}

for(const name of onceOnly){
  const entry={name,status:'unknown',lastScheduled:null,lastResult:null,lastRunAt:null,url:null};
  try {
    const data=await api('/actions/workflows/'+name+'/runs?per_page=2');
    const latest=data.workflow_runs?.[0];
    entry.lastRunAt=latest?.created_at||null;
    entry.lastResult=latest?.conclusion||latest?.status||null;
    entry.url=latest?.html_url||null;
    entry.status=!latest?'not-run':latest.status!=='completed'?'pending':
      latest.conclusion==='success'?'ok':latest.conclusion==='cancelled'?'cancelled':'failed';
  }catch(error){entry.error=String(error.message);}
  if(entry.status!=='ok') report.failures.push({component:name,status:entry.status,action:entry.url||'Inspect image recovery workflow'});
  report.workflows.push(entry);
}
await Promise.all(watched.map(async ([name,thresholdHours])=>{
  const entry={name,status:'unknown',lastScheduled:null,lastResult:null,lastRunAt:null,url:null};
  try{
    // Find scheduled runs explicitly. Busy push-triggered workflows can have more
    // than 12 runs since the last scheduled execution.
    const [scheduledResult,recentResult]=await Promise.all([
      api('/actions/workflows/'+name+'/runs?event=schedule&per_page=2'),
      api('/actions/workflows/'+name+'/runs?per_page=3')
    ]);
    const scheduled=scheduledResult.workflow_runs?.[0];
    const latest=recentResult.workflow_runs?.[0];
    entry.lastScheduled=scheduled?.created_at||null;
    entry.lastRunAt=latest?.created_at||null;
    entry.lastResult=latest?.conclusion||latest?.status||null;
    entry.url=latest?.html_url||scheduled?.html_url||null;
    if (!scheduled) entry.status='no-scheduled-run-observed';
    else if (scheduled.status!=='completed' && ageHours(scheduled.created_at)>6) entry.status='scheduled-run-stalled';
    else if (scheduled.conclusion==='failure') entry.status='scheduled-run-failed';
    else if (ageHours(scheduled.created_at)>thresholdHours) entry.status='scheduled-run-stale';
    else if (latest?.conclusion==='failure') entry.status='latest-run-failed';
    else if (latest?.conclusion==='cancelled') entry.status='latest-run-cancelled';
    else entry.status='ok';
  }catch(error){entry.error=String(error.message);}
  if(entry.status!=='ok')report.failures.push({component:name,status:entry.status,action:entry.url||'Inspect GitHub Actions schedule and job logs'});
  report.workflows.push(entry);
}));


// Compare published image statistics against the current source catalogue.
// Unlike scheduled workflow checks, this catches stale audits even when CI passes.
try {
  const [events, audit] = await Promise.all([
    fs.readFile(new URL('../src/data/events.json', import.meta.url),'utf8').then(JSON.parse),
    fs.readFile(new URL('../src/data/catalogue-audit.json', import.meta.url),'utf8').then(JSON.parse)
  ]);
  const p = new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Hobart',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const get = key => p.find(part=>part.type===key)?.value;
  const today = `${get('year')}-${get('month')}-${get('day')}`;
  const active=events.filter(event=>event.status==='active' && event.endDate>=today);
  const photographed=active.filter(event=>imageIsPublishable(event.image)).length;
  if(audit.generatedAt!==today || audit.events.active!==active.length ||
     audit.events.media.licensedHeroCoverage.count!==photographed){
    report.failures.push({component:'Published photo coverage audit',status:'stale-or-inaccurate',
      action:'Regenerate catalogue-audit.json from current events.json before publication'});
  }
  report.imageCoverage={activeEvents:active.length,publishedEventPhotos:photographed,
    auditedPublishedPhotos:audit.events.media.licensedHeroCoverage.count};
} catch(error){
  report.failures.push({component:'Published photo coverage audit',status:'error',action:String(error.message)});
}

const checks=[
  ['Homepage','/','TassieNow'],['Food discovery','/food/','Places to Eat'],
  ['Service status','/status/','Service & data status'],['Robots','/robots.txt','User-agent'],
  ['Sitemap','/sitemap.xml','<urlset']
];
await Promise.all(checks.map(async ([name,path,marker])=>{
  const check={name,path,status:'unknown',httpCode:null};
  try{
    const response=await fetch('https://tassienow.com'+path,{redirect:'follow',signal:AbortSignal.timeout(12000)});
    check.httpCode=response.status;
    const body=await response.text();
    check.status=response.ok&&body.includes(marker)?'ok':'failed';
  }catch(error){check.status='failed';check.error=String(error.message);}
  if(check.status!=='ok')report.failures.push({component:'Public '+name,status:check.status,action:'Inspect Cloudflare deployment, TLS and route: '+path});
  report.site.checks.push(check);
}));
report.site.status=report.site.checks.every(c=>c.status==='ok')?'ok':'failed';
report.site.checks.sort((a,b)=>checks.findIndex(c=>c[0]===a.name)-checks.findIndex(c=>c[0]===b.name));
report.workflows.sort((a,b)=>{
  const order=watched.map(x=>x[0]).concat(onceOnly);
  return order.indexOf(a.name)-order.indexOf(b.name);
});
await fs.writeFile(out,JSON.stringify(report,null,2)+'\n');
if(process.env.GITHUB_STEP_SUMMARY) {
  const lines=['## TassieNow operations report','Observed: '+report.generatedAt,
    'Public routes: '+report.site.checks.filter(x=>x.status==='ok').length+'/'+report.site.checks.length,
    'Actionable findings: '+report.failures.length];
  for(const issue of report.failures)lines.push('- '+issue.component+': '+issue.status+' — '+issue.action);
  await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,lines.join('\n')+'\n');
}
console.log('Recorded observable operations health; findings: '+report.failures.length);
