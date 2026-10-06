import fs from 'node:fs/promises';

const FILE = new URL('../src/data/places.json', import.meta.url);
const USER_AGENT = 'TassieNow/1.5 (+https://tassienow.com)';
const GALLERY_SIZE = Math.max(1,Math.min(12,Number.parseInt(process.env.WIKIDATA_GALLERY_SIZE||'6',10)||6));
const MAX_CATEGORY_REQUESTS = Math.max(0,Math.min(2000,Number.parseInt(process.env.MAX_WIKIDATA_MEDIA||'250',10)||250));

const clean=(value='')=>String(value).replace(/<[^>]*>/g,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/\s+/g,' ').trim();
const qid=(place)=>{const value=String(place.wikidata||((place.sourceType==='wikidata'&&place.sourceId)||'')||'');return /^Q\d+$/.test(value)?value:null;};
const key=(image)=>image?.sourceUrl||image?.url||'';
const blockedTitle=(title='')=>/\b(?:logo|map|diagram|coat of arms|flag|icon|signage|sign|poster|brochure|floor plan|locator map|route map)\b/i.test(title);

async function fetchJson(url,timeout=20000){
  const response=await fetch(url,{headers:{'user-agent':USER_AGENT,accept:'application/json'},signal:AbortSignal.timeout(timeout)});
  if(!response.ok)throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}
async function fetchClaims(ids){
  const out=new Map();
  for(let i=0;i<ids.length;i+=50){
    const batch=ids.slice(i,i+50);
    const url=new URL('https://www.wikidata.org/w/api.php');
    url.searchParams.set('action','wbgetentities');url.searchParams.set('format','json');url.searchParams.set('props','claims');url.searchParams.set('ids',batch.join('|'));
    try{
      const data=await fetchJson(url);
      for(const id of batch){
        const entity=data.entities?.[id];
        const images=(entity?.claims?.P18||[]).map((claim)=>claim?.mainsnak?.datavalue?.value).filter((value)=>typeof value==='string');
        const category=(entity?.claims?.P373||[]).map((claim)=>claim?.mainsnak?.datavalue?.value).find((value)=>typeof value==='string')||null;
        out.set(id,{images:[...new Set(images)],category});
      }
    }catch(error){console.warn(`Wikidata media batch skipped: ${error.message}`);}
  }
  return out;
}
function imageFromInfo(page,info,sourceMethod){
  const meta=info.extmetadata||{};
  const license=clean(meta.LicenseShortName?.value||meta.UsageTerms?.value||'');
  if(!license||blockedTitle(page.title||''))return null;
  return{
    url:info.thumburl||info.url,
    alt:'',
    attribution:clean(meta.Artist?.value||meta.Credit?.value||'')||'Wikimedia Commons contributor',
    license,
    licenseUrl:meta.LicenseUrl?.value||null,
    sourceUrl:info.descriptionurl||null,
    isFallback:false,
    sourceMethod,
    confidence:'high'
  };
}
async function commonsMetadata(filenames){
  const out=new Map(),unique=[...new Set(filenames.filter(Boolean))];
  for(let i=0;i<unique.length;i+=30){
    const batch=unique.slice(i,i+30);
    const url=new URL('https://commons.wikimedia.org/w/api.php');
    url.searchParams.set('action','query');url.searchParams.set('format','json');url.searchParams.set('prop','imageinfo');
    url.searchParams.set('iiprop','url|extmetadata');url.searchParams.set('iiurlwidth','1600');
    url.searchParams.set('titles',batch.map((name)=>`File:${name}`).join('|'));
    try{
      const data=await fetchJson(url);
      for(const page of Object.values(data.query?.pages||{})){
        const info=page.imageinfo?.[0];if(!info)continue;
        const filename=String(page.title||'').replace(/^File:/i,'');
        const image=imageFromInfo(page,info,'wikidata-p18');
        if(image)out.set(filename,image);
      }
    }catch(error){console.warn(`Commons exact-image batch skipped: ${error.message}`);}
  }
  return out;
}
async function categoryImages(category){
  const url=new URL('https://commons.wikimedia.org/w/api.php');
  url.searchParams.set('action','query');url.searchParams.set('format','json');url.searchParams.set('generator','categorymembers');
  url.searchParams.set('gcmtitle',`Category:${category}`);url.searchParams.set('gcmtype','file');url.searchParams.set('gcmlimit','36');
  url.searchParams.set('prop','imageinfo');url.searchParams.set('iiprop','url|extmetadata');url.searchParams.set('iiurlwidth','1600');
  try{
    const data=await fetchJson(url);
    const out=[];
    for(const page of Object.values(data.query?.pages||{})){
      const info=page.imageinfo?.[0];if(!info)continue;
      const image=imageFromInfo(page,info,'wikimedia-category');
      if(image)out.push(image);
    }
    return out;
  }catch(error){console.warn(`Commons category "${category}" skipped: ${error.message}`);return[];}
}

