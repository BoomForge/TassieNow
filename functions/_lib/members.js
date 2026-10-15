import { sameOrigin } from './auth.js';
import { verifyTurnstile } from './turnstile.js';

export class MemberError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export const fail = (message, status) => { throw new MemberError(message, status); };
export const reply = (body, status = 200, headers = {}) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });
const encoder = new TextEncoder();
const schema = [
  `CREATE TABLE IF NOT EXISTS members (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, password TEXT NOT NULL, recovery TEXT NOT NULL, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS member_sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS member_session_user ON member_sessions(user_id)`,
  `CREATE TABLE IF NOT EXISTS member_saved (user_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE, slug TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(user_id,slug))`,
  `CREATE TABLE IF NOT EXISTS member_plans (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE, title TEXT NOT NULL, day TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', stops TEXT NOT NULL DEFAULT '[]', version INTEGER NOT NULL DEFAULT 1, updated_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS member_plan_user ON member_plans(user_id,updated_at)`,
  `CREATE TABLE IF NOT EXISTS member_reviews (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE, slug TEXT NOT NULL, rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')), created_at INTEGER NOT NULL, UNIQUE(user_id,slug))`,
  `CREATE INDEX IF NOT EXISTS member_review_place ON member_reviews(slug,status,created_at)`,
  `CREATE TABLE IF NOT EXISTS member_photos (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE, slug TEXT NOT NULL, caption TEXT NOT NULL, image BLOB NOT NULL, bytes INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')), created_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS member_photo_place ON member_photos(slug,status,created_at)`,
  `CREATE INDEX IF NOT EXISTS member_photo_user ON member_photos(user_id)`,
  `CREATE TABLE IF NOT EXISTS member_reports (kind TEXT NOT NULL, target_id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE, reason TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(kind,target_id,user_id))`,
  `CREATE TABLE IF NOT EXISTS member_limits (key TEXT PRIMARY KEY, hits INTEGER NOT NULL, expires_at INTEGER NOT NULL)`
];
const initialized = new WeakMap();
export async function memberDB(env) {
  if (!env.DB || !env.SESSION_SECRET) fail('Accounts are temporarily unavailable. Please try again later.', 503);
  if (!initialized.has(env.DB)) {
    const promise = env.DB.batch(schema.map(sql => env.DB.prepare(sql))).catch(error => { initialized.delete(env.DB); throw error; });
    initialized.set(env.DB, promise);
  }
  await initialized.get(env.DB);
  return env.DB;
}
export function text(value, max = 1000) { return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0,max); }
export function randomToken() { return Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2,'0')).join(''); }
export async function digest(value) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))), n=>n.toString(16).padStart(2,'0')).join(''); }
async function pepper(env, value) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(env.SESSION_SECRET), {name:'HMAC',hash:'SHA-256'},false,['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(value)));
}
export function checkPassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) fail('Use a password between 12 and 128 characters.');
  return password;
}
export async function passwordHash(env, password, salt = randomToken().slice(0,32)) {
  // Native Workers PBKDF2 supports up to 100,000 iterations; HMAC pepper is kept outside D1.
  const material = await crypto.subtle.importKey('raw',await pepper(env,password),'PBKDF2',false,['deriveBits']);
  const hash = await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:encoder.encode(salt),iterations:100000},material,256);
  return `v1$${salt}$${Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('')}`;
}
export function equal(a,b) { if (typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false; let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0; }
export async function passwordMatches(env, password, stored) {
  if (typeof password !== 'string' || password.length > 128) return false;
  const salt = stored?.split('$')[1] || '00000000000000000000000000000000';
  return equal(await passwordHash(env,password,salt),stored || '');
}
export async function recoveryHash(env, value) { return digest(Array.from(await pepper(env,`recovery:${value}`)).join(',')); }
export function emailAddress(value) { const email=String(value||'').trim().toLowerCase(); if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail('Enter a valid email address.');return email; }
export async function captcha(context, body) {
  const result = await verifyTurnstile(context,body.turnstileToken || body['cf-turnstile-response'],{required:true});
  if(!result.ok)fail(result.error,400);
}
export function assertOrigin(request) { if(!sameOrigin(request))fail('Refresh this page and try again.',403); }
export async function boundedBody(request, max = 32768) {
  if(Number(request.headers.get('content-length'))>max)fail('This upload or request is too large.',413);
  const reader=request.body?.getReader();if(!reader)return new Uint8Array();
  let size=0;const chunks=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();fail('This upload or request is too large.',413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let at=0;for(const part of chunks){bytes.set(part,at);at+=part.length;}return bytes;
}
export async function jsonBody(request) { try{return JSON.parse(new TextDecoder().decode(await boundedBody(request)));}catch(error){if(error instanceof MemberError)throw error;fail('Invalid request.');} }
export async function limit(context, database, scope, max, seconds, identity) {
  const window=Math.floor(Date.now()/1000/seconds);const key=await digest(`${scope}:${identity || context.request.headers.get('CF-Connecting-IP') || 'unknown'}:${window}:${context.env.SESSION_SECRET}`);
  const row=await database.prepare('INSERT INTO member_limits(key,hits,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET hits=hits+1 RETURNING hits').bind(key,(window+1)*seconds).first();
  if(row.hits>max)fail('Too many attempts. Please wait before trying again.',429);
  context.waitUntil?.(database.batch([
    database.prepare('DELETE FROM member_limits WHERE key IN (SELECT key FROM member_limits WHERE expires_at < ? LIMIT 100)').bind(Math.floor(Date.now()/1000)),
    database.prepare('DELETE FROM member_sessions WHERE token IN (SELECT token FROM member_sessions WHERE expires_at < ? LIMIT 100)').bind(Date.now())
  ]));
}
const cookieName='__Host-tn_member';
export function sessionCookie(token, clear=false) { return `${cookieName}=${clear?'':token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${clear?0:2592000}`; }
export async function currentUser(request, database) {
  const token=(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(`${cookieName}=`))?.slice(cookieName.length+1);
  if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
  return database.prepare('SELECT m.id,m.email,m.name,m.created_at FROM members m JOIN member_sessions s ON m.id=s.user_id WHERE s.token=? AND s.expires_at>?').bind(await digest(token),Date.now()).first();
}
export async function requireUser(request, database) { const user=await currentUser(request,database);if(!user)fail('Please log in to continue.',401);return user; }
export async function newSession(database, userId) {
  const token=randomToken();
  await database.batch([
    database.prepare('DELETE FROM member_sessions WHERE user_id=? AND token NOT IN (SELECT token FROM member_sessions WHERE user_id=? ORDER BY expires_at DESC LIMIT 9)').bind(userId,userId),
    database.prepare('INSERT INTO member_sessions(token,user_id,expires_at) VALUES(?,?,?)').bind(await digest(token),userId,Date.now()+2592000000)
  ]);
  return sessionCookie(token);
}
export async function logout(request,database) {
  const token=(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(`${cookieName}=`))?.slice(cookieName.length+1);
  if(token)await database.prepare('DELETE FROM member_sessions WHERE token=?').bind(await digest(token)).run();
  return reply({ok:true},200,{'Set-Cookie':sessionCookie('',true)});
}

// Keep only JPEG image segments. Drop EXIF/GPS, comments and other application metadata.
export function cleanJPEG(bytes) {
  if(bytes.length<20||bytes[0]!==255||bytes[1]!==216)fail('Choose a valid JPEG photograph.');
  const parts=[bytes.slice(0,2)];let at=2,dimensions=false,scans=0,ended=false;
  while(at<bytes.length){
    const start=at;if(bytes[at++]!==255)fail('Invalid JPEG photograph.');
    while(bytes[at]===255)at++;const marker=bytes[at++];
    if(marker===217){parts.push(new Uint8Array([255,217]));ended=true;break;}
    if(marker===216||marker===0||marker===1||(marker>=208&&marker<=215))fail('Invalid JPEG photograph.');
    const length=(bytes[at]<<8)|bytes[at+1];if(length<2||at+length>bytes.length)fail('Invalid JPEG photograph.');
    if([192,193,194].includes(marker)){
      const height=(bytes[at+3]<<8)|bytes[at+4],width=(bytes[at+5]<<8)|bytes[at+6];
      if(!width||!height||width>4096||height>4096)fail('Photos must be no larger than 4096 pixels per side.');dimensions=true;
    }
    const end=at+length;
    if(!(marker>=224&&marker<=239)&&marker!==254)parts.push(bytes.slice(start,end));
    at=end;
    if(marker===218){
      scans++;const scanStart=at;
      while(at<bytes.length){if(bytes[at]!==255){at++;continue;}const next=bytes[at+1];if(next===0||(next>=208&&next<=215)){at+=2;continue;}break;}
      parts.push(bytes.slice(scanStart,at));
    }
  }
  if(!dimensions||!scans||!ended)fail('Invalid JPEG photograph.');
  const output=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let offset=0;for(const part of parts){output.set(part,offset);offset+=part.length;}return output;
}
