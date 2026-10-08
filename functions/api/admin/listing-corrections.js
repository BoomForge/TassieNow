import { requireAdmin, sameOrigin } from '../../_lib/auth.js';
import { db } from '../../_lib/db.js';

const headers={'Cache-Control':'private, no-store'};
const STATUSES=new Set(['pending','approved','rejected']);
export async function onRequestGet(context) {
  const blocked=await requireAdmin(context);if(blocked)return blocked;
  try {
    const status=new URL(context.request.url).searchParams.get('status')||'pending';
    if(!STATUSES.has(status))return Response.json({error:'Invalid queue status'},{status:400,headers});
    const database=await db(context.env);
    const {results=[]}=await database.prepare(
      'SELECT id,place_slug,place_name,requester_name,requester_email,relationship,field,suggested_value,reason,source_url,status,submitted_at,reviewed_at FROM listing_corrections WHERE status=? ORDER BY submitted_at DESC LIMIT 100'
    ).bind(status).all();
    return Response.json({corrections:results,status},{headers});
  }catch{
    return Response.json({error:'Correction review queue is temporarily unavailable.'},{status:503,headers});
  }
}
export async function onRequestPatch(context) {
  const blocked=await requireAdmin(context);if(blocked)return blocked;
  if(!sameOrigin(context.request))return Response.json({error:'Invalid request origin'},{status:403,headers});
  try{
    const body=await context.request.json();
    const id=Number(body.id),status=String(body.status||'');
    if(!Number.isSafeInteger(id)||id<1||!['approved','rejected'].includes(status))
      return Response.json({error:'Invalid review action'},{status:400,headers});
    const database=await db(context.env);
    const record=await database.prepare('SELECT id,status FROM listing_corrections WHERE id=?').bind(id).first();
    if(!record)return Response.json({error:'Correction not found'},{status:404,headers});
    if(record.status!=='pending')return Response.json({error:'This correction was already reviewed'},{status:409,headers});
    await database.prepare('UPDATE listing_corrections SET status=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND status=?').bind(status,id,'pending').run();
    // Approval means reviewed and accepted as a suggestion, NOT published.
    // Any catalogue edit still uses the existing authenticated owner editor.
    return Response.json({ok:true,status,published:false,message:'Review saved. No listing was changed automatically.'},{headers});
  }catch{
    return Response.json({error:'Could not save correction review.'},{status:503,headers});
  }
}
