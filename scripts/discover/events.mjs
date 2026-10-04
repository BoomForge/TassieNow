import fs from 'node:fs/promises';

const FILE=new URL('../../src/data/events.json',import.meta.url);
const UA='TassieNow/0.8 (+https://tassienow.pages.dev)';
const SOURCES=[
  {name:'City of Hobart',url:'https://www.hobartcity.com.au/Things-To-Do/Upcoming-events',town:'Hobart',region:'Hobart & South',detail:/\/Things-To-Do\/Upcoming-events\//i},
  {name:'City of Launceston',url:'https://www.launceston.tas.gov.au/Upcoming-Events',town:'Launceston',region:'Launceston & North',detail:/\/Upcoming-Events\//i},
  {name:'Burnie City Council',url:'https://www.burnie.tas.gov.au/Community/Whats-On-Events',town:'Burnie',region:'North West',detail:/\/Whats-On|\/Events\//i},
  {name:'Glenorchy City Council',url:'https://www.gcc.tas.gov.au/our-city/events/',town:'Glenorchy',region:'Hobart & South',detail:/\/events\//i},
  {name:'Devonport City Council',url:'https://www.devonport.tas.gov.au/whats-on-devonport/',town:'Devonport',region:'North West',detail:/\/events\//i},
  {name:'City of Clarence',url:'https://www.ccc.tas.gov.au/explore/events/',town:'Rosny Park',region:'Hobart & South',detail:/\/event\//i}
];
const M={jan:1,january:1,feb:2,february:2,mar:3,march:3,apr:4,april:4,may:5,jun:6,june:6,jul:7,july:7,aug:8,august:8,september:9,sep:9,sept:9,oct:10,october:10,nov:11,november:11,dec:12,december:12};
const MONTH='Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?';
function tasDate(date=new Date()){const p=new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Hobart',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);const g=t=>p.find(x=>x.type===t)?.value;return`${g('year')}-${g('month')}-${g('day')}`}
const TODAY=tasDate();
const h=new Date(`${TODAY}T00:00:00Z`);h.setUTCDate(h.getUTCDate()+240);const HORIZON=h.toISOString().slice(0,10);
const slug=v=>String(v).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,90);
const dec=v=>String(v||'').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;|&#x27;/gi,"'").replace(/&ndash;|&#8211;/gi,'–').replace(/&mdash;|&#8212;/gi,'—');
const clean=v=>dec(String(v||'').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
const norm=v=>clean(v).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function fallback(name){return{url:'/images/categories/events.svg',alt:`${name} event category image`,attribution:'TassieNow',license:'Site artwork',licenseUrl:null,sourceUrl:null,isFallback:true}}
async function fetchHtml(url){const r=await fetch(url,{headers:{'user-agent':UA,accept:'text/html,*/*;q=.8'},signal:AbortSignal.timeout(45000)});if(!r.ok)throw new Error(`${r.status} ${r.statusText}`);return r.text()}
function flatten(v,o=[]){if(!v)return o;if(Array.isArray(v)){v.forEach(x=>flatten(x,o));return o}if(typeof v!=='object')return o;const t=v['@type'];if((Array.isArray(t)?t:[t]).includes('Event'))o.push(v);for(const x of Object.values(v))if(typeof x==='object')flatten(x,o);return o}
function jsonld(html){const o=[];for(const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{flatten(JSON.parse(m[1].trim()),o)}catch{}}return o}
function iso(day,mon,year){const n=M[String(mon).toLowerCase()];if(!n)return null;return`${year}-${String(n).padStart(2,'0')}-${String(day).padStart(2,'0')}`}
function dateValue(v){if(!v)return null;const d=new Date(v);return Number.isNaN(d.valueOf())?null:d.toISOString().slice(0,10)}
function dateRange(text=''){
  const v=clean(text);let m;
  m=v.match(new RegExp(`\\b(\\d{1,2})\\s+(${MONTH})\\s*[-–—]\\s*(\\d{1,2})\\s+(${MONTH})\\s+(20\\d{2})\\b`,'i'));
  if(m)return{startDate:iso(m[1],m[2],m[5]),endDate:iso(m[3],m[4],m[5]),raw:m[0]};
  m=v.match(new RegExp(`\\b(\\d{1,2})\\s*[-–—]\\s*(\\d{1,2})\\s+(${MONTH})\\s+(20\\d{2})\\b`,'i'));
  if(m)return{startDate:iso(m[1],m[3],m[4]),endDate:iso(m[2],m[3],m[4]),raw:m[0]};
  m=v.match(new RegExp(`\\b(\\d{1,2})\\s+(${MONTH})\\s+(20\\d{2})\\b`,'i'));
  if(m){const d=iso(m[1],m[2],m[3]);return{startDate:d,endDate:d,raw:m[0]}}
  m=v.match(new RegExp(`\\b(${MONTH})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,)?\\s+(20\\d{2})\\b`,'i'));
  if(m){const d=iso(m[2],m[1],m[3]);return{startDate:d,endDate:d,raw:m[0]}}
  return null;
}
function validRange(r){return r?.startDate&&r?.endDate&&r.endDate>=TODAY&&r.startDate<=HORIZON}
function categories(text=''){const c=['Events'];if(/\bfree\b/i.test(text))c.push('Free');if(/family|kids|children|child|school holiday/i.test(text))c.push('Family');if(/market/i.test(text))c.push('Markets');return[...new Set(c)]}
function plausibleName(v=''){const n=clean(v).replace(/^(view detail|read more|details|more information)$/i,'');return n.length>=3&&n.length<=160&&!/^(home|events?|calendar|search|next|previous|today)$/i.test(n)}
function lines(html){return dec(String(html).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<(?:br\s*\/?|\/p|\/div|\/li|\/article|\/a|\/h[1-6]|\/section|\/time)>/gi,'\n').replace(/<[^>]+>/g,' ')).split(/\n+/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean)}
function anchorEvents(html,s){const out=[],anchors=[...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];for(const a of anchors){let href;try{href=new URL(dec(a[1]),s.url).href}catch{continue}if(new URL(href).hostname!==new URL(s.url).hostname)continue;const name=clean(a[2]);if(!plausibleName(name)||!s.detail.test(new URL(href).pathname))continue;const before=html.slice(Math.max(0,a.index-500),a.index),after=html.slice(a.index+a[0].length,a.index+a[0].length+700);const r=dateRange(`${clean(before).slice(-300)} ${name} ${clean(after).slice(0,420)}`);if(!validRange(r))continue;const context=`${name} ${clean(after).slice(0,260)}`;out.push({slug:slug(`${name}-${r.startDate}-${s.town}`),name,town:s.town,region:s.region,startDate:r.startDate,endDate:r.endDate,categories:categories(context),summary:`${name} in ${s.town}. Check the official ${s.name} listing for current time, venue and booking details.`,eventUrl:href,sourceUrl:s.url,sourceName:s.name,image:fallback(name),status:'active',lastChecked:TODAY});}return out}
function textEvents(html,s){const l=lines(html),out=[];for(let i=0;i<l.length;i++){const r=dateRange(l[i]);if(!validRange(r))continue;let name=clean(l[i].replace(r.raw,'').replace(/^[\s|·:–—-]+|[\s|·:–—-]+$/g,''));if(!plausibleName(name)){const options=[l[i-1],l[i+1],l[i-2],l[i+2]].filter(plausibleName);name=clean(options[0]||'')}if(!plausibleName(name))continue;if(name.length>100&&/[.!?]\s/.test(name))name=name.split(/[.!?]\s/)[0].trim();if(!plausibleName(name))continue;const context=`${name} ${l[i+1]||''}`;out.push({slug:slug(`${name}-${r.startDate}-${s.town}`),name,town:s.town,region:s.region,startDate:r.startDate,endDate:r.endDate,categories:categories(context),summary:`${name} in ${s.town}. Check the official ${s.name} listing for current time, venue and booking details.`,eventUrl:s.url,sourceUrl:s.url,sourceName:s.name,image:fallback(name),status:'active',lastChecked:TODAY});}return out}
function structuredEvents(html,s){const out=[];for(const e of jsonld(html)){const startDate=dateValue(e.startDate),endDate=dateValue(e.endDate||e.startDate);if(!validRange({startDate,endDate}))continue;const name=clean(e.name);if(!plausibleName(name))continue;const address=e.location?.address||{},town=clean(address.addressLocality||e.location?.name||s.town),description=clean(e.description).slice(0,280),context=`${name} ${description}`;out.push({slug:slug(`${name}-${startDate}-${town}`),name,town:town||s.town,region:s.region,startDate,endDate,categories:categories(context),summary:description||`Event in ${town||s.town}. Check the official event source for current details.`,eventUrl:e.url||s.url,sourceUrl:s.url,sourceName:s.name,image:fallback(name),status:'active',lastChecked:TODAY});}return out}
function dedupe(items){const seen=new Map();for(const e of items){const key=`${norm(e.name)}|${e.startDate}|${norm(e.town)}`;const current=seen.get(key);if(!current||((e.eventUrl||'')!==(e.sourceUrl||'')&&(current.eventUrl||'')===(current.sourceUrl||'')))seen.set(key,e)}return[...seen.values()]}

const previous=JSON.parse(await fs.readFile(FILE,'utf8')).filter(e=>e.status==='active'&&e.endDate>=TODAY);
const found=[],freshSources=new Set();
for(const s of SOURCES){try{const html=await fetchHtml(s.url);const structured=structuredEvents(html,s),anchors=anchorEvents(html,s),text=textEvents(html,s);const events=dedupe([...structured,...anchors,...text]);if(events.length){freshSources.add(s.name);found.push(...events)}console.log(`${s.name}: ${events.length} event(s) (${structured.length} structured, ${anchors.length} linked, ${text.length} text).`)}catch(e){console.warn(`${s.name}: ${e.message}`)}}
for(const old of previous)if(!freshSources.has(old.sourceName))found.push(old);
const unique=dedupe(found).sort((a,b)=>a.startDate.localeCompare(b.startDate)||a.name.localeCompare(b.name));
if(unique.length<10&&previous.length>=10)throw new Error(`Event discovery produced only ${unique.length} future events from six official sources; refusing to replace ${previous.length} healthy records.`);
await fs.writeFile(FILE,`${JSON.stringify(unique,null,2)}\n`);
console.log(`Events: ${unique.length} active across ${new Set(unique.map(e=>e.sourceName)).size} source(s).`);
