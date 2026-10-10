import fs from 'node:fs/promises';
import {fallback,imageIsPublishable,permittedLicence,metaImageCandidates} from './discover/lib/event-media.mjs';

const FILE=new URL('../src/data/events.json',import.meta.url);
const OUT=new URL('../reports/event-image-discovery.json',import.meta.url);
const REVIEW=new URL('../src/data/event-media-review.json',import.meta.url);
const UA='TassieNow/1.5 (+https://tassienow.com; event-media-discovery)';
const MAX=Math.min(100,Math.max(1,Number(process.env.MAX_EVENT_IMAGE_ENRICH)||32));
const now=()=>{const p=new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Hobart',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const v=k=>p.find(t=>t.type===k)?.value;return v('year')+'-'+v('month')+'-'+v('day');};
const clean=s=>String(s||'').replace(/<[^>]*>/g,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/\s+/g,' ').trim();
const common=new Set(['tasmania','tasmanian','the','and','for','with','festival','event','show','market','annual','hobart','launceston','devonport','burnie','2026','2027','2028','2029','music','arts','exhibition','centre','city','weekend']);
const words=s=>clean(s).normalize('NFKD').toLowerCase().split(/[^a-z0-9]+/).filter(t=>t.length>=5&&!common.has(t));
const mediaKey=image=>image?.sourceUrl||image?.url||'';
async function fetchText(url,timeout=9000){
  const response=await fetch(url,{headers:{'user-agent':UA,accept:'text/html,application/json;q=.9'},redirect:'follow',signal:AbortSignal.timeout(timeout)});
  if(!response.ok)throw new Error('HTTP '+response.status);
  const type=response.headers.get('content-type')||'';
  if(!/html|json|text/i.test(type))throw new Error('Unexpected media '+type);
  return response.text();
}
function candidateScore(event,page,info){
  const tokens=words(event.name);
  if(!tokens.length)return 0;
  const fields=clean([page.title,info.extmetadata?.ObjectName?.value,info.extmetadata?.ImageDescription?.value].filter(Boolean).join(' ')).toLowerCase();
  const hits=tokens.filter(t=>fields.includes(t)).length;
  if(!hits)return 0;
  const exact=clean(event.name).toLowerCase();
  let score=hits*35+(fields.includes(exact)?45:0);
  if(fields.includes(String(event.town||'').toLowerCase()))score+=8;
  if(/tasmania|tasmanian/.test(fields))score+=8;
  if(/\b(?:logo|brochure|advertisement|poster|screenshot|map|icon)\b/i.test(fields))return 0;
  // Avoid unrelated pictures that merely say "market" or "festival".
  return score>=43?score:0;
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
    const info=page.imageinfo?.[0],metadata=info?.extmetadata||{};
    if(!info)return[];
    const score=candidateScore(event,page,info);
    if(!score)return[];
    const license=clean(metadata.LicenseShortName?.value||metadata.UsageTerms?.value||'');
    const licenseUrl=metadata.LicenseUrl?.value||'';
    if(!permittedLicence(license,licenseUrl))return[];
    if(!/^https:\/\//.test(info.thumburl||info.url||''))return[];
    return [{
      score,image:{
        url:info.thumburl||info.url,alt:event.name+' — event photograph',
        attribution:clean(metadata.Artist?.value||metadata.Credit?.value)||'Wikimedia Commons contributor',
        license,licenseUrl,sourceUrl:info.descriptionurl,
        isFallback:false,sourceMethod:'commons-event',
        mediaCheckedAt:now()
      }
    }];
  }).sort((a,b)=>b.score-a.score);
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
const today=now();
const incomplete=events.filter(e=>e.status==='active'&&e.endDate>=today&&!imageIsPublishable(e.image));
const day=Math.floor(Date.now()/(6*3600000));
const near=incomplete.filter(e=>e.startDate<=new Date(Date.now()+14*86400000).toISOString().slice(0,10)).sort((a,b)=>a.startDate.localeCompare(b.startDate));
const later=incomplete.filter(e=>!near.includes(e)).sort((a,b)=>a.startDate.localeCompare(b.startDate));
const rotate=items=>items.length?[...items.slice((day*MAX)%items.length),...items.slice(0,(day*MAX)%items.length)]:[];
const urgentQuota=Math.ceil(MAX*.6);
const priority=near.filter(e=>/brixhibition/i.test(e.name));
const targets=[...priority,...rotate(near.filter(e=>!priority.includes(e))).slice(0,Math.max(0,urgentQuota-priority.length)),...rotate(later).slice(0,MAX-urgentQuota)];
if(targets.length<MAX)for(const e of [...rotate(near),...rotate(later)])if(targets.length<MAX&&!targets.includes(e))targets.push(e);
const report={checkedAt:new Date().toISOString(),active:events.filter(e=>e.status==='active'&&e.endDate>=today).length,missingBefore:incomplete.length,checked:targets.length,published:0,organiserCandidates:0,needsPermission:[],unresolved:[],errors:[]};
await inBatches(targets,4,async event=>{
  try{
    const [commons,official]=await Promise.allSettled([searchCommons(event),officialCandidates(event)]);
    if(commons.status==='fulfilled'&&commons.value.length){
      event.image=commons.value[0].image;
      report.published++;
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
const oldQueue=JSON.parse(await fs.readFile(REVIEW,'utf8').catch(()=>'{}'));
const queue={...oldQueue};
for(const item of report.needsPermission){
 const candidates=item.candidates.map(c=>({
  url:c.url,sourcePage:c.sourcePage,
  rights:'permission-needed',
  ...(c.historical?{historical:true,caption:c.caption}:{})
 }));
 if(!candidates.length)continue;
 queue[item.slug]={
  name:item.name,organiser:item.organiser,source:item.source,
  candidates,needs:'Organiser approval or an explicit reusable licence before embedding the photos'
 };
}
const nextQueue=JSON.stringify(queue,null,2)+'\n';
if(nextQueue!==JSON.stringify(oldQueue,null,2)+'\n'){
 await fs.writeFile(REVIEW,nextQueue);
 console.log('Updated durable organiser image review queue for '+Object.keys(queue).length+' events');
}
await fs.writeFile(FILE,JSON.stringify(events,null,2)+'\n');
await fs.mkdir(new URL('../reports/',import.meta.url),{recursive:true});
await fs.writeFile(OUT,JSON.stringify(report,null,2)+'\n');
console.log('Event media audit '+JSON.stringify({active:report.active,checked:report.checked,published:report.published,organiserCandidates:report.organiserCandidates,permissionReview:report.needsPermission.length,unresolved:report.unresolved.length,missingAfter:report.missingAfter,errors:report.errors.length}));
if(report.checked===0&&report.missingAfter)console.warn('Event image coverage incomplete: no event records checked');
