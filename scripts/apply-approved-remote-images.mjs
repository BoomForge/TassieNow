import fs from 'node:fs/promises';
import {verifyApprovedRemotePick,applyApprovedRemotePhotos} from './discover/lib/approved-remote-photos.mjs';

const root=new URL('../src/data/',import.meta.url);
const file=url=>new URL(url,root);
const approvals=JSON.parse(await fs.readFile(file('approved-remote-images.json'),'utf8'));
if(approvals.version!==1||!Array.isArray(approvals.approved)||approvals.approved.length>500)
  throw Error('Expected approved remote images v1, maximum 500 entries');
const [places,events]=await Promise.all(['places.json','events.json'].map(x=>fs.readFile(file(x),'utf8').then(JSON.parse)));
const reachable=new Set(), network=[];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
// The rebase/push phase must not re-hit a host immediately after a successful
// first-pass check. Trust only matching URL+slug evidence produced in this same
// run, within 20 minutes; do not accept stale external assertions.
const proofPath=process.env.REMOTE_IMAGE_PROOF || '';
const proof=proofPath ? JSON.parse(await fs.readFile(proofPath,'utf8')) : null;
const proofFresh=proof && Number.isFinite(Date.parse(proof.checkedAt)) &&
  Date.now()-Date.parse(proof.checkedAt)>=0 &&
  Date.now()-Date.parse(proof.checkedAt)<20*60000;
async function check(url){
  const maxAttempts=3;
  for(let attempt=1;attempt<=maxAttempts;attempt++){
    try{
      const u=new URL(url);
      if(u.protocol!=='https:')return {ok:false,reason:'not HTTPS',attempts:attempt};
      const head=await fetch(url,{method:'HEAD',redirect:'follow',signal:AbortSignal.timeout(10000),
        headers:{'user-agent':'TassieNow-Remote-Image-Check/1.1'}});
      const response=([405,403].includes(head.status)||!head.headers.get('content-type'))?
        await fetch(url,{method:'GET',headers:{range:'bytes=0-1023','user-agent':'TassieNow-Remote-Image-Check/1.1'},
          redirect:'follow',signal:AbortSignal.timeout(10000)}):head;
      const type=response.headers.get('content-type')||'';
      const final=new URL(response.url);
      const ok=response.ok&&final.protocol==='https:'&&/^image\/(?:jpeg|png|webp|avif)(?:\s*;|$)/i.test(type);
      if(response.body)await response.body.cancel().catch(()=>{});
      if(ok)return {ok:true,reason:'HTTP image verified',attempts:attempt};
      if(![429,503].includes(response.status)||attempt===maxAttempts)
        return {ok:false,reason:('HTTP '+response.status+' '+type).trim(),attempts:attempt};
      const serverDelay=Number(response.headers.get('retry-after'));
      const delay=Number.isFinite(serverDelay)&&serverDelay>0?
        serverDelay*1000:(attempt===1?12000:25000);
      // Respect the upstream's longer retry window by leaving this queued for
      // the next scheduled check rather than hammering Wikimedia.
      if(delay>50000)return {ok:false,reason:'HTTP '+response.status+'; upstream retry-after '+Math.ceil(delay/1000)+' seconds',attempts:attempt};
      await sleep(delay);
    }catch(e){
      if(attempt===maxAttempts)return {ok:false,reason:String(e.message).slice(0,120),attempts:attempt};
      await sleep(attempt===1?2000:4000);
    }
  }
  return {ok:false,reason:'HTTP attempts exhausted'};
}
for(const pick of approvals.approved){
  if(verifyApprovedRemotePick(pick))continue;
  const rows=pick.kind==='place'?places:events;
  const target=rows.find(x=>x.slug===pick.slug&&x.name===pick.name&&x.town===pick.town&&x.status==='active');
  if(!target)continue;
  if(pick.kind==='place'&&!target.image?.isFallback)continue;
  if(pick.kind==='event'&&!target.image?.isFallback)continue;
  if(reachable.has(pick.image.url))continue;
  const previous=proofFresh && proof.network?.find(x=>x.kind===pick.kind&&
    x.slug===pick.slug&&x.url===pick.image.url&&x.ok===true);
  if(!previous)await sleep(1800);
  const result=previous?
    {ok:true,reason:'Reused fresh first-pass HTTP verification',attempts:0}:
    await check(pick.image.url);
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
