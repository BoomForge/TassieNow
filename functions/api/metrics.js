const TYPES=new Set(['view','search','filter','outbound']);
const DETAILS=new Set(['','official','booking','directions','reviews','category','region','food-type','text','sponsor']);
const PATH=/^\/(?:|(?:place|event|town|region|discover)\/[a-z0-9-]+\/?|food\/?|guides(?:\/[a-z0-9-]+)?\/?|about\/?)$/;

export async function onRequestPost(context){
  try{
    const request=context.request;
    const origin=request.headers.get('origin');
    if(origin&&origin!==new URL(request.url).origin)return new Response(null,{status:403});
    const fetchSite=request.headers.get('sec-fetch-site');
    if(fetchSite&&!['same-origin','none'].includes(fetchSite))return new Response(null,{status:403});
    if(Number(request.headers.get('content-length')||0)>1000)return new Response(null,{status:413});
    const raw=await request.text();
    if(raw.length>1000)return new Response(null,{status:413});
    const body=JSON.parse(raw);
    const eventType=String(body.type||'');
    const path=String(body.path||'');
    const detail=String(body.detail||'');
    if(!TYPES.has(eventType)||!PATH.test(path)||!DETAILS.has(detail))return new Response(null,{status:400});
    const day=new Date().toISOString().slice(0,10);
    const database=context.env.DB;
    if(!database)return new Response(null,{status:503});
    const query="INSERT INTO discovery_metrics (day,event_type,page_path,detail,hits) VALUES (?,?,?,?,1) ON CONFLICT(day,event_type,page_path,detail) DO UPDATE SET hits=hits+1";
    try{await database.prepare(query).bind(day,eventType,path,detail).run();}
    catch(error){
      if(!/no such table/i.test(String(error)))throw error;
      await database.prepare("CREATE TABLE IF NOT EXISTS discovery_metrics (day TEXT NOT NULL,event_type TEXT NOT NULL,page_path TEXT NOT NULL,detail TEXT NOT NULL DEFAULT '',hits INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(day,event_type,page_path,detail))").run();
      await database.prepare(query).bind(day,eventType,path,detail).run();
    }
    return new Response(null,{status:204,headers:{'Cache-Control':'no-store'}});
  }catch{
    return new Response(null,{status:503,headers:{'Cache-Control':'no-store'}});
  }
}
