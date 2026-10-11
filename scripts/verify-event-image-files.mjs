import fs from 'node:fs/promises';
import events from '../src/data/events.json' with {type:'json'};
import {imageIsPublishable} from './discover/lib/event-media.mjs';
import {classifyImageResponse} from './discover/lib/check-event-image-http.mjs';

const sleep=ms=>new Promise(done=>setTimeout(done,ms));
const unique=new Map();
for(const event of events){
 if(imageIsPublishable(event.image)){
  const url=event.image.url;
  const item=unique.get(url)||{url,sourceUrl:event.image.sourceUrl,events:[],mediaType:event.image.mediaType||'event-photo'};
  item.events.push(event.slug);
  unique.set(url,item);
 }
}
async function check(item){
 let last={status:'inconclusive'};
 for(let attempt=1;attempt<=3;attempt++){
  try {
   const response=await fetch(item.url,{
    method:'HEAD',
    headers:{'user-agent':'TassieNow-Event-Media-Health/1.0'},
    redirect:'follow',signal:AbortSignal.timeout(14000)
   });
   let status=classifyImageResponse(response.status,response.headers.get('content-type'));
   // Some media CDNs do not handle HEAD. Only for those, fetch enough
   // headers from a GET request without downloading the photo's bytes.
   if(status==='needs-get'||status==='blocked'){
    const get=await fetch(item.url,{
     headers:{'user-agent':'TassieNow-Event-Media-Health/1.0',range:'bytes=0-127'},
     redirect:'follow',signal:AbortSignal.timeout(14000)
    });
    status=classifyImageResponse(get.status,get.headers.get('content-type'));
    await get.body?.cancel();
   }
   last={...item,status,attempt,http:response.status,contentType:response.headers.get('content-type')};
   if(status!=='retryable')return last;
  }catch(error){
   last={...item,status:'inconclusive',attempt,error:String(error.message).slice(0,180)};
  }
  if(attempt<3)await sleep(2000*attempt);
 }
 return last;
}
const checked=[];
for(const item of unique.values()){
 checked.push(await check(item));
 await sleep(1000);
}
const report={
 checkedAt:new Date().toISOString(),
 checked:checked.length,verified:checked.filter(x=>x.status==='verified').length,
 broken:checked.filter(x=>x.status==='broken'||x.status==='blocked'),
 inconclusive:checked.filter(x=>x.status==='retryable'||x.status==='inconclusive'),
 results:checked
};
await fs.mkdir(new URL('../reports/',import.meta.url),{recursive:true});
await fs.writeFile(new URL('../reports/event-image-file-health.json',import.meta.url),
 JSON.stringify(report,null,2)+'\n');
if(process.env.GITHUB_STEP_SUMMARY){
 await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,
  '## Real event photograph HTTP health\n'+report.verified+'/'+report.checked+
  ' unique image URLs loaded. Broken or blocked: '+report.broken.length+
  '. Temporarily unverified: '+report.inconclusive.length+'.\n');
}
console.log('Event image file health '+JSON.stringify({
 checked:report.checked,verified:report.verified,
 broken:report.broken.map(x=>({url:x.url,http:x.http,events:x.events})),
 inconclusive:report.inconclusive.map(x=>({url:x.url,error:x.error,http:x.http}))
}));
if(report.broken.length)process.exitCode=1;
