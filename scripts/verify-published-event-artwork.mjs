import fs from 'node:fs/promises';
import events from '../src/data/events.json' with {type:'json'};
import {eventDisplayImage} from '../src/lib/event-posters.mjs';
import {imageIsPublishable} from './discover/lib/event-media.mjs';

const dtf=new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Hobart',
 year:'numeric',month:'2-digit',day:'2-digit'});
const parts=dtf.formatToParts(new Date());
const part=key=>parts.find(x=>x.type===key)?.value;
const today=part('year')+'-'+part('month')+'-'+part('day');
const pending=events.filter(e=>e.status==='active'&&e.endDate>=today&&!imageIsPublishable(e.image));
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
const base='https://tassienow.com';
const unresolved=new Map(pending.map(e=>[e.slug,e]));
const attempts=12;
const results=[];
for(let round=1;round<=attempts && unresolved.size;round++){
 const candidates=[...unresolved.values()];
 for(let i=0;i<candidates.length;i+=12){
  const group=candidates.slice(i,i+12);
  const attemptsForGroup=await Promise.all(group.map(async e=>{
   const src=eventDisplayImage(e);
   try{
    const [imageResponse,pageResponse]=await Promise.all([
      fetch(base+src+'?verify='+Date.now(),{
       headers:{'user-agent':'TassieNow-Artwork-Live-Check/1.0','cache-control':'no-cache'},
       signal:AbortSignal.timeout(10000)}),
      fetch(base+'/event/'+encodeURIComponent(e.slug)+'/?verify='+Date.now(),{
       headers:{'user-agent':'TassieNow-Artwork-Live-Check/1.0','cache-control':'no-cache'},
       signal:AbortSignal.timeout(10000)})
    ]);
    const [svg,html]=await Promise.all([imageResponse.text(),pageResponse.text()]);
    const status=imageResponse.status,details=pageResponse.status;
    const visible=imageResponse.ok&&pageResponse.ok &&
      imageResponse.headers.get('content-type')?.includes('image/svg+xml') &&
      svg.includes('TASSIENOW') && svg.includes('<svg ') &&
      html.includes(src);
    return {slug:e.slug,status,details,visible:Boolean(visible),round};
   }catch(error){return {slug:e.slug,visible:false,round,error:String(error.message).slice(0,160)};}
  }));
  for(const result of attemptsForGroup){
   if(result.visible){results.push(result);unresolved.delete(result.slug);}
   else if(round===attempts){results.push(result);}
  }
 }
 if(unresolved.size&&round<attempts)await sleep(10000);
}
const report={checkedAt:new Date().toISOString(),activeFallbackEvents:pending.length,
 checked:results.length,verified:results.filter(x=>x.visible).length,
 failures:results.filter(x=>!x.visible)};
await fs.mkdir(new URL('../reports/',import.meta.url),{recursive:true});
await fs.writeFile(new URL('../reports/production-event-artwork.json',import.meta.url),
 JSON.stringify(report,null,2)+'\n');
if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,
 '## Live original event artwork\n'+report.verified+'/'+report.activeFallbackEvents+
 ' fallback event graphics and detail pages verified.\n');
console.log('Live original event artwork '+JSON.stringify(report));
if(report.verified!==report.activeFallbackEvents)process.exitCode=1;
