import fs from 'node:fs/promises';

const FILE = new URL('../../src/data/places.json', import.meta.url);
const USER_AGENT = 'TassieNow/0.7 (+https://tassienow.pages.dev)';
const TARGET = 420;
const FULL = '-43.75,143.55,-39.15,148.65';
const BOXES = [
  ['south-east', '-43.75,146.0,-42.0,148.65'],
  ['north-east', '-42.0,146.0,-39.15,148.65'],
  ['south-west', '-43.75,143.55,-42.0,146.0'],
  ['north-west', '-42.0,143.55,-39.15,146.0']
];
const ENDPOINTS = [
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter'
];
const TYPES = {
  attraction:['Things to Do'], museum:['Museums','Art & Culture','Rainy Day'], gallery:['Art & Culture','Rainy Day'], zoo:['Wildlife','Family'], aquarium:['Wildlife','Family','Rainy Day'], theme_park:['Family'], viewpoint:['Nature & Walks','Outdoor'], marketplace:['Markets','Food & Drink'], farm:['Local Produce','Food & Drink'], nature_reserve:['Nature & Walks','Outdoor'], playground:['Family','Outdoor'], beach:['Nature & Walks','Outdoor'], winery:['Food & Drink','Local Produce'], brewery:['Food & Drink','Local Produce'], distillery:['Food & Drink','Local Produce'], hiking:['Nature & Walks','Outdoor']
};

function tasDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-AU', { timeZone:'Australia/Hobart', year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
const TODAY = tasDate();
const slugify=(v)=>String(v).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,90);
const norm=(v='')=>String(v).toLowerCase().replace(/[^a-z0-9]/g,'');
const clean=(v='')=>String(v).replace(/<[^>]*>/g,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/\s+/g,' ').trim();
function url(value){if(!value)return null;const c=/^https?:\/\//i.test(String(value).trim())?String(value).trim():`https://${String(value).trim()}`;try{const u=new URL(c);return ['http:','https:'].includes(u.protocol)?c:null}catch{return null}}
function coords(e){if(Number.isFinite(e.lat)&&Number.isFinite(e.lon))return[e.lat,e.lon];if(Number.isFinite(e.center?.lat)&&Number.isFinite(e.center?.lon))return[e.center.lat,e.center.lon];return[null,null]}
function inTasmania(lat,lon){return Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=-44&&lat<=-39&&lon>=143&&lon<=149}
function km(a,b,c,d){const r=x=>x*Math.PI/180,dy=r(c-a),dx=r(d-b),z=Math.sin(dy/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(dx/2)**2;return 6371*2*Math.atan2(Math.sqrt(z),Math.sqrt(1-z))}
function region(lat,lon,town=''){const t=town.toLowerCase();if(['currie','grassy','naracoopa','king island'].some(v=>t.includes(v))||lon<144.35)return'King Island';if(['whitemark','lady barron','flinders island'].some(v=>t.includes(v))||(lat>-40.8&&lon>147.55))return'Flinders Island';if(['queenstown','strahan','zeehan','rosebery','tullah'].some(v=>t.includes(v))||(lon<145.65&&lat<-41.4))return'West Coast';if(['stanley','smithton','burnie','wynyard','penguin','ulverstone','devonport','latrobe','sheffield','cradle mountain'].some(v=>t.includes(v))||(lat>-42.05&&lon<146.65))return'North West';if(['launceston','george town','deloraine','longford','evandale','scottsdale','derby','bridport','beaconsfield'].some(v=>t.includes(v))||(lat>-42.05&&lon>=146.65&&lon<148))return'Launceston & North';if(['st helens','bicheno','swansea','coles bay','orford','triabunna','scamander'].some(v=>t.includes(v))||(lon>=147.75&&lat<=-40.8&&lat>-43.25))return'East Coast';if(['hobart','richmond','sorell','huon','cygnet','geeveston','dover','port arthur','new norfolk','bruny'].some(v=>t.includes(v))||lat<=-42.05)return'Hobart & South';return'Central Tasmania'}
function kind(t={}){if(t.tourism&&TYPES[t.tourism])return t.tourism;if(t.amenity==='marketplace')return'marketplace';if(t.shop==='farm')return'farm';if(t.leisure==='nature_reserve')return'nature_reserve';if(t.leisure==='playground')return'playground';if(t.natural==='beach')return'beach';if(['winery','brewery','distillery'].includes(t.craft))return t.craft;if(t.route==='hiking')return'hiking';return null}
function categories(t,k){const c=new Set(TYPES[k]||['Things to Do']);if(t.fee==='no')c.add('Free');if(t.indoor==='yes')c.add('Rainy Day');if(t.family==='yes'||t.kids==='yes')c.add('Family');return[...c]}
function fallback(c){const v=c.join('|').toLowerCase();let n='discover';if(v.includes('museum')||v.includes('art & culture'))n='culture';else if(v.includes('wildlife'))n='wildlife';else if(v.includes('market')||v.includes('food')||v.includes('local produce'))n='food';else if(v.includes('family'))n='family';else if(v.includes('nature')||v.includes('outdoor'))n='nature';return{url:`/images/categories/${n}.svg`,attribution:'TassieNow',license:'Site artwork',licenseUrl:null,sourceUrl:null,isFallback:true}}
function score(t,k){let s=({museum:14,zoo:14,aquarium:14,theme_park:13,gallery:12,attraction:11,marketplace:10,winery:10,distillery:10,brewery:9,nature_reserve:9,hiking:9,viewpoint:8,beach:7,farm:7,playground:5}[k]||4);if(t.website||t['contact:website'])s+=4;if(t.wikidata||t.wikimedia_commons||t.wikipedia)s+=5;if(t.opening_hours)s+=2;if(t.operator)s++;if(t.fee)s++;return s}
function summary(k,town,t){const at=town?` in or near ${town}`:' in Tasmania',op=t.operator?` Operated by ${clean(t.operator)}.`:'';const m={museum:`Museum${at}.`,gallery:`Gallery and arts destination${at}.`,zoo:`Wildlife attraction${at}.`,aquarium:`Aquarium and wildlife attraction${at}.`,theme_park:`Family attraction${at}.`,attraction:`Visitor attraction${at}.`,viewpoint:`Scenic viewpoint${at}.`,marketplace:`Market${at}.`,farm:`Farm-gate or local-produce destination${at}.`,nature_reserve:`Nature reserve${at}.`,playground:`Named playground or family recreation area${at}.`,beach:`Named beach${at}.`,winery:`Winery or cellar-door destination${at}.`,brewery:`Brewery destination${at}.`,distillery:`Distillery destination${at}.`,hiking:`Named walking or hiking route${at}.`};return`${m[k]||`Visitor destination${at}.`}${op}`.trim()}
async function fetchText(u,o={}){const r=await fetch(u,{...o,headers:{'user-agent':USER_AGENT,accept:'*/*',...(o.headers||{})},signal:AbortSignal.timeout(o.timeout||18000)});if(!r.ok)throw new Error(`${r.status} ${r.statusText}`);return await r.text()}
const fetchJson=async(u,o={})=>JSON.parse(await fetchText(u,o));
async function overpass(label,body,{maxEndpoints=ENDPOINTS.length,timeout=18000,queryTimeout=12}={}){const q=`[out:json][timeout:${queryTimeout}];(${body});out body center;`;let last;for(const ep of ENDPOINTS.slice(0,maxEndpoints)){try{const d=await fetchJson(ep,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({data:q}).toString(),timeout});if(d.remark&&/runtime error|timed out/i.test(d.remark))throw new Error(d.remark);console.log(`${label}: ${d.elements?.length||0} OSM element(s) via ${new URL(ep).hostname}.`);return d.elements||[]}catch(e){last=e;console.warn(`${label} failed at ${ep}: ${e.message}`)}}console.warn(`${label}: skipped after ${maxEndpoints} endpoint attempt(s): ${last?.message||'unknown error'}`);return[]}
async function discover(){
  const all=[];
  for(const [label,box] of BOXES){
    all.push(...await overpass(`core-${label}`,`node["place"~"^(city|town|village)$"]["name"](${box});nwr["tourism"~"^(attraction|museum|gallery|zoo|aquarium|theme_park|viewpoint)$"]["name"](${box});`,{maxEndpoints:3,timeout:18000,queryTimeout:12}));
  }
  all.push(...await overpass('markets-produce',`nwr["amenity"="marketplace"]["name"](${FULL});nwr["shop"="farm"]["name"](${FULL});nwr["craft"~"^(winery|brewery|distillery)$"]["name"](${FULL});`,{maxEndpoints:1,timeout:12000,queryTimeout:8}));
  all.push(...await overpass('walks-nature',`rel["route"="hiking"]["name"](${FULL});nwr["natural"="beach"]["name"](${FULL});nwr["leisure"="nature_reserve"]["name"](${FULL});`,{maxEndpoints:1,timeout:12000,queryTimeout:8}));
  all.push(...await overpass('family-playgrounds',`nwr["leisure"="playground"]["name"](${FULL});`,{maxEndpoints:1,timeout:12000,queryTimeout:8}));
  const unique=new Map();for(const e of all)unique.set(`${e.type}/${e.id}`,e);return[...unique.values()]
}
function nearest(lat,lon,list){let best=null,d=Infinity;for(const p of list){const x=km(lat,lon,p.latitude,p.longitude);if(x<d){best=p;d=x}}return d<=70?best?.name||'':''}
async function wikidata(ids){const out=new Map(),u=[...new Set(ids.filter(Boolean))];for(let i=0;i<u.length;i+=50){const b=u.slice(i,i+50),x=new URL('https://www.wikidata.org/w/api.php');x.searchParams.set('action','wbgetentities');x.searchParams.set('format','json');x.searchParams.set('props','claims');x.searchParams.set('ids',b.join('|'));try{const d=await fetchJson(x,{timeout:15000});for(const id of b){const f=d.entities?.[id]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;if(f)out.set(id,f)}}catch(e){console.warn(`Wikidata image batch skipped: ${e.message}`)}}return out}
async function commons(titles){const out=new Map(),u=[...new Set(titles.filter(Boolean).map(t=>t.replace(/^File:/i,'')))];for(let i=0;i<u.length;i+=30){const b=u.slice(i,i+30),x=new URL('https://commons.wikimedia.org/w/api.php');x.searchParams.set('action','query');x.searchParams.set('format','json');x.searchParams.set('prop','imageinfo');x.searchParams.set('iiprop','url|extmetadata');x.searchParams.set('iiurlwidth','1200');x.searchParams.set('titles',b.map(v=>`File:${v}`).join('|'));try{const d=await fetchJson(x,{timeout:15000});for(const p of Object.values(d.query?.pages||{})){const info=p.imageinfo?.[0];if(!info)continue;const f=p.title.replace(/^File:/i,''),m=info.extmetadata||{};out.set(f,{url:info.thumburl||info.url,sourceUrl:info.descriptionurl||null,attribution:clean(m.Artist?.value||m.Credit?.value||'')||'Wikimedia Commons contributor',license:clean(m.LicenseShortName?.value||m.UsageTerms?.value||'Wikimedia Commons'),licenseUrl:m.LicenseUrl?.value||null,isFallback:false})}}catch(e){console.warn(`Commons image batch skipped: ${e.message}`)}}return out}
function balanced(records,limit){const buckets=new Map();for(const r of records.sort((a,b)=>b._score-a._score||a.name.localeCompare(b.name))){if(!buckets.has(r.region))buckets.set(r.region,[]);buckets.get(r.region).push(r)}const out=[],rs=[...buckets.keys()].sort();let i=0;while(out.length<limit&&rs.some(r=>buckets.get(r).length)){const b=buckets.get(rs[i%rs.length]);if(b.length)out.push(b.shift());i++}return out}

const elements=await discover();
console.log(`Unique OSM response elements: ${elements.length}.`);
const localities=elements.filter(e=>e.tags?.place&&['city','town','village'].includes(e.tags.place)&&e.tags.name).map(e=>{const[latitude,longitude]=coords(e);return{name:e.tags.name,latitude,longitude}}).filter(p=>inTasmania(p.latitude,p.longitude));
const candidates=[];const counts={};
for(const e of elements){const t=e.tags||{},k=kind(t);if(!k||!t.name||['private','no'].includes(t.access))continue;const[latitude,longitude]=coords(e);if(!inTasmania(latitude,longitude))continue;const town=clean(t['addr:city']||t['addr:town']||t['addr:suburb']||t['addr:place']||nearest(latitude,longitude,localities)||'Tasmania'),c=categories(t,k);candidates.push({slug:slugify(t.name),name:clean(t.name),town,region:region(latitude,longitude,town),latitude,longitude,categories:c,summary:summary(k,town,t),website:url(t.website||t['contact:website']),sourceUrl:`https://www.openstreetmap.org/${e.type}/${e.id}`,sourceType:'openstreetmap',sourceId:`${e.type}/${e.id}`,wikidata:t.wikidata||null,_commons:t.wikimedia_commons?.startsWith('File:')?t.wikimedia_commons.replace(/^File:/,''):null,status:'active',lastChecked:TODAY,_score:score(t,k),image:null});counts[k]=(counts[k]||0)+1}
console.log(`Usable candidates: ${candidates.length}; ${JSON.stringify(counts)}.`);
const current=JSON.parse(await fs.readFile(FILE,'utf8'));
const curated=current.filter(p=>p.sourceType!=='openstreetmap').map(p=>({...p,sourceType:p.sourceType||'curated',image:p.image||{...fallback(p.categories||[]),alt:`${p.name} category image`}}));
const usedNames=new Set(curated.map(p=>norm(p.name))),usedSlugs=new Set(curated.map(p=>p.slug)),accepted=[];
for(const p of candidates){const n=norm(p.name);if(!n||usedNames.has(n)||usedSlugs.has(p.slug))continue;if(curated.some(c=>km(p.latitude,p.longitude,c.latitude,c.longitude)<.08))continue;usedNames.add(n);usedSlugs.add(p.slug);accepted.push(p)}
const selected=balanced(accepted,TARGET);
if(selected.length<300)throw new Error(`Discovery returned only ${selected.length} usable new places; refusing to replace a healthy catalogue.`);
const wd=await wikidata(selected.map(p=>p.wikidata));for(const p of selected)if(!p._commons&&p.wikidata&&wd.has(p.wikidata))p._commons=wd.get(p.wikidata);
const cm=await commons(selected.map(p=>p._commons));
for(const p of selected){p.image=p._commons&&cm.has(p._commons)?{...cm.get(p._commons),alt:`${p.name}, Tasmania`}:{...fallback(p.categories),alt:`${p.name} category image`};delete p._commons;delete p._score}
const merged=[...curated,...selected].sort((a,b)=>a.region.localeCompare(b.region)||a.town.localeCompare(b.town)||a.name.localeCompare(b.name));
await fs.writeFile(FILE,`${JSON.stringify(merged,null,2)}\n`);
console.log(`Catalogue: ${curated.length} curated + ${selected.length} OSM = ${merged.length} places.`);
