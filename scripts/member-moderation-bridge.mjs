// Runs only inside the dedicated PRIVATE Pixelwolf.net GitHub workflow.
// Never log contribution text, photographs, account names, emails or OIDC tokens.
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const endpoint='https://tassienow.com/api/member/automation';
const audience='https://tassienow.com/member-moderation';
const root=process.cwd(),folder=path.join(root,'ops/tassienow-community');
const event=JSON.parse(await fs.readFile(process.env.GITHUB_EVENT_PATH,'utf8'));
let action=process.env.BRIDGE_ACTION||'';
if(!action){
 const files=(event.commits||[]).flatMap(c=>[...(c.added||[]),...(c.modified||[])]);
 if(!files.length)files.push(...execFileSync('git',['diff','--name-only','HEAD^','HEAD'],{encoding:'utf8'}).trim().split('\n'));
 action=files.includes('ops/tassienow-community/decisions.json')?'apply':'export';
}
if(!['export','apply'].includes(action))throw Error('Invalid bridge action');
const tokenURL=new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);tokenURL.searchParams.set('audience',audience);
const oidcResponse=await fetch(tokenURL,{headers:{Authorization:`Bearer ${process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}`},signal:AbortSignal.timeout(20000)});
if(!oidcResponse.ok)throw Error(`OIDC token request failed (${oidcResponse.status})`);
const {value:oidc}=await oidcResponse.json();if(!oidc)throw Error('Missing workflow identity');
console.log(`::add-mask::${oidc}`);
async function api(body){
 const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${oidc}`},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
 const result=await response.json().catch(()=>({}));if(!response.ok)throw Error(`Moderation bridge failed (${response.status}): ${String(result.error||'request rejected').slice(0,140)}`);return result;
}
const out=path.join(root,'tassienow-moderation-output');await fs.mkdir(out,{recursive:true});
if(action==='export'){
 const request=JSON.parse(await fs.readFile(path.join(folder,'request.json'),'utf8'));
 if(!request.requestId||String(request.requestId).length>100)throw Error('Missing review request identity');
 const data=await api({action:'export'});data.requestId=request.requestId;
 await fs.mkdir(path.join(out,'photos'),{recursive:true});
 for(const item of data.items){
  if(item.kind==='photos'){
   if(!/^[a-f0-9-]{36}$/.test(item.id))throw Error('Invalid photograph identity');
   const imageResponse=await fetch(`https://tassienow.com${item.image_path}`,{headers:{Authorization:`Bearer ${oidc}`},signal:AbortSignal.timeout(20000)});if(!imageResponse.ok)throw Error(`Pending photograph read failed (${imageResponse.status})`);const bytes=new Uint8Array(await imageResponse.arrayBuffer());if(bytes.length>300000||imageResponse.headers.get('content-type')?.split(';')[0]!=='image/jpeg')throw Error('Invalid review photograph');const name=`photos/${item.id}.jpg`;await fs.writeFile(path.join(out,name),bytes);item.image_path=name;
  }
 }
 await fs.writeFile(path.join(out,'queue.json'),JSON.stringify(data,null,2)+'\n');
 console.log(`Moderation export: ${JSON.stringify({requestId:data.requestId,exportedAt:data.exportedAt,reviews:data.items.filter(i=>i.kind==='reviews').length,photos:data.items.filter(i=>i.kind==='photos').length,totals:data.totals})}`);
}else{
 const body=JSON.parse(await fs.readFile(path.join(folder,'decisions.json'),'utf8'));
 if(body.schema!=='tassienow-member-decisions-v1'||!body.requestId||!Array.isArray(body.decisions)||body.decisions.length>40)throw Error('Invalid decision file');
 const seen=new Set();for(const d of body.decisions){const key=`${d.kind}:${d.id}`;if(seen.has(key))throw Error('Duplicate decision');seen.add(key);}
 const results=[];
 for(let i=0;i<body.decisions.length;i+=5){const result=await api({action:'apply',decisions:body.decisions.slice(i,i+5)});results.push(...result.results);}
 const summary={requestId:body.requestId,appliedAt:new Date().toISOString(),approved:results.filter(r=>r.status==='approved').length,rejected:results.filter(r=>r.status==='rejected').length,held:results.filter(r=>r.status==='held').length,stale:results.filter(r=>r.status==='stale'||r.status==='missing').length};
 await fs.writeFile(path.join(out,'receipt.json'),JSON.stringify({...summary,results},null,2)+'\n');
 console.log('Moderation applied: '+JSON.stringify(summary));
}
