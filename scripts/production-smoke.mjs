import fs from 'node:fs/promises';

const BASE='https://tassienow.com';
const TIMEOUT=15000;
const paths=[
 '/', '/food/', '/discover/today/', '/discover/this-weekend/',
 '/discover/markets/', '/discover/food/', '/discover/kids/', '/discover/free/',
 '/discover/rainy-day/', '/discover/nature/', '/town/hobart/',
 '/region/hobart-and-south/', '/region/west-coast/',
 '/region/central-tasmania/', '/region/flinders-island/',
 '/suggest-update/', '/privacy/', '/terms/', '/about/', '/status/'
];
const report={checkedAt:new Date().toISOString(),description:'Read-only HTTP production smoke checks; NOT a substitute for mobile/browser/accessibility/paid-flow testing',base:BASE,checks:[],failures:[]};
const wait=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
async function get(path,attempts=3){
  let last;
  for(let attempt=1;attempt<=attempts;attempt++){
    try{
      const response=await fetch(BASE+path,{redirect:'follow',headers:{'user-agent':'TassieNow-Production-Acceptance/1.0'},signal:AbortSignal.timeout(TIMEOUT)});
      return {response,html:await response.text()};
    }catch(error){last=error;if(attempt<attempts)await wait(attempt*1500);}
  }
  throw last;
}
async function check(name,path,{marker='TassieNow',expected=200,html=false}={}){
  const entry={name,path,expected,status:'unknown'};
  try{
    const {response,html:body}=await get(path);
    entry.httpCode=response.status;
    entry.status=response.status===expected&&(!marker||body.includes(marker))&&(!html||(/<h1\b/i.test(body)&&/<main\b/i.test(body)))?'pass':'fail';
    if(entry.status==='fail')entry.problem='Unexpected status, missing content, heading, or main landmark';
    if(path==='/'){
      for(const [header,expectedValue] of [
        ['strict-transport-security','max-age'],
        ['x-content-type-options','nosniff'],
        ['x-frame-options','DENY'],
        ['content-security-policy','frame-ancestors'],
        ['permissions-policy','geolocation']
      ]){
        const value=response.headers.get(header)||'';
        const ok=value.toLowerCase().includes(expectedValue.toLowerCase());
        const headerCheck={name:'Security: '+header,path:'/',expected:expectedValue,observed:value||null,status:ok?'pass':'fail'};
        report.checks.push(headerCheck);
        if(!ok)report.failures.push(headerCheck);
      }
    }
  }catch(error){entry.status='fail';entry.problem=String(error.message);}
  report.checks.push(entry);
  if(entry.status==='fail')report.failures.push(entry);
}
const sitemap=await get('/sitemap.xml');
if(sitemap.response.status!==200||!sitemap.html.includes('<urlset')){
 report.failures.push({name:'Sitemap retrieval',status:'fail',httpCode:sitemap.response.status});
}else{
 const known=[...sitemap.html.matchAll(/<loc>(https:\/\/tassienow\.com\/[^<]+)<\/loc>/g)].map(x=>x[1]);
 for(const type of ['place','event']){
   const url=known.find(url=>new URL(url).pathname.startsWith('/'+type+'/'));
   if(url)paths.push(new URL(url).pathname);
   else report.failures.push({name:'Published '+type+' in sitemap',status:'fail',problem:'No public URLs in published sitemap'});
 }
}
for (let i=0;i<paths.length;i+=5) {
 await Promise.all(paths.slice(i,i+5).map(path=>check('Visitor route '+path,path,{html:true})));
}
await check('Missing page returns 404','/this-page-does-not-exist-launch-check-20261008/',{expected:404,marker:null});
const protectedRoute={name:'Private corrections queue rejects anonymous access',path:'/api/admin/listing-corrections',status:'unknown'};
try{
 const {response}=await get(protectedRoute.path);
 protectedRoute.httpCode=response.status;
 protectedRoute.status=response.status===401?'pass':'fail';
}catch(error){protectedRoute.status='fail';protectedRoute.problem=String(error.message);}
report.checks.push(protectedRoute);
if(protectedRoute.status!=='pass')report.failures.push(protectedRoute);
report.checks.sort((a,b)=>a.name.localeCompare(b.name));
const summary={passed:report.checks.filter(x=>x.status==='pass').length,checks:report.checks.length,failed:report.failures.length};
report.summary=summary;
await fs.mkdir(new URL('../reports/',import.meta.url),{recursive:true});
await fs.writeFile(new URL('../reports/production-smoke.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
if(process.env.GITHUB_STEP_SUMMARY){
 const lines=['## Read-only public production smoke checks',summary.passed+'/'+summary.checks+' passed, '+summary.failed+' failed', 'This is not automated mobile or accessibility acceptance.'];
 for(const failure of report.failures)lines.push('- '+failure.name+': '+(failure.problem||failure.httpCode||'failed'));
 await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,lines.join('\n')+'\n');
}
console.log('Production HTTP smoke: '+JSON.stringify(summary));
if(summary.failed)process.exitCode=1;
