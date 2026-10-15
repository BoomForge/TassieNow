import { isAdmin } from '../../_lib/auth.js';
import { placeMap,placeRows } from '../../_lib/member-places.js';
import { MemberError,fail,reply,memberDB,text,randomToken,digest,checkPassword,passwordHash,passwordMatches,recoveryHash,emailAddress,captcha,assertOrigin,boundedBody,jsonBody,limit,currentUser,requireUser,newSession,logout,sessionCookie,cleanJPEG } from '../../_lib/members.js';

const place = slug => {if(!placeMap.has(slug))fail('This place is no longer available.',404);return slug;};
const rows = async statement => (await statement.all()).results || [];
const changes = result => result.meta?.changes || 0;
function planInput(body){
  const title=text(body.title,100);if(!title)fail('Give your plan a name.');
  const day=String(body.day||'');const parsedDay=new Date(day);if(day&&(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(parsedDay.getTime())||parsedDay.toISOString().slice(0,10)!==day))fail('Choose a valid date.');
  if(!Array.isArray(body.stops)||body.stops.length>50)fail('Plans can contain up to 50 stops.');
  const stops=[...new Set(body.stops.map(slug=>place(String(slug))))];
  return [title,day,text(body.notes,2000),JSON.stringify(stops)];
}
function planOutput(p){return {...p,stops:JSON.parse(p.stops).map(slug=>placeMap.get(slug)||{slug,name:'Unavailable place',town:''})};}

