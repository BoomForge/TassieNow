import fs from 'node:fs/promises';
const FILE=new URL('../src/data/places.json',import.meta.url);
const UA='TassieNow/1.1 (+https://tassienow.com)';
const MAX_PER_RUN=Math.max(1,Math.min(500,Number.parseInt(process.env.MAX_IMAGE_ENRICH||'120',10)||120));
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const clean=(v='')=>String(v).replace(/<[^>]*>/g,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/\s+/g,' ').trim();
const tokens=(v='')=>clean(v).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().split(/[^a-z0-9]+/).filter(x=>x.length>=4&&!['tasmania','tasmanian','the','park','walk','lookout','museum','gallery'].includes(x));
function candidateScore(place,page,info){
  const title=clean(page.title).toLowerCase(),meta=info.extmetadata||{},blob=clean(`${meta.ObjectName?.value||''} ${meta.ImageDescription?.value||''} ${meta.Categories?.value||''} ${meta.Credit?.value||''}`).toLowerCase();
  if(/\b(logo|map|diagram|coat of arms|flag|icon|signage|sign|poster|brochure|floor plan|locator map)\b/.test(title))return 0;
  const pt=tokens(place.name),tt=tokens(title);let s=0;
  for(const t of pt)if(tt.includes(t))s+=18;
  if(blob.includes('tasmania'))s+=18;
  if(place.town&&(`${title} ${blob}`).includes(String(place.town).toLowerCase()))s+=14;
  if(pt.some(t=>blob.includes(t)))s+=12;
  if(/\.(?:jpe?g|webp)$/i.test(title))s+=5;
  if(place.categories?.some(c=>/museum|wildlife|nature|walk|attraction|food|market/i.test(c))&&blob.includes(String(place.categories[0]||'').toLowerCase()))s+=4;
  return s;
}
async function queryCommons(place,searchText){
  const u=new URL('https://commons.wikimedia.org/w/api.php');
  u.searchParams.set('action','query');u.searchParams.set('format','json');u.searchParams.set('generator','search');u.searchParams.set('gsrnamespace','6');u.searchParams.set('gsrlimit','8');u.searchParams.set('gsrsearch',searchText);u.searchParams.set('prop','imageinfo');u.searchParams.set('iiprop','url|extmetadata');u.searchParams.set('iiurlwidth','1400');
  try{const r=await fetch(u,{headers:{'user-agent':UA,accept:'application/json'},signal:AbortSignal.timeout(12000)});if(!r.ok)return null;const d=await r.json();let best=null,bestScore=0;for(const page of Object.values(d.query?.pages||{})){const info=page.imageinfo?.[0];if(!info)continue;const s=candidateScore(place,page,info);if(s>bestScore){best={page,info};bestScore=s;}}if(!best||bestScore<42)return null;const m=best.info.extmetadata||{};const license=clean(m.LicenseShortName?.value||m.UsageTerms?.value||'');if(!license)return null;return{url:best.info.thumburl||best.info.url,alt:`${place.name}, Tasmania`,attribution:clean(m.Artist?.value||m.Credit?.value||'')||'Wikimedia Commons contributor',license,licenseUrl:m.LicenseUrl?.value||null,sourceUrl:best.info.descriptionurl||null,isFallback:false,sourceMethod:'commons-search',confidence:'high'};}catch{return null;}
}
async function search(place){
  const exact=await queryCommons(place,`"${place.name}" "${place.town||'Tasmania'}" Tasmania`);
  if(exact)return exact;
  await sleep(60);
  return queryCommons(place,`${place.name} ${place.town||''} Tasmania`);
}
const places=JSON.parse(await fs.readFile(FILE,'utf8'));
const fallbacks=places.filter(p=>p.status==='active'&&p.visibility!=='suppressed'&&p.image?.isFallback).sort((a,b)=>(b.qualityScore||0)-(a.qualityScore||0)||a.name.localeCompare(b.name));
const day=Math.floor(Date.now()/86400000),offset=fallbacks.length?(day*MAX_PER_RUN)%fallbacks.length:0;
const rotated=fallbacks.length?[...fallbacks.slice(offset),...fallbacks.slice(0,offset)]:[];
const targets=rotated.slice(0,MAX_PER_RUN);
let upgraded=0;
for(const place of targets){const image=await search(place);if(image){place.image=image;upgraded++;}await sleep(80);}
await fs.writeFile(FILE,`${JSON.stringify(places,null,2)}\n`);
console.log(`Image enrichment: checked ${targets.length} fallback listings from rotating offset ${offset}; upgraded ${upgraded} with licensed Commons photographs. ${Math.max(0,fallbacks.length-upgraded)} fallback listing(s) remain before future passes.`);
