import fs from 'node:fs/promises';
import {imageIsPublishable,eventImagePriority,metaImageCandidates} from './discover/lib/event-media.mjs';
import {applyVerifiedEventVenueImages} from './discover/lib/verified-event-venues.mjs';
import {eligibleCommonsImage,eligibleCommonsVenueImage,approvedCandidateImage} from './discover/lib/event-image-policy.mjs';

const FILE=new URL('../src/data/events.json',import.meta.url);
const OUT=new URL('../reports/event-image-discovery.json',import.meta.url);
const REVIEW=new URL('../src/data/event-media-review.json',import.meta.url);
const UA='TassieNow/1.5 (+https://tassienow.com; event-media-discovery)';
const MAX=Math.min(100,Math.max(1,Number(process.env.MAX_EVENT_IMAGE_ENRICH)||32));
const now=()=>{const p=new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Hobart',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const v=k=>p.find(t=>t.type===k)?.value;return v('year')+'-'+v('month')+'-'+v('day');};
const clean=s=>String(s||'').replace(/<[^>]*>/g,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/\s+/g,' ').trim();
const common=new Set(['tasmania','tasmanian','the','and','for','with','festival','event','show','market','annual','hobart','launceston','devonport','burnie','2026','2027','2028','2029','music','arts','exhibition','centre','city','weekend','concert','concerts','venue','hall','theatre','carols','performance','school','holiday','lessons','community','activities','workshop','seniors','support','social','learn','class','classes','children','summer','family']);
const words=s=>clean(s).normalize('NFKD').toLowerCase().split(/[^a-z0-9]+/).filter(t=>t.length>=5&&!common.has(t));
const mediaKey=image=>image?.sourceUrl||image?.url||'';
async function fetchText(url,timeout=9000){
  const response=await fetch(url,{headers:{'user-agent':UA,accept:'text/html,application/json;q=.9'},redirect:'follow',signal:AbortSignal.timeout(timeout)});
  if(!response.ok)throw new Error('HTTP '+response.status);
  const type=response.headers.get('content-type')||'';
  if(!/html|json|text/i.test(type))throw new Error('Unexpected media '+type);
  return response.text();
}
async function searchCommons(event){
  const url=new URL('https://commons.wikimedia.org/w/api.php');
  for(const [k,v] of Object.entries({
    action:'query',format:'json',generator:'search',gsrnamespace:'6',gsrlimit:'12',
    gsrsearch:words(event.name).slice(0,3).join(' ')+' Tasmania',
    prop:'imageinfo',iiprop:'url|extmetadata',iiurlwidth:'1280'
  }))url.searchParams.set(k,v);
  const response=await fetch(url,{headers:{'user-agent':UA,accept:'application/json'},signal:AbortSignal.timeout(9000)});
  if(!response.ok)throw new Error('Commons HTTP '+response.status);
  const pages=Object.values((await response.json()).query?.pages||{});
  return pages.flatMap(page=>{
    const image=eligibleCommonsImage(event,page,page.imageinfo?.[0]);
    if(!image)return [];
    const score={eventPhoto:130,artwork:120,historical:105,context:65}[
      image.mediaType==='event-photo'?'eventPhoto':
      image.mediaType==='event-artwork'?'artwork':
      image.mediaType==='historical-event'?'historical':'context'
    ];
    return [{score,image}];
  }).sort((a,b)=>b.score-a.score);
}
// Commons is aggressively rate limited when many queries run at once.
const venueSearchCache=new Map();
let lastCommonsVenueQueryAt=0;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function fetchVenueSearch(url) {
  for(let attempt=0;attempt<3;attempt++){
    const pause=Math.max(0,lastCommonsVenueQueryAt+1200-Date.now());
    if(pause)await sleep(pause);
    lastCommonsVenueQueryAt=Date.now();
    const response=await fetch(url,{headers:{'user-agent':UA,accept:'application/json'},
      signal:AbortSignal.timeout(12000)});
    if(response.status===429 || response.status===503){
      if(attempt===2)throw Error('Commons venue search rate-limited: '+response.status);
      const secs=Number(response.headers.get('retry-after'));
      await sleep(Math.min(12000,Number.isFinite(secs)&&secs>0?secs*1000:2500*(attempt+1)));
      continue;
    }
    if(!response.ok)throw Error('Commons venue search HTTP '+response.status);
    return response.json();
  }
}
async function searchCommonsVenue(event){
  const venue=String(event.venue||'').split(',')[0].trim();
  if(venue.length<9 || !event.town || /^(?:hobart|launceston|devonport|tasmania|bothwell|theatre|cinema|town hall|community centre|various locations)$/i.test(venue))return[];
  const key=venue.toLowerCase()+'|'+event.town.toLowerCase();
  if(!venueSearchCache.has(key)){
    venueSearchCache.set(key,(async()=>{
      const url=new URL('https://commons.wikimedia.org/w/api.php');
      for(const [k,v] of Object.entries({
        action:'query',format:'json',generator:'search',gsrnamespace:'6',gsrlimit:'12',
        gsrsearch:venue+' '+event.town,prop:'imageinfo',
        iiprop:'url|extmetadata',iiurlwidth:'1280'
      }))url.searchParams.set(k,v);
      const pages=Object.values((await fetchVenueSearch(url)).query?.pages||{});
      return pages;
    })());
  }
  const pages=await venueSearchCache.get(key);
  return pages.flatMap(page=>{
    const image=eligibleCommonsVenueImage(event,page,page.imageinfo?.[0]);
    return image?[{score:55,image}]:[];
  });
}

async function officialCandidates(event){
  const urls=[event.sourceUrl,event.eventUrl].filter(Boolean).filter((u,i,a)=>a.indexOf(u)===i).slice(0,2);
  if(/brixhibition/i.test(event.name)&&!urls.some(u=>/brixhibition\.com\/?$/i.test(u)))
    urls.unshift('https://www.brixhibition.com/');
  const candidates=[];
  for(const url of urls){
    try{
      const html=await fetchText(url);
      for(const candidate of metaImageCandidates(html,url)){
        if(candidates.some(c=>c.url===candidate.url))continue;
        candidates.push(candidate);
      }
    }catch{/* retain source-specific failure in eventual no-media summary */}
  }
  // Historic event gallery is useful evidence, but must not be labelled 2026.
  if(/brixhibition/i.test(event.name)){
    const galleryUrl='https://www.brixhibition.com/Hobartbrixhibition2024.html';
    try{
      const html=await fetchText(galleryUrl);
      for(const candidate of metaImageCandidates(html,galleryUrl).slice(0,5))
        if(!candidates.some(c=>c.url===candidate.url))
          candidates.push({...candidate,historical:true,caption:'Brixhibition Hobart 2024 archive, NOT 2026'});
    }catch{/* do not make archival material an image without permission */}
  }
  return candidates.slice(0,12);
}
async function inBatches(items,limit,fn){
  for(let i=0;i<items.length;i+=limit)await Promise.all(items.slice(i,i+limit).map(fn));
}
const events=JSON.parse(await fs.readFile(FILE,'utf8'));
const oldQueue=JSON.parse(await fs.readFile(REVIEW,'utf8').catch(()=>'{}'));
const today=now();
let approved=0;
for(const event of events){
  if(event.status!=='active'||event.endDate<today||imageIsPublishable(event.image))continue;
  const review=oldQueue[event.slug];
  const chosen=(review?.candidates||[])
    .map(candidate=>approvedCandidateImage(event,candidate))
    .find(image=>image&&imageIsPublishable(image));
  if(chosen){event.image=chosen;approved++;}
}
if(approved)console.log('Applied approved, rights-verified organiser images: '+approved);
const venueContextAdded=applyVerifiedEventVenueImages(events);
if(venueContextAdded)console.log('Applied licensed, accurately labelled venue context: '+venueContextAdded);
let revoked=0;
for(const event of events){
  if(event.image?.sourceMethod==='commons-event'&&!imageIsPublishable(event.image)){
    event.image={url:'/images/categories/events.svg',alt:event.name+' event category artwork',attribution:'TassieNow',license:'Site artwork',licenseUrl:null,sourceUrl:null,isFallback:true};
    revoked++;
  }
}
if(revoked)console.warn('Rejected '+revoked+' previously misidentified Commons event images without verified match evidence.');
const incomplete=events.filter(e=>e.status==='active'&&e.endDate>=today&&eventImagePriority(e.image)<6);
const day=Math.floor(Date.now()/(6*3600000));
const near=incomplete.filter(e=>e.startDate<=new Date(Date.now()+14*86400000).toISOString().slice(0,10)).sort((a,b)=>a.startDate.localeCompare(b.startDate));
const later=incomplete.filter(e=>!near.includes(e)).sort((a,b)=>a.startDate.localeCompare(b.startDate));
const rotate=items=>items.length?[...items.slice((day*MAX)%items.length),...items.slice(0,(day*MAX)%items.length)]:[];
const urgentQuota=Math.ceil(MAX*.6);
const priority=near.filter(e=>/brixhibition/i.test(e.name));
const targets=[...priority,...rotate(near.filter(e=>!priority.includes(e))).slice(0,Math.max(0,urgentQuota-priority.length)),...rotate(later).slice(0,MAX-urgentQuota)];
if(targets.length<MAX)for(const e of [...rotate(near),...rotate(later)])if(targets.length<MAX&&!targets.includes(e))targets.push(e);
const report={checkedAt:new Date().toISOString(),approvedOrganiserImages:approved,venueContextAdded,active:events.filter(e=>e.status==='active'&&e.endDate>=today).length,missingBefore:incomplete.length,checked:targets.length,published:0,publishedImages:[],organiserCandidates:0,needsPermission:[],unresolved:[],errors:[]};
await inBatches(targets,4,async event=>{
  try{
    const [commons,official]=await Promise.allSettled([searchCommons(event),officialCandidates(event)]);
    let choices=commons.status==='fulfilled'?commons.value:[];
    if(!choices.length && eventImagePriority(event.image)<3){
      try {
        choices=await searchCommonsVenue(event);
      } catch(error) {
        report.errors.push({slug:event.slug,source:'Wikimedia venue',error:String(error.message).slice(0,100)});
      }
    }
    if(choices.length&&eventImagePriority(choices[0].image)>eventImagePriority(event.image)){
      event.image=choices[0].image;
      report.published++;
      report.publishedImages.push({slug:event.slug,name:event.name,url:event.image.url,licence:event.image.license,source:event.image.sourceUrl,mediaType:event.image.mediaType,score:choices[0].score});
    }else if(commons.status==='rejected')report.errors.push({slug:event.slug,source:'Wikimedia',error:String(commons.reason.message).slice(0,100)});
    if(official.status==='fulfilled'&&official.value.length){
      report.organiserCandidates+=official.value.length;
      report.needsPermission.push({
        slug:event.slug,name:event.name,organiser:event.sourceName||'',source:event.sourceUrl,
        candidates:official.value.slice(0,6),
        reason:'Organiser webpage and gallery images require an explicit re-use grant unless an eligible licence is shown.'
      });
    }
    if(!imageIsPublishable(event.image))report.unresolved.push({slug:event.slug,name:event.name,reason:official.status==='fulfilled'&&official.value.length?'organiser-rights-review':'no-matched-reusable-photo',source:event.sourceUrl});
  }catch(error){report.errors.push({slug:event.slug,error:String(error.message).slice(0,100)});}
});
report.missingAfter=events.filter(e=>e.status==='active'&&e.endDate>=today&&!imageIsPublishable(e.image)).length;
// Keep discovered organiser photo candidates for the owner's rights review.
// Do not rewrite the queue every six hours when no candidate changes.
const queue=structuredClone(oldQueue);
for(const item of report.needsPermission){
 const candidates=item.candidates.map(c=>({
  url:c.url,sourcePage:c.sourcePage,
  rights:'permission-needed',
  ...(c.historical?{historical:true,caption:c.caption}:{})
 })).filter(c=>c.url);
 if(!candidates.length)continue;
 const existing=queue[item.slug];
 if(!existing){
  queue[item.slug]={
   name:item.name,organiser:item.organiser,source:item.source,
   candidates,needs:'Organiser approval or an explicit reusable licence before embedding the photos'
  };
  continue;
 }
 // Research must never reset manual rights decisions or lose previously sourced images.
 const previous=new Set((existing.candidates||[]).map(c=>c.url));
 if(!Array.isArray(existing.candidates))existing.candidates=[];
 for(const candidate of candidates){
  if(!previous.has(candidate.url)){existing.candidates.push(candidate);previous.add(candidate.url);}
 }
}
const nextQueue=JSON.stringify(queue,null,2)+'\n';
if(nextQueue!==JSON.stringify(oldQueue,null,2)+'\n'){
 await fs.writeFile(REVIEW,nextQueue);
 console.log('Updated durable organiser image review queue for '+Object.keys(queue).length+' events');
}
await fs.writeFile(FILE,JSON.stringify(events,null,2)+'\n');
await fs.mkdir(new URL('../reports/',import.meta.url),{recursive:true});
await fs.writeFile(OUT,JSON.stringify(report,null,2)+'\n');
console.log('Event media audit '+JSON.stringify({active:report.active,approved:report.approvedOrganiserImages,venueContextAdded:report.venueContextAdded,checked:report.checked,published:report.published,organiserCandidates:report.organiserCandidates,permissionReview:report.needsPermission.length,unresolved:report.unresolved.length,missingAfter:report.missingAfter,errors:report.errors.length}));
if(report.checked===0&&report.missingAfter)console.warn('Event image coverage incomplete: no event records checked');
