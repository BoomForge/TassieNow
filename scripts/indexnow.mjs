import fs from 'node:fs/promises';

const places=JSON.parse(await fs.readFile(new URL('../src/data/places.json',import.meta.url),'utf8'));
const events=JSON.parse(await fs.readFile(new URL('../src/data/events.json',import.meta.url),'utf8'));
const BASE=(process.env.SITE_URL||'https://tassienow.pages.dev').replace(/\/$/,'');
const KEY='30516139ed96092d5fbd7676d4852aa2';
const KEY_LOCATION=`${BASE}/${KEY}.txt`;
const HOST=new URL(BASE).host;
const slugify=(v)=>String(v).toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
function tasDate(date=new Date()){const p=new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Hobart',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);const g=t=>p.find(x=>x.type===t)?.value;return`${g('year')}-${g('month')}-${g('day')}`}
const today=tasDate();const cutoffDate=new Date(`${today}T00:00:00Z`);cutoffDate.setUTCDate(cutoffDate.getUTCDate()-2);const cutoff=cutoffDate.toISOString().slice(0,10);
const changed=(value)=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')&&value>=cutoff;
const urls=new Set([`${BASE}/`,`${BASE}/sitemap.xml`]);
for(const mode of ['kids','free','rainy-day','today','this-weekend','markets','nature','food'])urls.add(`${BASE}/discover/${mode}/`);
for(const p of places){if(p.status!=='active'||p.visibility==='suppressed'||!changed(p.lastChecked))continue;urls.add(`${BASE}/place/${p.slug}/`);urls.add(`${BASE}/town/${slugify(p.town)}/`);urls.add(`${BASE}/region/${slugify(p.region)}/`);}
for(const e of events){if(e.status!=='active'||!changed(e.lastChecked))continue;urls.add(`${BASE}/event/${e.slug}/`);}
let liveKey='';try{const r=await fetch(KEY_LOCATION,{signal:AbortSignal.timeout(10000)});if(r.ok)liveKey=(await r.text()).trim();}catch{}
if(liveKey!==KEY){console.warn(`IndexNow key is not live yet at ${KEY_LOCATION}; skipping this run.`);process.exit(0);}
const list=[...urls];if(!list.length){console.log('No recently changed URLs to submit.');process.exit(0);}
for(let i=0;i<list.length;i+=1000){const batch=list.slice(i,i+1000);const r=await fetch('https://api.indexnow.org/indexnow',{method:'POST',headers:{'content-type':'application/json; charset=utf-8'},body:JSON.stringify({host:HOST,key:KEY,keyLocation:KEY_LOCATION,urlList:batch}),signal:AbortSignal.timeout(20000)});if(![200,202].includes(r.status)){const text=(await r.text()).slice(0,500);if(r.status===429){console.warn(`IndexNow rate-limited this batch: ${text}`);break;}throw new Error(`IndexNow ${r.status}: ${text}`);}console.log(`IndexNow accepted ${batch.length} changed URL(s).`);}
