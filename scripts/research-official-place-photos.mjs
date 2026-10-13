import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {researchOfficialEventImages} from './discover/lib/event-photo-recovery.mjs';
import {selectPhotoEnrichmentTargets} from './discover/lib/image-enrichment-targets.mjs';
import {mergePlacePhotoReview} from './discover/lib/openverse-photo-candidates.mjs';

// Prioritise independently linked original business and market pages. An OG
// image is evidence of a photo on that page, NEVER of reuse permission.
const ROOT=new URL('../src/data/',import.meta.url);
const REPORT=new URL('../reports/original-place-photo-recovery.json',import.meta.url);
const MAX=Math.max(1,Math.min(30,Number(process.env.MAX_ORIGINAL_PLACE_PHOTOS)||10));
const UA='TassieNow/1.6 (+https://tassienow.com; original-image-source-review)';
const places=JSON.parse(await fs.readFile(new URL('places.json',ROOT),'utf8'));
const linkData=JSON.parse(await fs.readFile(new URL('auto-photo-source-links.json',ROOT),'utf8'));
const previous=JSON.parse(await fs.readFile(new URL('place-media-review.json',ROOT),'utf8').catch(()=>'{}'));
const linked=linkData.places||{};
const missing=places.filter(p=>p.status==='active'&&p.visibility!=='suppressed'&&
 p.image?.isFallback===true&&linked[p.slug]?.evidence?.imageFoundOnPage===true);
const unreviewed=missing.filter(p=>!(previous[p.slug]?.candidates||[]).some(c=>c.sourcePage===linked[p.slug].sourceUrl));
const day=Math.floor(Date.now()/86400000);
const selection=selectPhotoEnrichmentTargets(unreviewed.length?unreviewed:missing,MAX,day);
const report={checkedAt:new Date().toISOString(),source:'Verified listing original pages (review only)',
 checked:0,marketsChecked:0,foodChecked:0,sourcesWithImages:0,imagesFound:0,
 candidatesSaved:0,imagesPublished:0,unresolved:[],sourceErrors:[],checkedDetails:[]};
const found={};
const safePageLink=value=>{
 try{
  const u=new URL(value);
  if(u.protocol!=='https:'||u.username||u.password||
    /^(?:localhost|127\.|10\.|192\.168\.)/i.test(u.hostname))return null;
  return u.href;
 }catch{return null;}
};
for(const place of selection.targets){
 const source=safePageLink(linked[place.slug]?.sourceUrl);
 if(!source)continue;
 const detail={slug:place.slug,name:place.name,source,outcome:'unresolved',imageCandidates:0};
 report.checked++;
 if((place.categories||[]).includes('Markets'))report.marketsChecked++;
 if((place.categories||[]).includes('Food & Drink'))report.foodChecked++;
 try{
  const response=await fetch(source,{headers:{'user-agent':UA,accept:'text/html'},
    redirect:'follow',signal:AbortSignal.timeout(14000)});
  if(!response.ok)throw Error('HTTP '+response.status);
  if(!/text\/html/i.test(response.headers.get('content-type')||''))throw Error('Not HTML');
  const html=await response.text();
  const leads=researchOfficialEventImages(html,response.url||source).slice(0,6);
  detail.imageCandidates=leads.length;
  if(leads.length){
    report.sourcesWithImages++;
    report.imagesFound+=leads.length;
    const candidates=leads.map(item=>({
      id:'original-site:'+createHash('sha256').update(item.url).digest('hex').slice(0,28),
      url:item.url,sourcePage:item.sourcePage,
      title:item.alt||'Image linked from original listing page',
      provider:'Original listing source',rights:'independent-verification-needed',
      identity:'candidate-not-verified',
      reason:'Official page image; source owner reuse rights and exact photo identity unverified',
      observedAt:report.checkedAt
    }));
    found[place.slug]={name:place.name,town:place.town,candidates};
    detail.outcome='permission-review';
  }else{
    detail.outcome='known-image-needs-manual-extraction';
    report.unresolved.push({slug:place.slug,source,
      reason:'Previously confirmed original-site image cannot be extracted from current HTML'});
  }
 }catch(error){
   detail.outcome='source-fetch-error';
   report.sourceErrors.push({slug:place.slug,source,error:String(error.message).slice(0,160)});
 }
 report.checkedDetails.push(detail);
}
const {queue,added,placesAdded}=mergePlacePhotoReview(previous,found);
report.candidatesSaved=added;
report.placesWithNewCandidates=placesAdded;
report.remainingKnownSourceLeads=missing.length;
await fs.mkdir(new URL('../reports/',import.meta.url),{recursive:true});
await fs.writeFile(REPORT,JSON.stringify(report,null,2)+'\n');
if(added)await fs.writeFile(new URL('place-media-review.json',ROOT),JSON.stringify(queue,null,2)+'\n');
console.log('Original place photo recovery: '+JSON.stringify({
 checked:report.checked,marketsChecked:report.marketsChecked,foodChecked:report.foodChecked,
 sourcesWithImages:report.sourcesWithImages,candidatesSaved:added,
 manualExtraction:report.unresolved.length,sourceErrors:report.sourceErrors.length,
 imagesPublished:0
}));
if(report.checked>0&&report.sourceErrors.length>=Math.ceil(report.checked*.75))
  throw Error('Original-place image source access degraded: most requests failed.');
