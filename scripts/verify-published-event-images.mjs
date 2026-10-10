import fs from 'node:fs/promises';
import {imageIsPublishable} from './discover/lib/event-media.mjs';

// An image is not "published" merely because a GitHub Actions run succeeded.
// Check the exact event page, media filename, credit and disclosure in HTML.
const events=JSON.parse(await fs.readFile(new URL('../src/data/events.json',import.meta.url),'utf8'));
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Hobart'}).format(new Date());
const photographed=events.filter(e=>e.status==='active'&&e.endDate>=today&&imageIsPublishable(e.image));
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
const attempts=10;
const results=await Promise.all(photographed.slice(0,15).map(async event=>{
  const page='https://tassienow.com/event/'+encodeURIComponent(event.slug)+'/';
  const path=new URL(event.image.url).pathname;
  const basename=decodeURIComponent(path.split('/').pop());
  let last={status:'not-verified'};
  for(let i=0;i<attempts;i++){
    try{
      const url=page+'?media-verify='+Date.now()+'-'+i;
      const res=await fetch(url,{headers:{'user-agent':'TassieNow-Media-Publication-Check/1.0','cache-control':'no-cache'},
        signal:AbortSignal.timeout(12000)});
      const html=await res.text();
      const photograph=html.includes(basename);
      const credit=html.includes(event.image.attribution);
      const disclosure=!event.image.caption||html.includes(event.image.caption);
      const figure=html.includes('class="detail-image"');
      last={status:res.ok&&photograph&&credit&&disclosure&&figure?'verified':'not-visible',
        http:res.status,photograph,credit,disclosure,figure,attempt:i+1};
      if(last.status==='verified')break;
    }catch(error){last={status:'network-error',error:String(error.message).slice(0,120)};}
    if(i<attempts-1)await sleep(12000);
  }
  return {slug:event.slug,mediaType:event.image.mediaType||'event-photo',...last};
}));
const report={checkedAt:new Date().toISOString(),activeWithPhotos:photographed.length,
  checked:results.length,verified:results.filter(e=>e.status==='verified').length,results};
await fs.mkdir(new URL('../reports/',import.meta.url),{recursive:true});
await fs.writeFile(new URL('../reports/production-event-images.json',import.meta.url),
  JSON.stringify(report,null,2)+'\n');
if(process.env.GITHUB_STEP_SUMMARY){
  await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,
   '## Event photo live publication\n'+report.verified+'/'+report.checked+' verified public event pages\n');
}
console.log('Event media production proof '+JSON.stringify(report));
if(report.verified!==report.checked)process.exitCode=1;