const places=JSON.parse(await fs.readFile(FILE,'utf8'));
const targets=places.filter((place)=>place.status==='active'&&place.visibility!=='suppressed'&&qid(place));
const ids=[...new Set(targets.map(qid))];
const claims=await fetchClaims(ids);
for(const place of targets){
  const claim=claims.get(qid(place));
  if(!claim)continue;
  if(!place.commonsCategory&&claim.category)place.commonsCategory=claim.category;
  if((!Array.isArray(place.wikidataImages)||!place.wikidataImages.length)&&claim.images.length)place.wikidataImages=claim.images;
}
const allExact=targets.flatMap((place)=>place.wikidataImages||[]);
const exact=await commonsMetadata(allExact);
let heroUpgraded=0,galleryAdded=0,categoriesChecked=0;

for(const place of targets){
  const used=new Set();
  if(place.image&&!place.image.isFallback)used.add(key(place.image));
  const gallery=(Array.isArray(place.gallery)?place.gallery:[]).filter((image)=>image&&!image.isFallback);
  for(const image of gallery)used.add(key(image));
  let candidates=(place.wikidataImages||[]).map((filename)=>exact.get(filename)).filter(Boolean).map((image)=>({...image,alt:`${place.name}, Tasmania`}));
  // A Wikidata P18 image is explicitly attached to the matched place and is a
  // stronger identity signal than a text-search Commons result. Prefer it for
  // generated listings, while never replacing owner-managed/manual artwork.
  const canPromoteExact = candidates.length && !place.managedManually && place.sourceType !== 'manual' &&
    (place.image?.isFallback || place.image?.sourceMethod === 'commons-search');
  if(canPromoteExact){
    const exactHero=candidates.shift();
    if(key(exactHero)!==key(place.image)){place.image=exactHero;heroUpgraded++;}
    used.add(key(place.image));
  }
  for(const image of candidates){
    if(gallery.length>=GALLERY_SIZE)break;
    const k=key(image);if(!k||used.has(k))continue;
    gallery.push(image);used.add(k);galleryAdded++;
  }
  if(gallery.length<GALLERY_SIZE&&place.commonsCategory&&categoriesChecked<MAX_CATEGORY_REQUESTS){
    categoriesChecked++;
    const category=await categoryImages(place.commonsCategory);
    for(const raw of category){
      if(gallery.length>=GALLERY_SIZE)break;
      const image={...raw,alt:`${place.name}, Tasmania`};
      const k=key(image);if(!k||used.has(k))continue;
      if(place.image?.isFallback){place.image=image;used.add(k);heroUpgraded++;continue;}
      gallery.push(image);used.add(k);galleryAdded++;
    }
  }
  if(gallery.length)place.gallery=gallery.slice(0,GALLERY_SIZE);
}

await fs.writeFile(FILE,`${JSON.stringify(places,null,2)}\n`);
const publicPlaces=places.filter((place)=>place.status==='active'&&place.visibility!=='suppressed');
const realHeroes=publicPlaces.filter((place)=>place.image&&!place.image.isFallback).length;
const galleries=publicPlaces.filter((place)=>(place.gallery?.length||0)>=2).length;
console.log(`Wikidata media: checked ${targets.length} listing(s), ${categoriesChecked} Commons categor${categoriesChecked===1?'y':'ies'}; upgraded ${heroUpgraded} hero(s); added ${galleryAdded} gallery image(s). Coverage now ${realHeroes}/${publicPlaces.length} real heroes and ${galleries}/${publicPlaces.length} multi-image galleries.`);
