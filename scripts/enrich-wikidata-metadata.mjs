import fs from 'node:fs/promises';

const FILE = new URL('../src/data/places.json', import.meta.url);
const USER_AGENT = 'TassieNow/1.5 (+https://tassienow.com)';
const TODAY = new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Hobart'}).format(new Date());

const clean=(value='')=>String(value??'').replace(/<[^>]*>/g,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/\s+/g,' ').trim();
const qid=(place)=>{const value=String(place.wikidata||((place.sourceType==='wikidata'&&place.sourceId)||'')||'');return /^Q\d+$/.test(value)?value:null;};
const validHttp=(value)=>{try{const u=new URL(String(value));return ['http:','https:'].includes(u.protocol)?u.href:null;}catch{return null;}};
const claimValues=(entity,property)=>((entity?.claims?.[property]||[]).map((claim)=>claim?.mainsnak?.datavalue?.value).filter((value)=>value!==undefined&&value!==null));
const firstString=(entity,property)=>{for(const value of claimValues(entity,property)){if(typeof value==='string'&&clean(value))return clean(value);if(value&&typeof value==='object'&&clean(value.text))return clean(value.text);}return null;};
const stringList=(entity,property)=>claimValues(entity,property).map((value)=>typeof value==='string'?clean(value):value&&typeof value==='object'?clean(value.text):'').filter(Boolean);

function source(type,url){return{type,url,checkedAt:TODAY};}
function apply(place,key,value,type,url){
  if(value==null||value==='')return false;
  if(place.managedManually&&place[key])return false;
  if(place.detailSources?.[key]?.type==='manual')return false;
  if(place[key]===value)return false;
  if(place[key])return false;
  place[key]=value;
  place.detailSources ||= {};
  place.detailSources[key]=source(type,url);
  return true;
}
async function fetchEntities(ids){
  const out=new Map();
  for(let i=0;i<ids.length;i+=50){
    const batch=ids.slice(i,i+50);
    const url=new URL('https://www.wikidata.org/w/api.php');
    url.searchParams.set('action','wbgetentities');
    url.searchParams.set('format','json');
    url.searchParams.set('props','claims|sitelinks');
    url.searchParams.set('ids',batch.join('|'));
    try{
      const response=await fetch(url,{headers:{'user-agent':USER_AGENT,accept:'application/json'},signal:AbortSignal.timeout(20000)});
      if(!response.ok)throw new Error(`${response.status} ${response.statusText}`);
      const data=await response.json();
      for(const id of batch)if(data.entities?.[id])out.set(id,data.entities[id]);
    }catch(error){console.warn(`Wikidata metadata batch skipped: ${error.message}`);}
  }
  return out;
}

const places=JSON.parse(await fs.readFile(FILE,'utf8'));
const targets=places.filter((place)=>place.status==='active'&&place.visibility!=='suppressed'&&qid(place));
const ids=[...new Set(targets.map(qid))];
const entities=await fetchEntities(ids);
let websiteAdded=0,officialAdded=0,phoneAdded=0,emailAdded=0,addressAdded=0,commonsAdded=0,imagesLinked=0,wikipediaAdded=0;

for(const place of targets){
  const id=qid(place),entity=entities.get(id);if(!entity)continue;
  place.wikidata=id;
  const sourceUrl=`https://www.wikidata.org/wiki/${id}`;
  const official=validHttp(firstString(entity,'P856'));
  if(official&&!place.website){place.website=official;place.detailSources ||= {};place.detailSources.website=source('wikidata:P856',sourceUrl);websiteAdded++;}
  if(official&&!place.officialSource?.url){
    place.officialSource={type:'official-website',url:official,source:'wikidata:P856',checkedAt:TODAY};
    officialAdded++;
  }
  const phone=firstString(entity,'P1329');
  const email=firstString(entity,'P968');
  const address=firstString(entity,'P6375');
  if(apply(place,'phone',phone,'wikidata:P1329',sourceUrl))phoneAdded++;
  if(apply(place,'email',email,'wikidata:P968',sourceUrl))emailAdded++;
  if(apply(place,'address',address,'wikidata:P6375',sourceUrl))addressAdded++;
  const category=firstString(entity,'P373');
  if(category&&place.commonsCategory!==category){place.commonsCategory=category;commonsAdded++;}
  const images=[...new Set(stringList(entity,'P18'))];
  if(images.length){place.wikidataImages=images;imagesLinked+=images.length;}
  const enwiki=entity.sitelinks?.enwiki?.title;
  if(enwiki&&!place.wikipediaUrl){place.wikipediaUrl=`https://en.wikipedia.org/wiki/${encodeURIComponent(enwiki.replace(/ /g,'_'))}`;wikipediaAdded++;}
  place.lastWikidataChecked=TODAY;
}

await fs.writeFile(FILE,`${JSON.stringify(places,null,2)}\n`);
console.log(`Wikidata metadata: checked ${targets.length} listing(s) across ${entities.size} item(s); official websites +${officialAdded}; websites +${websiteAdded}; phones +${phoneAdded}; emails +${emailAdded}; addresses +${addressAdded}; Commons categories +${commonsAdded}; linked P18 images ${imagesLinked}; Wikipedia links +${wikipediaAdded}.`);
