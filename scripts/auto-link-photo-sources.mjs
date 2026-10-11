import fs from 'node:fs/promises';
import {originalSourceCandidates,inspectOriginalPage,selectPhotoLinkTargets,
  mergePhotoLinkResearch} from './discover/lib/automatic-photo-sources.mjs';

const PLACES=new URL('../src/data/places.json',import.meta.url);
const EVENTS=new URL('../src/data/events.json',import.meta.url);
const STATE=new URL('../src/data/auto-photo-source-links.json',import.meta.url);
const REPORT=new URL('../reports/auto-photo-source-discovery.json',import.meta.url);
const MAX=Math.min(200,Math.max(1,Number(process.env.MAX_AUTOLINK_RECORDS)||100));
const CONCURRENCY=Math.min(6,Math.max(1,Number(process.env.AUTOLINK_CONCURRENCY)||4));
const CHECKED_AT=new Date().toISOString();
const stats={checked:0,requests:0,linkedPlaces:0,linkedEvents:0,unmatched:0,
  noPhotograph:0,errors:0,sourceUrlsChecked:0,samples:[]};
const [places,events,previous]=await Promise.all([
  fs.readFile(PLACES,'utf8').then(JSON.parse),fs.readFile(EVENTS,'utf8').then(JSON.parse),
  fs.readFile(STATE,'utf8').then(JSON.parse).catch(()=>({version:1,places:{},events:{},scans:{}}))
]);
const targets=selectPhotoLinkTargets(places,events,previous,MAX,CHECKED_AT);
const incoming={version:1,places:{},events:{},scans:{},generatedAt:CHECKED_AT};

// Follow redirects only within the same verified domain, never to local addresses,
// arbitrary short-link destinations or social/search engines.
async function fetchOriginal(start) {
  const initialHost=new URL(start).hostname.replace(/^www\./,'');
  let target=start;
  for(let i=0;i<3;i++) {
    const response=await fetch(target,{
      headers:{'user-agent':'TassieNow/1.0 (+https://tassienow.com; original-source-link-research)',
        'accept':'text/html,application/xhtml+xml'},
      redirect:'manual',signal:AbortSignal.timeout(9000)
    });
    stats.requests++;
    if(response.status>=300&&response.status<400) {
      const location=response.headers.get('location');
      if(!location)throw Error('Missing redirect destination');
      const next=new URL(location,target);
      if(next.protocol!=='https:'||next.hostname.replace(/^www\./,'')!==initialHost)
        throw Error('Redirect leaves verified original domain');
      target=next.href;
      continue;
    }
    if(!response.ok)throw Error('Original site HTTP '+response.status);
    const type=response.headers.get('content-type')||'';
    if(!/text\/html|application\/xhtml\+xml/.test(type))
      throw Error('Original source did not return HTML');
    const advertised=Number(response.headers.get('content-length')||0);
    if(advertised>1600000)throw Error('Original page too large');
    const html=await response.text();
    if(html.length>1600000)throw Error('Original page too large');
    return {html,url:target};
  }
  throw Error('Too many redirects');
}
async function check({type,record}) {
  stats.checked++;
  const key=type+':'+record.slug;
  const sources=originalSourceCandidates(record);
  let failure='',matchedPage=false,seenPage=false,found=null;
  for(const sourceUrl of sources) {
    try {
      const {html,url}=await fetchOriginal(sourceUrl);
      stats.sourceUrlsChecked++;seenPage=true;
      const original=inspectOriginalPage(record,url,html,CHECKED_AT);
      if(original) {found=original;break;}
      const text=(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'');
      if(text.toLowerCase().includes(record.name.toLowerCase().slice(0,12)))matchedPage=true;
    } catch(error) {
      failure=String(error.message||error).slice(0,120);
    }
  }
  let status='no-photo-source';
  if(found) {
    status='linked';
    incoming[type==='event'?'events':'places'][record.slug]=found;
    if(type==='event')stats.linkedEvents++;else stats.linkedPlaces++;
    if(stats.samples.length<16)stats.samples.push({type,slug:record.slug,url:found.sourceUrl});
  } else if(!seenPage&&failure) {status='fetch-error';stats.errors++;}
  else if(matchedPage){status='no-relevant-photo';stats.noPhotograph++;}
  else stats.unmatched++;
  incoming.scans[key]={status,checkedAt:CHECKED_AT};
}
let index=0;
await Promise.all(Array.from({length:Math.min(CONCURRENCY,targets.length)},async()=>{
  while(index<targets.length)await check(targets[index++]);
}));
const combined=mergePhotoLinkResearch(previous,incoming);
const report={checkedAt:CHECKED_AT,source:'Original public listing/event pages; no search scraping or paid APIs',
  targets:targets.length,stats,
  currentLinkedPlaces:Object.keys(combined.places).length,
  currentLinkedEvents:Object.keys(combined.events).length,
  remainingWithoutRealPlaceHero:places.filter(p=>p.status==='active'&&p.visibility!=='suppressed'&&p.image?.isFallback).length,
  remainingWithoutRealEventHero:events.filter(e=>e.status==='active'&&e.image?.isFallback).length,
  heroPhotosAdded:0,rightsApprovedForEmbedding:0,
  note:'Links open original pages only and do not count as published real photographs.'};
await fs.mkdir(new URL('../reports/',import.meta.url),{recursive:true});
await fs.writeFile(REPORT,JSON.stringify(report,null,2)+'\n');
if(JSON.stringify(combined)!==JSON.stringify(previous))
  await fs.writeFile(STATE,JSON.stringify(combined,null,2)+'\n');
console.log('AUTOMATED-PHOTO-SOURCE-LINKS '+JSON.stringify(report));
if(stats.checked>=10&&stats.errors>stats.checked*0.7)
  throw Error('Most official-source fetches failed; refusing to report successful broad discovery.');
