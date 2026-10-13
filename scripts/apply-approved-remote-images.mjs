import fs from 'node:fs/promises';
import {verifyApprovedRemotePick,applyApprovedRemotePhotos} from './discover/lib/approved-remote-photos.mjs';

const root=new URL('../src/data/',import.meta.url);
const file=url=>new URL(url,root);
const approvals=JSON.parse(await fs.readFile(file('approved-remote-images.json'),'utf8'));
if(approvals.version!==1||!Array.isArray(approvals.approved)||approvals.approved.length>500)
  throw Error('Expected approved remote images v1, maximum 500 entries');
const [places,events]=await Promise.all(['places.json','events.json'].map(x=>fs.readFile(file(x),'utf8').then(JSON.parse)));
const reachable=new Set(), network=[];
async function check(url){
  try{
    const u=new URL(url);
    if(u.protocol!=='https:')return {ok:false,reason:'not HTTPS'};
    const head=await fetch(url,{method:'HEAD',redirect:'follow',signal:AbortSignal.timeout(8000),
      headers:{'user-agent':'TassieNow-Remote-Image-Check/1.0'}});
    const response=([405,403].includes(head.status)||!head.headers.get('content-type'))?
      await fetch(url,{method:'GET',headers:{range:'bytes=0-1023','user-agent':'TassieNow-Remote-Image-Check/1.0'},
        redirect:'follow',signal:AbortSignal.timeout(8000)}):head;
    const type=response.headers.get('content-type')||'';
    const final=new URL(response.url);
    const ok=response.ok&&final.protocol==='https:'&&/^image\/(?:jpeg|png|webp|avif)(?:\s*;|$)/i.test(type);
    if(response.body)await response.body.cancel().catch(()=>{});
    return {ok,reason:ok?'HTTP image verified':('HTTP '+response.status+' '+type).trim()};
  }catch(e){return {ok:false,reason:String(e.message).slice(0,120)};}
}
for(const pick of approvals.approved){
  if(verifyApprovedRemotePick(pick))continue;
  const rows=pick.kind==='place'?places:events;
  const target=rows.find(x=>x.slug===pick.slug&&x.name===pick.name&&x.town===pick.town&&x.status==='active');
  if(!target)continue;
  if(pick.kind==='place'&&!target.image?.isFallback)continue;
  if(pick.kind==='event'&&!target.image?.isFallback)continue;
  if(reachable.has(pick.image.url))continue;
  const result=await check(pick.image.url);
  network.push({kind:pick.kind,slug:pick.slug,url:pick.image.url,...result});
  if(result.ok)reachable.add(pick.image.url);
}
const result=applyApprovedRemotePhotos(places,events,approvals.approved,reachable);
if(result.placesAdded)await fs.writeFile(file('places.json'),JSON.stringify(places,null,2)+'\n');
if(result.eventsAdded)await fs.writeFile(file('events.json'),JSON.stringify(events,null,2)+'\n');
const report={checkedAt:new Date().toISOString(),proposals:approvals.approved.length,
  httpChecked:network.length,network, ...result};
await fs.mkdir(new URL('../reports/',import.meta.url),{recursive:true});
await fs.writeFile(new URL('../reports/remote-image-publication.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log('Remote originals publication: '+JSON.stringify({proposals:report.proposals,
  checked:network.length,placesAdded:result.placesAdded,eventsAdded:result.eventsAdded,
  notPublished:result.skipped.length}));