export async function onRequest(context){
  try{return await handle(context);}catch(error){
    if(error instanceof MemberError)return reply({error:error.message},error.status);
    console.error('Member API error',error?.message);
    return reply({error:'We could not complete that request. Please try again.'},503);
  }
}
async function handle(context){
  const {request,env}=context,url=new URL(request.url),method=request.method;
  const path=url.pathname.replace(/^\/api\/member\/?/,'').replace(/\/$/,'');
  if(!['GET','POST','PUT','DELETE'].includes(method))return reply({error:'Method not allowed'},405,{Allow:'GET, POST, PUT, DELETE'});
  if(method!=='GET')assertOrigin(request);
  if(path==='catalogue'&&method==='GET')return reply({places:placeRows},200,{'Cache-Control':'public, max-age=300'});
  const database=await memberDB(env);
  if(path==='session'&&method==='GET')return reply({user:await currentUser(request,database)});
  if(['signup','login','recover'].includes(path)&&method==='POST'){
    await limit(context,database,'auth',30,900);
    const body=await jsonBody(request);if(!body||typeof body!=='object')fail('Invalid request.');
    await captcha(context,body);const email=emailAddress(body.email);
    if(path==='signup'){
      await limit(context,database,'signup',5,3600);
      const name=text(body.name,60);if(name.length<2)fail('Use a display name of at least two characters.');
      if(body.terms!==true)fail('Please agree to the terms and privacy notice.');
      const password=await passwordHash(env,checkPassword(body.password)),recoveryCode=randomToken(),id=crypto.randomUUID();
      const result=await database.prepare('INSERT INTO members(id,email,name,password,recovery,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(email) DO NOTHING').bind(id,email,name,password,await recoveryHash(env,recoveryCode),Date.now()).run();
      if(!changes(result))fail('Unable to create this account. Try logging in or using your recovery code.',409);
      return reply({ok:true,recoveryCode,user:{id,email,name}},201,{'Set-Cookie':await newSession(database,id)});
    }
    await limit(context,database,'auth-email',15,900,email);
    const member=await database.prepare('SELECT * FROM members WHERE email=?').bind(email).first();
    if(path==='login'){
      if(!await passwordMatches(env,body.password,member?.password))fail('Email or password is incorrect.',401);
      return reply({ok:true},200,{'Set-Cookie':await newSession(database,member.id)});
    }
    const code=String(body.recoveryCode||'').trim();const hash=await recoveryHash(env,code);
    if(!member||!code||!equalRecovery(hash,member.recovery))fail('Email or recovery code is incorrect.',401);
    const password=await passwordHash(env,checkPassword(body.password)),recoveryCode=randomToken();
    // Compare-and-swap makes each recovery code single-use even across concurrent requests.
    const results=await database.batch([
      database.prepare('UPDATE members SET password=?,recovery=? WHERE id=? AND recovery=?').bind(password,await recoveryHash(env,recoveryCode),member.id,hash),
      database.prepare('DELETE FROM member_sessions WHERE user_id=?').bind(member.id)
    ]);
    if(!changes(results[0]))fail('That recovery code has already been used.',409);
    return reply({ok:true,recoveryCode},200,{'Set-Cookie':await newSession(database,member.id)});
  }
  if(path==='place'&&method==='GET'){
    const slug=place(url.searchParams.get('slug')),user=await currentUser(request,database);
    const [reviews,photos,stats]=await Promise.all([
      rows(database.prepare("SELECT r.id,r.rating,r.body,r.status,r.created_at,m.name FROM member_reviews r JOIN members m ON m.id=r.user_id WHERE r.slug=? AND (r.status='approved' OR r.user_id=?) ORDER BY r.created_at DESC LIMIT 50").bind(slug,user?.id||'')),
      rows(database.prepare("SELECT p.id,p.caption,p.status,p.created_at,m.name FROM member_photos p JOIN members m ON m.id=p.user_id WHERE p.slug=? AND (p.status='approved' OR p.user_id=?) ORDER BY p.created_at DESC LIMIT 30").bind(slug,user?.id||'')),
      database.prepare("SELECT COUNT(*) AS count,ROUND(AVG(rating),1) AS average FROM member_reviews WHERE slug=? AND status='approved'").bind(slug).first()
    ]);
    return reply({reviews,photos,stats});
  }
  if(path.startsWith('photo/')&&method==='GET'){
    const id=path.slice(6);const photo=await database.prepare('SELECT image,status,user_id FROM member_photos WHERE id=?').bind(id).first();
    if(!photo)fail('Photo not found.',404);
    if(photo.status!=='approved'){
      const user=await currentUser(request,database);
      if(photo.user_id!==user?.id&&!await isAdmin(request,env))fail('Photo not found.',404);
    }
    return new Response(photo.image,{headers:{'Content-Type':'image/jpeg','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
  }
  if(path==='moderation')return moderate(context,database,method,url);
  const user=await requireUser(request,database);
  if(method!=='GET')await limit(context,database,'member-write',120,3600,user.id);
  if(path==='logout'&&method==='POST')return logout(request,database);
  if(path==='profile'&&method==='GET'){
    const [saved,plans,reviews,photos]=await Promise.all([
      rows(database.prepare('SELECT slug FROM member_saved WHERE user_id=? ORDER BY created_at DESC').bind(user.id)),
      rows(database.prepare('SELECT * FROM member_plans WHERE user_id=? ORDER BY updated_at DESC').bind(user.id)),
      rows(database.prepare('SELECT id,slug,rating,body,status FROM member_reviews WHERE user_id=? ORDER BY created_at DESC').bind(user.id)),
      rows(database.prepare('SELECT id,slug,caption,status FROM member_photos WHERE user_id=? ORDER BY created_at DESC').bind(user.id))
    ]);
    return reply({user,saved:saved.map(p=>placeMap.get(p.slug)).filter(Boolean),plans:plans.map(planOutput),reviews,photos});
  }
  if(path==='profile'&&(method==='PUT'||method==='DELETE')){
    const body=await jsonBody(request),stored=await database.prepare('SELECT password FROM members WHERE id=?').bind(user.id).first();
    if(!await passwordMatches(env,body.password,stored?.password))fail('Your current password is incorrect.',401);
    if(method==='DELETE'){
      await database.batch(['member_reports','member_photos','member_reviews','member_plans','member_saved','member_sessions'].map(table=>database.prepare(`DELETE FROM ${table} WHERE user_id=?`).bind(user.id)).concat(database.prepare('DELETE FROM members WHERE id=?').bind(user.id)));
      return reply({ok:true},200,{'Set-Cookie':sessionCookie('',true)});
    }
    const name=text(body.name,60);if(name.length<2)fail('Use a display name of at least two characters.');
    if(body.newPassword){
      const hash=await passwordHash(env,checkPassword(body.newPassword));
      await database.batch([database.prepare('UPDATE members SET name=?,password=? WHERE id=?').bind(name,hash,user.id),database.prepare('DELETE FROM member_sessions WHERE user_id=?').bind(user.id)]);
      return reply({ok:true},200,{'Set-Cookie':await newSession(database,user.id)});
    }
    await database.prepare('UPDATE members SET name=? WHERE id=?').bind(name,user.id).run();return reply({ok:true});
  }
  if(path==='saved'&&(method==='POST'||method==='DELETE')){
    const body=await jsonBody(request),slug=place(body.slug);
    if(method==='DELETE')await database.prepare('DELETE FROM member_saved WHERE user_id=? AND slug=?').bind(user.id,slug).run();
    else{
      const result=await database.prepare('INSERT OR IGNORE INTO member_saved(user_id,slug,created_at) SELECT ?,?,? WHERE (SELECT COUNT(*) FROM member_saved WHERE user_id=?)<500').bind(user.id,slug,Date.now(),user.id).run();
      if(!changes(result)&&!await database.prepare('SELECT 1 FROM member_saved WHERE user_id=? AND slug=?').bind(user.id,slug).first())fail('You can save up to 500 places.');
    }return reply({ok:true});
  }
  if(path==='plans'&&method==='POST'){
    const values=planInput(await jsonBody(request)),id=crypto.randomUUID();
    const result=await database.prepare('INSERT INTO member_plans(id,user_id,title,day,notes,stops,updated_at) SELECT ?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM member_plans WHERE user_id=?)<50').bind(id,user.id,...values,Date.now(),user.id).run();
    if(!changes(result))fail('You can create up to 50 plans.');return reply({ok:true,id},201);
  }
  if(path.startsWith('plans/')&&(method==='PUT'||method==='DELETE')){
    const id=path.slice(6);let result;
    if(method==='DELETE')result=await database.prepare('DELETE FROM member_plans WHERE id=? AND user_id=?').bind(id,user.id).run();
    else{const body=await jsonBody(request);result=await database.prepare('UPDATE member_plans SET title=?,day=?,notes=?,stops=?,updated_at=?,version=version+1 WHERE id=? AND user_id=? AND version=?').bind(...planInput(body),Date.now(),id,user.id,Number(body.version)||0).run();}
    if(!changes(result))fail('This plan changed or is unavailable. Reload it before saving.',409);return reply({ok:true});
  }
  if(path==='reviews'&&method==='POST'){
    const body=await jsonBody(request);await captcha(context,body);await limit(context,database,'review',20,86400,user.id);
    const slug=place(body.slug),rating=Number(body.rating),content=text(body.body,2000);if(!Number.isInteger(rating)||rating<1||rating>5||content.length<10)fail('Choose 1–5 stars and write at least 10 characters.');
    await database.prepare("INSERT INTO member_reviews(id,user_id,slug,rating,body,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,slug) DO UPDATE SET rating=excluded.rating,body=excluded.body,status='pending',created_at=excluded.created_at").bind(crypto.randomUUID(),user.id,slug,rating,content,Date.now()).run();
    return reply({ok:true,message:'Thanks! Your review is awaiting moderation.'},201);
  }
  if(path==='photos'&&method==='POST'){
    await limit(context,database,'photo',12,86400,user.id);
    const buffer=await boundedBody(request,340000);
    const form=await new Request(request.url,{method:'POST',headers:{'Content-Type':request.headers.get('content-type')||''},body:buffer}).formData().catch(()=>fail('Invalid photo upload.'));
    await captcha(context,Object.fromEntries(form));const slug=place(form.get('slug')),caption=text(form.get('caption'),200);
    if(form.get('rights')!=='yes')fail('Please confirm you own this photo and have permission to share it.');
    const file=form.get('file');if(!(file instanceof File)||file.type!=='image/jpeg'||file.size>300000||!file.size)fail('Upload a JPEG photo of 300 KB or less.');
    if(caption.length<3)fail('Add a short description of your photo.');
    const image=cleanJPEG(new Uint8Array(await file.arrayBuffer())),id=crypto.randomUUID();
    const result=await database.prepare('INSERT INTO member_photos(id,user_id,slug,caption,image,bytes,created_at) SELECT ?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM member_photos WHERE user_id=?)<30 AND (SELECT COALESCE(SUM(bytes),0) FROM member_photos)+?<=100000000').bind(id,user.id,slug,caption,image.buffer,image.length,Date.now(),user.id,image.length).run();
    if(!changes(result))fail('Photo storage is full. Remove an old photo or try again later.',409);
    return reply({ok:true,id,message:'Your photo is awaiting moderation.'},201);
  }
  if((path.startsWith('reviews/')||path.startsWith('photos/'))&&method==='DELETE'){
    const [kind,id]=path.split('/'),table=kind==='reviews'?'member_reviews':'member_photos';
    if(!changes(await database.prepare(`DELETE FROM ${table} WHERE id=? AND user_id=?`).bind(id,user.id).run()))fail('Contribution not found.',404);
    await database.prepare('DELETE FROM member_reports WHERE kind=? AND target_id=?').bind(kind,id).run();return reply({ok:true});
  }
  if(path==='report'&&method==='POST'){
    const body=await jsonBody(request),kind=body.kind;if(!['reviews','photos'].includes(kind))fail('Invalid contribution.');
    const table=kind==='reviews'?'member_reviews':'member_photos',reason=text(body.reason,500);if(reason.length<5)fail('Please explain the problem.');
    if(!await database.prepare(`SELECT id FROM ${table} WHERE id=? AND status='approved'`).bind(String(body.id)).first())fail('Contribution not found.',404);
    await database.prepare('INSERT INTO member_reports(kind,target_id,user_id,reason,created_at) VALUES(?,?,?,?,?) ON CONFLICT(kind,target_id,user_id) DO UPDATE SET reason=excluded.reason,created_at=excluded.created_at').bind(kind,String(body.id),user.id,reason,Date.now()).run();return reply({ok:true});
  }
  fail('Not found.',404);
}
function equalRecovery(a,b){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
async function moderate(context,database,method,url){
  if(!await isAdmin(context.request,context.env))fail('Owner login required.',401);
  if(method==='GET'){
    const status=['pending','approved','rejected'].includes(url.searchParams.get('status'))?url.searchParams.get('status'):'pending';
    const [reviews,photos,reports]=await Promise.all([
      rows(database.prepare('SELECT r.id,r.slug,r.rating,r.body,r.status,r.created_at,m.name FROM member_reviews r JOIN members m ON m.id=r.user_id WHERE r.status=? ORDER BY r.created_at DESC LIMIT 100').bind(status)),
      rows(database.prepare('SELECT p.id,p.slug,p.caption,p.status,p.created_at,m.name FROM member_photos p JOIN members m ON m.id=p.user_id WHERE p.status=? ORDER BY p.created_at DESC LIMIT 100').bind(status)),
      rows(database.prepare('SELECT kind,target_id,reason,created_at FROM member_reports ORDER BY created_at DESC LIMIT 100'))
    ]);return reply({reviews,photos,reports});
  }
  if(method==='PUT'){
    const body=await jsonBody(context.request),table=body.kind==='reviews'?'member_reviews':body.kind==='photos'?'member_photos':null;
    if(!table||!['approved','rejected','pending'].includes(body.status))fail('Invalid moderation action.');
    if(!changes(await database.prepare(`UPDATE ${table} SET status=? WHERE id=?`).bind(body.status,String(body.id)).run()))fail('Contribution not found.',404);
    await database.prepare('DELETE FROM member_reports WHERE kind=? AND target_id=?').bind(body.kind,String(body.id)).run();return reply({ok:true});
  }
  fail('Method not allowed.',405);
}
