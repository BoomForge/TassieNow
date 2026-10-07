import fs from 'node:fs/promises';
const report=JSON.parse(await fs.readFile(new URL('../src/data/discovery-report.json',import.meta.url),'utf8'));
if (!report.checkedAt || !report.sources?.some(s=>s.pagesFetched>0)) throw new Error('Discovery report has no successful source checks');
const repo=process.env.GITHUB_REPOSITORY,sha=process.env.DISCOVERY_COMMIT||process.env.GITHUB_SHA,token=process.env.GITHUB_TOKEN;
if(process.env.EXPECTED_DISCOVERY_RUN && String(report.run?.id)!==process.env.EXPECTED_DISCOVERY_RUN) throw new Error('Completed discovery run did not save a matching report on main');
if(!repo||!sha||!token) throw new Error('GitHub verification context is required');
const api=async(path)=>{const r=await fetch(`https://api.github.com/repos/${repo}/${path}`,{headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error(`GitHub verification HTTP ${r.status}`);return r.json();};
let deployment;
for(let attempt=0;attempt<24;attempt++){
 const checks=await api(`commits/${sha}/check-runs`);
 deployment=checks.check_runs.find(c=>c.app?.slug==='cloudflare-workers-and-pages'&&c.name==='Cloudflare Pages');
 if(deployment?.status==='completed')break;
 await new Promise(resolve=>setTimeout(resolve,15000));
}
if(deployment?.conclusion!=='success')throw new Error(`Discovery commit Cloudflare deployment: ${deployment?.conclusion||deployment?.status||'not found'}`);
const automated=Boolean(report.run?.id&&report.run?.event!=='local');
const summary=`## Discovery publication verified\n\nCloudflare successfully deployed commit ${sha}.\n\nReport checked: ${report.checkedAt}. Sources checked: ${report.sources.filter(s=>s.pagesFetched>0).length}/${report.sources.length}; source warnings: ${report.totals.failedSources}. Pending review records: ${report.totals.review}.\n\n${automated?`Saved unattended scan: [run ${report.run.id}](https://github.com/${repo}/actions/runs/${report.run.id}) (${report.run.event}).`:'This report was generated locally; it does not prove a scheduled scan ran.'}\n`;
console.log(summary);
if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,summary);
