import fs from 'node:fs/promises';

const FILE = new URL('../src/data/places.json', import.meta.url);
const USER_AGENT = 'TassieNow/1.5 (+https://tassienow.com)';
const TODAY = new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Hobart'}).format(new Date());
const CONCURRENCY = 8;
const TIMEOUT = 10000;

const clean=(value='')=>String(value??'').replace(/<[^>]*>/g,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/\s+/g,' ').trim();
const norm=(value='')=>clean(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const tokens=(value='')=>norm(value).split(' ').filter((token)=>token.length>2&&!['the','and','tasmania','tasmanian','park','reserve','museum','gallery'].includes(token));
function url(value){try{const u=new URL(String(value));return['http:','https:'].includes(u.protocol)?u.href:null;}catch{return null;}}
function blocked(value){try{const h=new URL(value).hostname.replace(/^www\./,'');return /(?:^|\.)(?:facebook|instagram|tripadvisor|google|wikipedia|wikidata|openstreetmap)\./i.test(h);}catch{return true;}}
function titleText(html=''){const title=html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'';const h1=html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||'';return clean(`${title} ${h1}`.replace(/<[^>]+>/g,' '));}
function identityMatch(place,html,finalUrl){
  const wanted=tokens(place.name),hay=new Set(tokens(titleText(html)));
  const overlap=wanted.filter((token)=>hay.has(token)).length;
  if(wanted.length&&overlap>=Math.max(1,Math.ceil(wanted.length*.45)))return true;
  try{
    const hostTokens=tokens(new URL(finalUrl).hostname.replace(/^www\./,'').replace(/\.[a-z.]+$/i,''));
    return wanted.some((token)=>hostTokens.includes(token));
  }catch{return false;}
}
async function fetchPage(candidate){
  const response=await fetch(candidate,{headers:{'user-agent':USER_AGENT,accept:'text/html,application/xhtml+xml,*/*;q=.7'},redirect:'follow',signal:AbortSignal.timeout(TIMEOUT)});
  if(!response.ok)throw new Error(`${response.status} ${response.statusText}`);
  const text=await response.text();
  return{html:text.slice(0,1200000),url:response.url||candidate,contentType:response.headers.get('content-type')||''};
}
async function mapLimit(items,limit,worker){
  let index=0;
  const runners=Array.from({length:Math.min(limit,items.length)},async()=>{while(index<items.length){const current=items[index++];await worker(current);}});
  await Promise.all(runners);
}

const places=JSON.parse(await fs.readFile(FILE,'utf8'));
const targets=places.filter((place)=>place.status==='active'&&place.visibility!=='suppressed'&&url(place.officialSource?.url||place.website)&&!blocked(place.officialSource?.url||place.website));
let checked=0,verified=0,promoted=0,redirected=0,failed=0;

await mapLimit(targets,CONCURRENCY,async(place)=>{
  const candidate=url(place.officialSource?.url||place.website);if(!candidate)return;
  checked++;
  const authoritative=place.officialSource?.source==='wikidata:P856'||place.officialSource?.type==='government'||place.sourceType==='parks-tasmania';
  try{
    const page=await fetchPage(candidate);
    const htmlLike=/html/i.test(page.contentType)||/<html/i.test(page.html.slice(0,1000));
    const matched=authoritative||(htmlLike&&identityMatch(place,page.html,page.url));
    if(!matched){failed++;place.officialSourceCheck={status:'identity-mismatch',checkedAt:TODAY,url:page.url};return;}
    if(page.url!==candidate)redirected++;
    if(!place.officialSource?.url){
      place.officialSource={type:'official-website',url:page.url,source:place.sourceType==='openstreetmap'?'openstreetmap-website':'verified-website',checkedAt:TODAY};
      promoted++;
    }else{
      place.officialSource={...place.officialSource,url:page.url,checkedAt:TODAY};
    }
    if(!place.website)place.website=page.url;
    place.officialSourceCheck={status:'ok',checkedAt:TODAY,url:page.url};
    verified++;
  }catch(error){
    place.officialSourceCheck={status:'unreachable',checkedAt:TODAY,url:candidate,error:String(error.message||error).slice(0,160)};
    failed++;
  }
});

await fs.writeFile(FILE,`${JSON.stringify(places,null,2)}\n`);
console.log(`Official-source verification: checked ${checked} candidate site(s); verified ${verified}; promoted ${promoted}; redirects ${redirected}; unresolved/unreachable ${failed}.`);
