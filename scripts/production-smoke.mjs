import fs from 'node:fs/promises';

const BASE='https://tassienow.com';
const TIMEOUT=15000;
const paths=[
 '/', '/food/', '/discover/today/', '/discover/this-weekend/',
 '/discover/markets/', '/discover/food/', '/discover/kids/', '/discover/free/',
 '/discover/rainy-day/', '/discover/nature/', '/town/hobart/',
 '/region/hobart-and-south/', '/region/west-coast/',
 '/region/central-tasmania/', '/region/flinders-island/',
 '/suggest-update/', '/advertise/', '/privacy/', '/terms/', '/about/', '/status/'
];
const report={checkedAt:new Date().toISOString(),description:'Non-mutating public route and invalid Turnstile checks; NOT a substitute for mobile/browser/accessibility/paid-flow testing',base:BASE,checks:[],failures:[]};
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
    if(path==='/suggest-update/'||path==='/advertise/'){
      const hasWidget=body.includes('cf-turnstile')&&body.includes('data-sitekey');
      const widgetCheck={name:'Public '+(path==='/advertise/'?'advertising':'corrections')+' form has human verification widget',path,expected:'Turnstile site key and widget markup',status:hasWidget?'pass':'fail'};
      report.checks.push(widgetCheck);
      if(!hasWidget)report.failures.push({...widgetCheck,problem:'Check PUBLIC_TURNSTILE_SITE_KEY in Cloudflare build environment'});
    }
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
// Prove the homepage split was deployed, not merely that Astro builds.
// Public HTML should have a small first page; the full searchable catalogue
// must remain available via a versioned compact JSON file.
try{
  const page=await get('/');
  const bytes=Buffer.byteLength(page.html);
  const cards=(page.html.match(/class="place-card"/g)||[]).length;
  const lean=bytes<3000000&&cards<=25&&cards>=1;
  const check={name:'Production homepage HTML is bounded',path:'/',bytes,initialCards:cards,status:lean?'pass':'fail'};
  if(!lean){check.problem='Home HTML still oversized or full catalogue embedded (check production deployment)';report.failures.push(check);}
  report.checks.push(check);
  const index=await get('/data/home-search.json');
  let payload={};
  try{payload=JSON.parse(index.html);}catch{}
  const valid=index.response.status===200&&payload.version===1&&Array.isArray(payload.places)&&payload.count===payload.places.length&&payload.count>=500;
  const searchCheck={name:'Production complete catalogue index available',path:'/data/home-search.json',httpCode:index.response.status,placeCount:payload.count??null,bytes:Buffer.byteLength(index.html),status:valid?'pass':'fail'};
  if(!valid){searchCheck.problem='Home search JSON missing, incomplete or undeployed';report.failures.push(searchCheck);}
  report.checks.push(searchCheck);
}catch(error){
  const check={name:'Production homepage and search index probe',status:'fail',problem:String(error.message).slice(0,180)};
  report.failures.push(check);report.checks.push(check);
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
// These production POSTs are non-mutating by design: missing/invalid tokens,
// no legitimate form fields and no honey-pot fields. They cannot create a
// legitimate enquiry or correction, but do verify runtime secret enforcement.
async function mustRejectUnverified(name,path,body,expectedError) {
 const check={name,path,status:'unknown'};
 try{
   const response=await fetch(BASE+path,{method:'POST',headers:{'content-type':'application/json',origin:BASE,'user-agent':'TassieNow-Production-Security-Check/1.0'},
     body:JSON.stringify(body),signal:AbortSignal.timeout(TIMEOUT)});
   const data=await response.json();
   check.httpCode=response.status;
   check.serverResponse=String(data.error||'').slice(0,120);
   check.status=response.status===400&&expectedError.test(check.serverResponse)?'pass':'fail';
   if(check.status==='fail')check.problem='Turnstile did not explicitly reject missing/invalid token';
 }catch(error){check.status='fail';check.problem=String(error.message).slice(0,180);}
 report.checks.push(check);
 if(check.status==='fail')report.failures.push(check);
}
for(const path of ['/api/listing-corrections','/api/advertise']){
 await mustRejectUnverified('Turnstile refuses missing token at '+path,path,{},/Human verification is required/i);
 await mustRejectUnverified('Turnstile refuses fake token at '+path,path,
   {'cf-turnstile-response':'tassienow-negative-test-not-a-valid-token'},/Human verification failed/i);
}
for(const path of ['/api/admin/listing-corrections','/api/admin/inquiries']){
 const entry={name:'Anonymous admin route denied '+path,path,status:'unknown'};
 try{const response=await fetch(BASE+path,{signal:AbortSignal.timeout(TIMEOUT)});
   entry.httpCode=response.status;entry.status=response.status===401?'pass':'fail';
 }catch(error){entry.status='fail';entry.problem=String(error.message);}
 report.checks.push(entry);if(entry.status==='fail')report.failures.push(entry);
}
report.checks.sort((a,b)=>a.name.localeCompare(b.name));
const summary={passed:report.checks.filter(x=>x.status==='pass').length,checks:report.checks.length,failed:report.failures.length};
report.summary=summary;
await fs.mkdir(new URL('../reports/',import.meta.url),{recursive:true});
await fs.writeFile(new URL('../reports/production-smoke.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
if(process.env.GITHUB_STEP_SUMMARY){
 const lines=['## Production HTTP and negative Turnstile smoke checks',summary.passed+'/'+summary.checks+' passed, '+summary.failed+' failed', 'This is not automated mobile or accessibility acceptance.'];
 for(const failure of report.failures)lines.push('- '+failure.name+': '+(failure.problem||failure.httpCode||'failed'));
 await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,lines.join('\n')+'\n');
}
console.log('Production HTTP smoke: '+JSON.stringify(summary));
if(summary.failed)process.exitCode=1;
