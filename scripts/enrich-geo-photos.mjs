import fs from 'node:fs/promises';
import {geosearchUrl,geotaggedImageForPlace} from './discover/lib/geotagged-photo-matches.mjs';
import {selectPhotoEnrichmentTargets} from './discover/lib/image-enrichment-targets.mjs';

const DATA=new URL('../src/data/places.json',import.meta.url);
const REPORT=new URL('../reports/geo-photo-enrichment.json',import.meta.url);
const MAX=Math.max(1,Math.min(250,Number.parseInt(process.env.MAX_GEO_PLACES||'200',10)||200));
const USER_AGENT='TassieNow/1.2 (+https://tassienow.com; free-geotag-image-discovery)';
const INTERVAL=1350;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let lastRequested=0;
const stats={requests:0,rateLimited:0,retries:0,failures:0,results:0,eligible:0,upgraded:0,excludedNoCoordinates:0,errors:[],examples:[]};

async function query(place){
  const url=geosearchUrl(place);
  if(!url){stats.excludedNoCoordinates++;return [];}
  for(let attempt=0;attempt<3;attempt++){
    const pause=Math.max(0,lastRequested+INTERVAL-Date.now());
    if(pause)await sleep(pause);
    lastRequested=Date.now();
    stats.requests++;
    try{
      const response=await fetch(url,{headers:{'user-agent':USER_AGENT,accept:'application/json'},signal:AbortSignal.timeout(15000)});
      if(response.status===429||response.status===503){
        stats.rateLimited++;
        if(attempt===2)throw Error('Commons HTTP '+response.status+' after retries');
        stats.retries++;
        const raw=Number(response.headers.get('retry-after'));
        await sleep(Math.min(20000,Math.max(2500,Number.isFinite(raw)&&raw>0?raw*1000:2500*(attempt+1))));
        continue;
      }
      if(!response.ok)throw Error('Commons HTTP '+response.status);
      const json=await response.json();
      const pages=Object.values(json.query?.pages||{});
      stats.results+=pages.length;
      return pages;
    }catch(error){
      if(attempt<2&&/timeout|network|fetch failed/i.test(String(error.message))){
        stats.retries++;await sleep((attempt+1)*2000);continue;
      }
      stats.failures++;
      if(stats.errors.length<8)stats.errors.push({place:place.slug,error:String(error.message).slice(0,120)});
      return [];
    }
  }
  return [];
}

const places=JSON.parse(await fs.readFile(DATA,'utf8'));
const missing=places.filter(p=>p.status==='active'&&p.visibility!=='suppressed'&&p.image?.isFallback===true);
const day=Math.floor(Date.now()/86400000);
const {targets,marketTargetCount,foodQuota}=selectPhotoEnrichmentTargets(missing,MAX,day);
const checkedAt=new Date().toISOString();

for(const place of targets){
  if(!place.image?.isFallback)continue;
  const candidates=(await query(place))
    .map(page=>geotaggedImageForPlace(place,page,checkedAt)).filter(Boolean);
  stats.eligible+=candidates.length;
  if(!candidates.length)continue;
  // A source with multiple equally matched images may vary. Preserve all
  // reviewable evidence in the report, but publish a single exact-match hero.
  const preferred=candidates.sort((a,b)=>
    Number(Boolean(b.licenseUrl))-Number(Boolean(a.licenseUrl)) ||
    a.sourceUrl.localeCompare(b.sourceUrl))[0];
  place.image=preferred;
  stats.upgraded++;
  if(stats.examples.length<25)stats.examples.push({slug:place.slug,name:place.name,source:preferred.sourceUrl});
}
if(stats.upgraded)await fs.writeFile(DATA,JSON.stringify(places,null,2)+'\n');
const report={checkedAt,source:'Wikimedia Commons GeoData (free)',checked:targets.length,
  marketsChecked:marketTargetCount,foodPrioritySlots:foodQuota,
  missingBefore:missing.length,missingAfter:missing.length-stats.upgraded,stats};
await fs.mkdir(new URL('../reports/',import.meta.url),{recursive:true});
await fs.writeFile(REPORT,JSON.stringify(report,null,2)+'\n');
console.log('Geotag photo enrichment: '+JSON.stringify(report));
if(stats.requests>0&&stats.failures>=Math.ceil(stats.requests/2))
  throw Error('Wikimedia geosearch degraded; reviewed evidence remains, no false publication success.');
