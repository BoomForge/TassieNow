import fs from 'node:fs/promises';

const FILE = new URL('../src/data/places.json', import.meta.url);
const USER_AGENT = 'TassieNow/1.6 (+https://tassienow.com)';
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Hobart' }).format(new Date());
const MAX_PER_RUN = Math.max(1, Math.min(2000, Number.parseInt(process.env.MAX_WIKIDATA_LINKS || '300', 10) || 300));
const CONCURRENCY = Math.max(1, Math.min(8, Number.parseInt(process.env.WIKIDATA_LINK_CONCURRENCY || '4', 10) || 4));

const clean = (value = '') => String(value ?? '').replace(/\s+/g, ' ').trim();
const norm = (value = '') => clean(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
const tokens = (value = '') => norm(value).split(' ').filter((token) => token.length > 2 && !['the','and','tasmania','tasmanian','park','reserve','museum','gallery','lookout'].includes(token));
const qid = (place) => { const value = String(place.wikidata || ((place.sourceType === 'wikidata' && place.sourceId) || '') || ''); return /^Q\d+$/.test(value) ? value : null; };

function km(a,b,c,d){const r=(x)=>x*Math.PI/180,dy=r(c-a),dx=r(d-b),z=Math.sin(dy/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(dx/2)**2;return 6371*2*Math.atan2(Math.sqrt(z),Math.sqrt(1-z));}
function similarity(a,b){
  const aa=new Set(tokens(a)),bb=new Set(tokens(b));
  if(!aa.size||!bb.size)return 0;
  let hit=0;for(const token of aa)if(bb.has(token))hit++;
  return hit/Math.max(aa.size,bb.size);
}
function coordinate(entity){
  for(const claim of entity?.claims?.P625 || []){
    const value=claim?.mainsnak?.datavalue?.value;
    if(Number.isFinite(value?.latitude)&&Number.isFinite(value?.longitude))return [value.latitude,value.longitude];
  }
  return [null,null];
}
async function fetchJson(url){
  const response=await fetch(url,{headers:{'user-agent':USER_AGENT,accept:'application/json'},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}
async function search(place){
  const url=new URL('https://www.wikidata.org/w/api.php');
  url.searchParams.set('action','wbsearchentities');
  url.searchParams.set('format','json');
  url.searchParams.set('language','en');
  url.searchParams.set('uselang','en');
  url.searchParams.set('type','item');
  url.searchParams.set('limit','7');
  url.searchParams.set('search',place.name);
  const data=await fetchJson(url);
  return (data.search||[]).filter((item)=>/^Q\d+$/.test(item.id));
}
async function fetchEntities(ids){
  if(!ids.length)return {};
  const url=new URL('https://www.wikidata.org/w/api.php');
  url.searchParams.set('action','wbgetentities');
  url.searchParams.set('format','json');
  url.searchParams.set('props','claims|labels|aliases|descriptions');
  url.searchParams.set('languages','en');
  url.searchParams.set('ids',ids.join('|'));
  return (await fetchJson(url)).entities||{};
}
function bestMatch(place,searchRows,entities){
  const wanted=norm(place.name);
  const scored=[];
  for(const row of searchRows){
    const entity=entities[row.id];if(!entity)continue;
    const [lat,lon]=coordinate(entity);
    if(!Number.isFinite(lat)||!Number.isFinite(lon))continue;
    const distance=km(place.latitude,place.longitude,lat,lon);
    if(distance>25)continue;
    const label=entity.labels?.en?.value||row.label||'';
    const aliases=(entity.aliases?.en||[]).map((item)=>item.value);
    const names=[label,...aliases,row.match?.text].filter(Boolean);
    const exact=names.some((name)=>norm(name)===wanted);
    const sim=Math.max(...names.map((name)=>similarity(place.name,name)),0);
    const description=clean(entity.descriptions?.en?.value||row.description||'');
    let score=(exact?70:Math.round(sim*55));
    if(distance<=0.25)score+=28;else if(distance<=1)score+=22;else if(distance<=3)score+=16;else if(distance<=8)score+=9;else score+=3;
    if(/tasmania|tasmanian|hobart|launceston/i.test(description))score+=6;
    const acceptable=(exact&&distance<=25)||(sim>=0.8&&distance<=8)||(sim>=0.66&&distance<=1.5);
    if(acceptable)scored.push({id:row.id,label,distance,score,sim,description});
  }
  scored.sort((a,b)=>b.score-a.score||a.distance-b.distance);
  if(!scored.length)return null;
  if(scored[1]&&scored[0].score-scored[1].score<5&&Math.abs(scored[0].distance-scored[1].distance)<1)return null;
  return scored[0];
}
async function mapLimit(items,limit,worker){
  let index=0;
  const runners=Array.from({length:Math.min(limit,items.length)},async()=>{while(index<items.length){const current=items[index++];await worker(current);}});
  await Promise.all(runners);
}

const places=JSON.parse(await fs.readFile(FILE,'utf8'));
const unresolved=places.filter((place)=>place.status==='active'&&place.visibility!=='suppressed'&&!qid(place)&&Number.isFinite(place.latitude)&&Number.isFinite(place.longitude));
const day=Math.floor(Date.now()/86400000);
const offset=unresolved.length?(day*MAX_PER_RUN)%unresolved.length:0;
const rotated=unresolved.length?[...unresolved.slice(offset),...unresolved.slice(0,offset)]:[];
const targets=rotated.slice(0,MAX_PER_RUN);
let linked=0,ambiguousOrMissing=0,failed=0;

await mapLimit(targets,CONCURRENCY,async(place)=>{
  try{
    const rows=await search(place);
    const entities=await fetchEntities(rows.map((row)=>row.id));
    const match=bestMatch(place,rows,entities);
    place.lastWikidataLinkChecked=TODAY;
    if(!match){ambiguousOrMissing++;return;}
    place.wikidata=match.id;
    place.wikidataMatch={method:'name-coordinate',label:match.label,distanceKm:Math.round(match.distance*100)/100,confidence:match.score>=95?'high':'medium',checkedAt:TODAY};
    linked++;
  }catch(error){
    failed++;
    console.warn(`Wikidata link lookup failed for ${place.name}: ${error.message}`);
  }
});

await fs.writeFile(FILE,`${JSON.stringify(places,null,2)}\n`);
console.log(`Wikidata linkage: checked ${targets.length}/${unresolved.length} unlinked listing(s) from offset ${offset}; linked ${linked}; unresolved/ambiguous ${ambiguousOrMissing}; failed ${failed}.`);
