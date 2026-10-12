// Public production acceptance: this checks deployed pages, never just git or CI builds.
// Read-only requests; reports Cloudflare diagnostics without bypassing security rules.
import fs from 'node:fs/promises';
import { marketCopy, tasmaniaDate } from '../src/lib/market-seo.mjs';

const origin = 'https://tassienow.com';
const referenceDay = tasmaniaDate();
const maxAttempts = Number(process.env.SEO_PROBE_ATTEMPTS || 8);
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const report = {
  generatedAt: new Date().toISOString(), target:origin, localDay:referenceDay,
  checks: [], attempts:0, status:'unknown'
};

async function request(path) {
  const response = await fetch(origin+path, {
    headers: {'User-Agent':'TassieNow-Production-SEO-Verification/1.0','Cache-Control':'no-cache'},
    signal:AbortSignal.timeout(15000)
  });
  return {
    status:response.status,
    contentType:response.headers.get('content-type') || '',
    cfRay:response.headers.get('cf-ray') || null,
    content:await response.text()
  };
}

function verdict(name, path, response, valid, detail) {
  return {
    name, path, status: valid ? 'pass' : 'fail', httpCode:response.status,
    contentType:response.contentType, cfRay:response.cfRay, ...(detail ? {detail} : {})
  };
}

async function inspect() {
  const checks=[];
  const targets=[
    ['/place/new-norfolk-market/','Market title'],
    ['/discover/markets/','Market date'],
    ['/data/site-build-date.json','Build checkpoint'],
    ['/sitemap.xml','Sitemap'],
    ['/robots.txt','Robots'],
    ['/discover/today/','Today freshness']
  ];
  const responses=await Promise.all(targets.map(async ([path, name])=>{
    try{return await request(path);}catch(error){return {status:0,contentType:'',cfRay:null,content:'',error:String(error).slice(0,150)};}
  }));
  const [place,markets,checkpoint,sitemap,robots,todayPage]=responses;
  checks.push(verdict('Market title',targets[0][0],place,
    place.status===200 && /<title>New Norfolk Market\s*[–-]\s*Saturdays 8am[–-]2pm\s*\|\s*TassieNow<\/title>/.test(place.content),
    place.error || (!place.content.includes('<title>')?'Page title absent':null)));
  checks.push(verdict('Market date',targets[1][0],markets,
    markets.status===200 && markets.content.includes('Lunawanna Makers and Produce Market')
      && marketCopy(markets.content,referenceDay)===markets.content
      && !markets.content.includes('Confirmed next session: 11 October 2026'),
    markets.error || (markets.content.includes('Confirmed next session: 11 October 2026')?'Expired October 11 next-session claim is live':null)));
  let publishedDate=null;
  try{publishedDate=JSON.parse(checkpoint.content).date;}catch{}
  const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Australia/Hobart',hour:'2-digit',hourCycle:'h23'}).format(new Date()));
  const previousDay=new Date(Date.parse(referenceDay+'T12:00:00Z')-86400000).toISOString().slice(0,10);
  const checkpointCurrent=publishedDate===referenceDay || (hour<5 && publishedDate===previousDay);
  checks.push(verdict('Build checkpoint',targets[2][0],checkpoint,
    checkpoint.status===200 && checkpointCurrent,
    'Published '+(publishedDate || 'unknown')+'; expected '+referenceDay));
  // A new checkpoint does not prove Cloudflare served freshly rendered events.
  // Check the actual built discovery page as well as the build-date JSON.
  const renderedDay=todayPage.content.match(/\\bdata-rendered-day=["'](\\d{4}-\\d{2}-\\d{2})["']/i)?.[1]||null;
  const freshDay=renderedDay===referenceDay || (hour<5 && renderedDay===previousDay);
  checks.push(verdict('Today freshness',targets[5][0],todayPage,
    todayPage.status===200 && freshDay && /<meta\\b[^>]*name=["']robots["'][^>]*content=["']index,follow/i.test(todayPage.content),
    'Rendered '+(renderedDay||'unknown')+'; expected '+referenceDay));
  const validSitemap=sitemap.status===200 && /xml/i.test(sitemap.contentType)
    && sitemap.content.includes('<urlset')
    && sitemap.content.includes('https://tassienow.com/place/new-norfolk-market/');
  checks.push(verdict('Sitemap',targets[3][0],sitemap,validSitemap,
    sitemap.error || (!validSitemap ? 'Sitemap missing/blocked or XML invalid' : null)));
  checks.push(verdict('Robots',targets[4][0],robots,
    robots.status===200 && robots.content.includes('User-agent') &&
      /Sitemap:\s*https:\/\/tassienow\.com\/sitemap\.xml/i.test(robots.content),
    robots.error || null));
  return checks;
}

for(let attempt=1; attempt<=maxAttempts; attempt++){
  report.attempts=attempt;
  report.checks=await inspect();
  const failed=report.checks.filter(check=>check.status!=='pass');
  console.log('Live SEO acceptance attempt '+attempt+'/'+maxAttempts+': '+(failed.length?failed.map(x=>x.name).join(', ')+' not confirmed':'all '+report.checks.length+' checks passed'));
  if(!failed.length){report.status='pass';break;}
  if(attempt<maxAttempts)await delay(15000);
}

if(report.status!=='pass')report.status='fail';
report.finishedAt=new Date().toISOString();
await fs.mkdir('reports',{recursive:true});
await fs.writeFile('reports/seo-production-check.json',JSON.stringify(report,null,2)+'\n');
for(const check of report.checks)console.log(JSON.stringify(check));
if(report.status!=='pass')process.exitCode=1;
