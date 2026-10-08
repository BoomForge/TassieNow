import { db, cleanText, httpsUrl } from '../_lib/db.js';
import { verifyTurnstile } from '../_lib/turnstile.js';

const FIELDS=new Set(['opening-hours','website','phone','email','address','location','description','image','closure','other']);
const RELATIONSHIPS=new Set(['owner','employee','visitor','organiser']);
const emailValid=value=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export async function onRequestPost(context) {
  const request=context.request;
  const origin=request.headers.get('origin');
  if(origin && origin!==new URL(request.url).origin) return Response.json({error:'Invalid request origin'},{status:403});
  if(Number(request.headers.get('content-length')||0)>12000) return Response.json({error:'Request too large'},{status:413});
  try{
    const body=await request.json();
    if(body.company_url) return Response.json({ok:true});
    const verification=await verifyTurnstile(context,body['cf-turnstile-response']||body.turnstileToken);
    if(!verification.ok) return Response.json({error:verification.error},{status:400});
    const slug=cleanText(body.place_slug,100);
    const placeName=cleanText(body.place_name,180);
    const name=cleanText(body.requester_name,100);
    const email=cleanText(body.requester_email,180).toLowerCase();
    const relationship=cleanText(body.relationship,20)||'visitor';
    const field=cleanText(body.field,30);
    const value=cleanText(body.suggested_value,1500);
    const reason=cleanText(body.reason,1000)||null;
    const source=body.source_url?httpsUrl(body.source_url,{optional:true}):null;
    if(!/^[a-z0-9-]{2,100}$/.test(slug)||!placeName||!name||!emailValid(email)||!RELATIONSHIPS.has(relationship)||!FIELDS.has(field)||value.length<3){
      return Response.json({error:'Please check the required listing, contact and correction fields.'},{status:400});
    }
    const database=await db(context.env);
    const existing=await database.prepare("SELECT COUNT(*) AS count FROM listing_corrections WHERE requester_email = ? AND submitted_at >= datetime('now', '-1 day')").bind(email).first();
    if(Number(existing?.count||0)>=5) return Response.json({error:'Submission limit reached; please try again tomorrow.'},{status:429});
    await database.prepare('INSERT INTO listing_corrections (place_slug,place_name,requester_name,requester_email,relationship,field,suggested_value,reason,source_url) VALUES (?,?,?,?,?,?,?,?,?)')
      .bind(slug,placeName,name,email,relationship,field,value,reason,source).run();
    return Response.json({ok:true,message:'Your suggested update is queued for review. Nothing has been changed automatically.'},{status:201});
  }catch(error){
    const unavailable=String(error?.message||'').includes('not configured');
    return Response.json({error:unavailable?'Correction submissions are temporarily unavailable.':'Could not submit the correction. Check the information and try again.'},{status:unavailable?503:400});
  }
}
