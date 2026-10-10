import fs from 'node:fs/promises';
import {verifiedPhotoPicks} from './discover/lib/verified-photo-picks.mjs';

// Verify actual Cloudflare visitor HTML, not a GitHub build or deploy check.
// A verified image counts as published only when its specific detail page
// embeds the corresponding photo and exposes its attribution.
const places=JSON.parse(await fs.readFile(new URL('../src/data/places.json',import.meta.url),'utf8'));
for(const pick of verifiedPhotoPicks){
 const place=places.find(p=>p.slug===pick.slug && p.name===pick.name);
 if(place?.status==='active' && place.image?.isFallback)
  throw Error('Previously approved place photo regressed to fallback: '+pick.slug);
}
const verified=places.filter(p=>p.status==='active'&&p.visibility!=='suppressed'&&p.image?.sourceMethod==='verified-curated'&&!p.image.isFallback);
const base=process.env.PHOTO_VERIFY_BASE||'https://tassienow.com';
const rounds=Math.max(1,Math.min(15,Number(process.env.PHOTO_VERIFY_ATTEMPTS||12)));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const results=await Promise.all(verified.slice(0,15).map(async place=>{
 const file=decodeURIComponent(new URL(place.image.url).pathname.split('/').pop());
 const url=new URL('/place/'+encodeURIComponent(place.slug)+'/',base);
 let last={status:'unverified',reason:'no response'};
 for(let attempt=1;attempt<=rounds;attempt++){
  url.searchParams.set('photo_check',String(Date.now())+'-'+attempt);
  try{
   const response=await fetch(url,{headers:{'user-agent':'TassieNow-Photo-Publication-Check/1.0','cache-control':'no-cache'},signal:AbortSignal.timeout(12000)});
   const html=await response.text();
   const photo=html.includes(file);
   const credit=html.includes(place.image.attribution);
   const placeholder=html.includes(place.name+' category artwork');
   last={status:response.ok&&photo&&credit&&!placeholder?'verified':'not-visible',http:response.status,photo,credit,placeholder,attempt};
   if(last.status==='verified')break;
  }catch(error){last={status:'network-error',reason:String(error.message).slice(0,160),attempt};}
  if(attempt<rounds)await sleep(12000);
 }
 return {slug:place.slug,name:place.name,sourceUrl:place.image.sourceUrl,...last};
}));
const report={checkedAt:new Date().toISOString(),base,checked:results.length,verified:results.filter(x=>x.status==='verified').length,results};
await fs.mkdir(new URL('../reports/',import.meta.url),{recursive:true});
await fs.writeFile(new URL('../reports/production-photo-verification.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
if(process.env.GITHUB_STEP_SUMMARY){
 const lines=['## Public photograph acceptance',report.verified+'/'+report.checked+' curated photographs visible on live site'];
 for(const result of results)lines.push('- '+result.name+': '+result.status+' ('+String(result.http||result.reason||'')+')');
 await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,lines.join('\n')+'\n');
}
console.log('Live image publishing: '+JSON.stringify(report));
if(!verified.length)console.log('No curated photographs in catalogue; only transport was tested.');
if(report.verified!==report.checked)process.exitCode=1;
