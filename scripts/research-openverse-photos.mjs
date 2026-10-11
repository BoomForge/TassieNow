import fs from 'node:fs/promises';
import {selectPhotoEnrichmentTargets} from './discover/lib/image-enrichment-targets.mjs';
import {photoSearchQueries,openverseCandidate,mergePlacePhotoReview} from './discover/lib/openverse-photo-candidates.mjs';

const PLACES=new URL('../src/data/places.json',import.meta.url);
const QUEUE=new URL('../src/data/place-media-review.json',import.meta.url);
const REPORT=new URL('../reports/openverse-photo-research.json',import.meta.url);
const USER_AGENT='TassieNow/1.0 (+https://tassienow.com; licensed-media-research)';
const MAX=Math.min(30,Math.max(1,Number(process.env.MAX_OPENVERSE_PLACES)||14));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const stats={requests:0,rateLimited:0,failures:0,results:0,eligible:0,errors:[]};
let lastRequestAt=0;

async function searchOpenverse(query){
  const url=new URL('https://api.openverse.org/v1/images/');
  url.searchParams.set('q',query);
  url.searchParams.set('license','by,by-sa,cc0,pdm');
  url.searchParams.set('mature','false');
  url.searchParams.set('page_size','20');
  for(let attempt=0;attempt<3;attempt++){
    const pause=Math.max(0,lastRequestAt+1500-Date.now());
    if(pause)await sleep(pause);
    lastRequestAt=Date.now();
    stats.requests++;
    try{
      const response=await fetch(url,{
        headers:{'User-Agent':USER_AGENT,Accept:'application/json'},
        signal:AbortSignal.timeout(12000)
      });
      if(response.status===429||response.status===503){
        stats.rateLimited++;
        if(attempt===2)throw Error('Openverse HTTP '+response.status+' after retries');
        const raw=Number(response.headers.get('retry-after'));
        const delay=Number.isFinite(raw)&&raw>0?raw*1000:(attempt+1)*3000;
        await sleep(Math.min(20000,Math.max(1500,delay)));
        continue;
      }
      if(!response.ok)throw Error('Openverse HTTP '+response.status);
      const body=await response.json();
      if(!Array.isArray(body.results))throw Error('Unexpected Openverse API response shape');
      stats.results+=body.results.length;
      return body.results;
    }catch(error){
      if(attempt<2 && /timeout|network|fetch failed/i.test(String(error.message))){
        await sleep((attempt+1)*2500);
        continue;
      }
      stats.failures++;
      if(stats.errors.length<12)stats.errors.push({query,error:String(error.message).slice(0,160)});
      return [];
    }
  }
  return [];
}

const places=JSON.parse(await fs.readFile(PLACES,'utf8'));
const previous=JSON.parse(await fs.readFile(QUEUE,'utf8').catch(()=> '{}'));
const missing=places.filter(p=>p.status==='active'&&p.visibility!=='suppressed'&&
  p.image?.isFallback===true&&p.name&&p.town);
const day=Math.floor(Date.now()/86400000);
const {targets,marketTargetCount,foodQuota}=selectPhotoEnrichmentTargets(missing,MAX,day);
const found={};
const checkedAt=new Date().toISOString();
for(const place of targets){
  const already=new Set((previous[place.slug]?.candidates||[]).map(c=>c.id));
  const candidates=[];
  for(const query of photoSearchQueries(place)){
    for(const work of await searchOpenverse(query)){
      const item=openverseCandidate(place,work,checkedAt);
      if(!item||already.has(item.id)||candidates.some(x=>x.id===item.id))continue;
      candidates.push(item);
      stats.eligible++;
      if(candidates.length>=4)break;
    }
    if(candidates.length>=4)break;
  }
  if(candidates.length)found[place.slug]={name:place.name,town:place.town,candidates};
}
const {queue,added,placesAdded}=mergePlacePhotoReview(previous,found);
const report={checkedAt,source:'Openverse public API (anonymous; free)',checked:targets.length,
  marketsChecked:marketTargetCount,foodPrioritySlots:foodQuota,placesWithNewCandidates:placesAdded,
  candidatesSaved:added,rightsVerifiedForPublication:0,imagesPublished:0,
  remainingWithoutHero:missing.length,stats};
await fs.mkdir(new URL('../reports/',import.meta.url),{recursive:true});
await fs.writeFile(REPORT,JSON.stringify(report,null,2)+'\n');
if(added)await fs.writeFile(QUEUE,JSON.stringify(queue,null,2)+'\n');
console.log('Openverse photographic research: '+JSON.stringify(report));
if(stats.requests>0 && stats.failures>=Math.ceil(stats.requests/2)) {
  throw Error('Openverse research degraded; see report. Do not claim photograph publication.');
}
