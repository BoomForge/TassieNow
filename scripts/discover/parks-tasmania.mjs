import fs from 'node:fs/promises';

const PLACES_FILE=new URL('../../src/data/places.json',import.meta.url);
const WALKS_FILE=new URL('../../src/data/parks-walks.json',import.meta.url);
const SOURCE='https://parks.tas.gov.au/things-to-do/walks';
const UA='TassieNow/0.8 (+https://tassienow.pages.dev)';
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Hobart'}).format(new Date());

const decode=(v='')=>String(v).replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;|&#x27;/gi,"'").replace(/&ndash;|&#8211;/gi,'–').replace(/&mdash;|&#8212;/gi,'—');
const clean=(v='')=>decode(String(v).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
const norm=(v='')=>clean(v).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(the|walk|track|trail|circuit|route)\b/g,' ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
function absolute(href){try{return new URL(href,SOURCE).href}catch{return SOURCE}}
function regionLabel(text=''){
  const v=text.toLowerCase();
  if(v.includes('hobart and south'))return'Hobart & South';
  if(v.includes('launceston and north'))return'Launceston & North';
  if(v.includes('east coast'))return'East Coast';
  if(v.includes('west coast'))return'West Coast';
  if(v.includes('north west'))return'North West';
  if(v.includes('flinders island'))return'Flinders Island';
  if(v.includes('king island'))return'King Island';
  return null;
}
async function fetchHtml(url){const r=await fetch(url,{headers:{'user-agent':UA,accept:'text/html,*/*;q=.8'},signal:AbortSignal.timeout(45000)});if(!r.ok)throw new Error(`${r.status} ${r.statusText}`);return r.text()}
function cards(html){
  const out=[]; let previous=0;
  const anchor=/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for(const m of html.matchAll(anchor)){
    if(!/^read\s*more$/i.test(clean(m[2])))continue;
    const segment=html.slice(previous,m.index); previous=m.index+m[0].length;
    const headings=[...segment.matchAll(/<h[23]\b[^>]*>([\s\S]*?)<\/h[23]>/gi)].map(x=>clean(x[1])).filter(Boolean);
    const name=headings.at(-1); if(!name||name.length>140)continue;
    const text=clean(segment.slice(Math.max(0,segment.length-3500)));
    const grade=text.match(/\bGrade\s*([1-5])\b/i)?.[1]||null;
    const metric=text.match(/((?:\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?\s*(?:minutes?|mins?|hours?|hrs?|days?)[^,.;]{0,80})(?:,|\s)\s*[^.;]{0,80}?\bGrade\s*[1-5]\b)/i)?.[1]?.trim()||null;
    const region=regionLabel(text);
    const pageUrl=absolute(m[1]);
    if(!/parks\.tas\.gov\.au/i.test(pageUrl)||/things-to-do\/walks\/?$/i.test(pageUrl))continue;
    out.push({name,url:pageUrl,region,duration:metric,grade:grade?Number(grade):null,sourceName:'Parks & Wildlife Service Tasmania',sourceUrl:SOURCE,lastChecked:today});
  }
  const seen=new Set();return out.filter(w=>{const k=`${norm(w.name)}|${w.url}`;if(seen.has(k))return false;seen.add(k);return true;});
}
function matchWalk(place,walks){
  const p=norm(place.name); if(!p)return null;
  let best=null,bestScore=0;
  for(const walk of walks){const w=norm(walk.name);if(!w)continue;let s=0;if(p===w)s=100;else if(p.length>=6&&w.length>=6&&(p.includes(w)||w.includes(p)))s=75;else {const pt=new Set(p.split(' ')),wt=new Set(w.split(' '));const overlap=[...pt].filter(x=>wt.has(x)&&x.length>2).length;s=Math.round(100*overlap/Math.max(pt.size,wt.size));}if(s>bestScore){best=walk;bestScore=s;}}
  return bestScore>=70?best:null;
}

const html=await fetchHtml(SOURCE);
const walks=cards(html);
if(walks.length<40)throw new Error(`Parks Tasmania parser found only ${walks.length} walks; refusing weak enrichment.`);
await fs.writeFile(WALKS_FILE,`${JSON.stringify(walks,null,2)}\n`);
const places=JSON.parse(await fs.readFile(PLACES_FILE,'utf8'));
let matched=0;
const enriched=places.map(place=>{
  const walk=matchWalk(place,walks); if(!walk)return place; matched++;
  const categories=[...new Set([...(place.categories||[]),'Nature & Walks','Outdoor'])];
  const detail=[walk.duration,walk.grade?`Grade ${walk.grade}`:null].filter(Boolean).join(' · ');
  const summary=detail?`${walk.name} is an official Parks Tasmania walk. ${detail}.`: `${walk.name} is listed as an official Parks Tasmania walk.`;
  return {...place,categories,summary,website:place.website||walk.url,officialSource:{name:'Parks & Wildlife Service Tasmania',url:walk.url,type:'government'},walk:{duration:walk.duration,grade:walk.grade},parksTasmaniaMatched:true,lastChecked:today};
});
await fs.writeFile(PLACES_FILE,`${JSON.stringify(enriched,null,2)}\n`);
console.log(`Parks Tasmania: ${walks.length} official walks parsed; ${matched} catalogue place(s) enriched.`);
if(matched<5)console.warn('Parks Tasmania matched fewer than 5 current catalogue places; source cache retained for future matching.');
