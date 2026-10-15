import { fail, reply, digest, text, jsonBody } from './members.js';
import { isAdmin } from './auth.js';
import { placeMap } from './member-places.js';

const ISSUER='https://token.actions.githubusercontent.com';
const AUDIENCE='https://tassienow.com/member-moderation';
const WORKFLOW='BoomForge/Pixelwolf.net/.github/workflows/tassienow-member-moderation.yml@refs/heads/main';
let cachedKeys,keysUntil=0;
const decode = value => Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
export async function workflowIdentity(request){
  const token=(request.headers.get('authorization')||'').replace(/^Bearer /,'');
  if(!token||token.length>12000)fail('Scheduled reviewer authentication required.',401);
  try{
    const parts=token.split('.');if(parts.length!==3)throw Error('JWT');
    const header=JSON.parse(new TextDecoder().decode(decode(parts[0]))),claims=JSON.parse(new TextDecoder().decode(decode(parts[1]))),now=Date.now()/1000;
    if(header.alg!=='RS256'||typeof header.kid!=='string'||claims.iss!==ISSUER||claims.aud!==AUDIENCE||!Number.isFinite(claims.exp)||claims.exp<now||!Number.isFinite(claims.iat)||claims.iat>now+30||now-claims.iat>600||(claims.nbf&&claims.nbf>now+30))throw Error('Claims');
    if(claims.repository!=='BoomForge/Pixelwolf.net'||String(claims.repository_id)!=='1339046610'||String(claims.repository_owner_id)!=='240363312'||claims.ref!=='refs/heads/main'||claims.workflow_ref!==WORKFLOW||!['push','workflow_dispatch'].includes(claims.event_name))throw Error('Scope');
    if(!cachedKeys||Date.now()>keysUntil||!cachedKeys.some(k=>k.kid===header.kid)){
      const response=await fetch(`${ISSUER}/.well-known/jwks`,{signal:AbortSignal.timeout(10000)});
      if(!response.ok)throw Error('JWKS');const body=await response.json();cachedKeys=body.keys;keysUntil=Date.now()+3600000;
    }
    const jwk=cachedKeys?.find(k=>k.kid===header.kid&&k.kty==='RSA');if(!jwk)throw Error('Key');
    const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
    if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(parts[2]),new TextEncoder().encode(`${parts[0]}.${parts[1]}`)))throw Error('Signature');
    return {runId:String(claims.run_id),sha:String(claims.sha),actor:String(claims.actor)};
  }catch{fail('Scheduled reviewer authentication failed.',401);}
}
const tables={reviews:'member_reviews',photos:'member_photos'};
export async function contributionVersion(kind,row){return digest(JSON.stringify([kind,row.id,row.created_at,kind==='reviews'?[row.rating,row.body]:[row.caption,row.bytes]]));}
export async function moderationQueue(database){
  const items=[];
  const reportRows=(await database.prepare('SELECT kind,target_id,reason FROM member_reports ORDER BY created_at DESC LIMIT 1000').all()).results||[];
  for(const [kind,table] of Object.entries(tables)){
    const records=(await database.prepare(`SELECT ${kind==='photos'?'id,user_id,slug,caption,bytes,status,created_at':'*'} FROM ${table} c WHERE c.status='pending' OR (c.status='approved' AND EXISTS(SELECT 1 FROM member_reports r WHERE r.kind=? AND r.target_id=c.id)) ORDER BY c.created_at ASC LIMIT 20`).bind(kind).all()).results||[];
    for(const row of records){
      const reports=reportRows.filter(r=>r.kind===kind&&r.target_id===row.id).slice(0,10);
      items.push({kind,id:row.id,version:await contributionVersion(kind,row),expectedStatus:row.status,place:placeMap.get(row.slug)||{slug:row.slug,name:row.slug},createdAt:row.created_at,reports:reports.map(r=>r.reason),...(kind==='reviews'?{rating:row.rating,body:row.body}:{caption:row.caption,image_path:`/api/member/automation-photo/${row.id}`})});
    }
  }
  const totals=await database.prepare("SELECT (SELECT COUNT(*) FROM member_reviews WHERE status='pending') AS reviews,(SELECT COUNT(*) FROM member_photos WHERE status='pending') AS photos,(SELECT COUNT(*) FROM member_reports) AS reports").first();
  return {schema:'tassienow-member-moderation-v1',exportedAt:new Date().toISOString(),totals,items};
}
export async function applyDecision(database,body,reviewer,{manual=false}={}){
  const {kind,id}=body,table=tables[kind];if(!table)fail('Invalid contribution.');
  if(!['approved','rejected','pending'].includes(body.status))fail('Invalid moderation decision.');
  const row=await database.prepare(`SELECT * FROM ${table} WHERE id=?`).bind(String(id)).first();
  if(!row)return {id,kind,status:'missing'};
  const version=await contributionVersion(kind,row);
  if(!manual&&(body.version!==version||body.expectedStatus!==row.status||!['pending','approved'].includes(row.status)))return {id,kind,status:'stale'};
  const reason=text(body.reason,1000);
  if(body.status==='rejected'&&reason.length<10)fail('Explain why this contribution was rejected (at least 10 characters).');
  const decisionId=await digest(`${kind}:${id}:${version}:${body.status}`),now=Date.now();
  const condition=kind==='reviews'?'created_at=? AND rating=? AND body=?':'created_at=? AND caption=? AND bytes=?';
  const snapshot=kind==='reviews'?[row.created_at,row.rating,row.body]:[row.created_at,row.caption,row.bytes];
  const title=body.status==='rejected'?`Your ${kind==='reviews'?'review':'photo'} was not approved`:body.status==='approved'?`Your ${kind==='reviews'?'review':'photo'} is approved`:'Your contribution is awaiting review';
  const message=body.status==='rejected'?reason:body.status==='approved'?'Thanks for sharing your visit. Your contribution is now visible on the place page.':'Your contribution has been returned for further review.';
  const statements=[
    database.prepare(`INSERT INTO member_moderation(id,kind,target_id,user_id,version,status,reason,reviewer,decided_at) SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM ${table} WHERE id=? AND status=? AND ${condition}) ON CONFLICT(id) DO UPDATE SET reason=excluded.reason,reviewer=excluded.reviewer,decided_at=excluded.decided_at`).bind(decisionId,kind,row.id,row.user_id,version,body.status,reason,reviewer,now,row.id,row.status,...snapshot),
    database.prepare(`UPDATE ${table} SET status=? WHERE id=? AND status=? AND ${condition}`).bind(body.status,row.id,row.status,...snapshot),
    database.prepare('INSERT INTO member_messages(id,user_id,kind,target_id,place_slug,title,body,created_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM member_moderation WHERE id=?) ON CONFLICT(id) DO UPDATE SET body=excluded.body').bind(decisionId,row.user_id,kind,row.id,row.slug,title,message,now,decisionId)
  ];
  if(body.status!=='pending')statements.push(database.prepare('DELETE FROM member_reports WHERE kind=? AND target_id=? AND EXISTS(SELECT 1 FROM member_moderation WHERE id=?)').bind(kind,row.id,decisionId));
  const results=await database.batch(statements);
  return {id,kind,status:results[1].meta?.changes?body.status:'stale'};
}
export async function automationRequest(context,database){
  if(context.request.method!=='POST')fail('Method not allowed.',405);
  const identity=await workflowIdentity(context.request),body=await jsonBody(context.request);
  if(body.action==='export')return reply(await moderationQueue(database));
  if(body.action!=='apply'||!Array.isArray(body.decisions)||body.decisions.length>5)fail('Invalid moderation batch.');
  const results=[];
  for(const decision of body.decisions){
    if(decision.status==='hold'){results.push({kind:decision.kind,id:decision.id,status:'held'});continue;}
    if(!['approved','rejected'].includes(decision.status))fail('Invalid scheduled decision.');
    results.push(await applyDecision(database,decision,`scheduled:${identity.runId}`));
  }
  return reply({ok:true,runId:identity.runId,results});
}
export function csvCell(value){let result=String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim();if(/^[=+\-@]/.test(result))result="'"+result;return '"'+result.replace(/"/g,'""')+'"';}
export async function memberCSV(context,database){
  if(!await isAdmin(context.request,context.env))fail('Owner login required.',401);
  const records=(await database.prepare('SELECT name,email,created_at FROM members ORDER BY created_at,email').all()).results||[];
  const csv='\uFEFFname,email,joined_at\r\n'+records.map(r=>[r.name,r.email,new Date(r.created_at).toISOString()].map(csvCell).join(',')).join('\r\n')+'\r\n';
  return new Response(csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="tassienow-members.csv"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'}});
}

export async function automationPhoto(context,database){
 if(context.request.method!=='GET')fail('Method not allowed.',405);
 await workflowIdentity(context.request);
 const id=new URL(context.request.url).pathname.split('/').filter(Boolean).at(-1);
 const row=await database.prepare("SELECT image FROM member_photos p WHERE id=? AND (status='pending' OR (status='approved' AND EXISTS(SELECT 1 FROM member_reports r WHERE r.kind='photos' AND r.target_id=p.id)))").bind(id).first();
 if(!row)fail('Photo is no longer awaiting review.',404);
 return new Response(row.image,{headers:{'Content-Type':'image/jpeg','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
