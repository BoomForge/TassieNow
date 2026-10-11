import { requireAdmin, sameOrigin } from '../../_lib/auth.js';
import { readPhotoResearch, writePhotoResearch } from '../../_lib/github.js';

const headers = { 'Cache-Control': 'private, no-store' };
const allowed = new Set(['needs-verification', 'rejected', 'source-verified']);

export async function onRequestGet(context) {
  const blocked=await requireAdmin(context);
  if(blocked)return blocked;
  try {
    const {queue}=await readPhotoResearch(context);
    return Response.json({queue},{headers});
  } catch {
    return Response.json({error:'Photo research queue unavailable.'},{status:503,headers});
  }
}

export async function onRequestPatch(context) {
  const blocked=await requireAdmin(context);
  if(blocked)return blocked;
  if(!sameOrigin(context.request))
    return Response.json({error:'Invalid request origin'},{status:403,headers});
  try {
    const body=await context.request.json();
    const slug=String(body.slug||'');
    const id=String(body.id||'');
    const status=String(body.status||'');
    if(!/^[a-z0-9-]{2,120}$/.test(slug)||!id||id.length>200||!allowed.has(status))
      return Response.json({error:'Invalid review selection'},{status:400,headers});
    const note=String(body.note||'').trim().slice(0,500);
    if(status==='source-verified'&&
       (note.length<40||body.identityVerified!==true||body.rightsVerified!==true))
      return Response.json({error:'Verification requires a detailed source/rights note and confirmation of both identity and licence'},{status:400,headers});
    const {sha,queue}=await readPhotoResearch(context);
    const candidate=queue[slug]?.candidates?.find(item=>item.id===id);
    if(!candidate)return Response.json({error:'Research lead no longer exists'},{status:404,headers});
    candidate.review={
      status,note,checkedAt:new Date().toISOString(),
      identityConfirmed: status==='source-verified',
      rightsConfirmed: status==='source-verified',
      // Publishing is deliberately separate from research approval.
      published:false
    };
    await writePhotoResearch(context,queue,sha);
    return Response.json({ok:true,published:false,status},{headers});
  } catch (error) {
    return Response.json({error:String(error.message||'Review could not be saved').slice(0,180)},
      {status:/conflict|sha does not match|409/i.test(String(error.message))?409:503,headers});
  }
}
