/**
 * Keep genuine businesses in different towns (and distinct nearby businesses)
 * while preventing repeated OSM node/way records for the same venue.
 * Selection budgets are separate: restaurant coverage must not be squeezed
 * out by a high number of viewpoints and attractions.
 */
const normalized = (text='') => String(text).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const slugify = text => String(text).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,90);
const isFood = place => (place.categories||[]).includes('Food & Drink');

const streetKey=place=>{
 const addr=String(place.address||'').toLowerCase()
  .replace(/\bst\b/g,'street').replace(/\brd\b/g,'road').replace(/\bave\b/g,'avenue')
  .replace(/\s+/g,' ');
 return (/(\b\d{1,5}[a-z]?\s+[\w\s]+?\s+(?:street|road|avenue|drive|parade|lane|highway))\b/.exec(addr)||[])[1]?.replace(/\s+/g,' ').trim()||'';
};
const detailScore=place=>['phone','openingHours','website','address'].filter(k=>Boolean(place[k])).length;
const foodAliasDuplicate=(place,old)=>{
 if(!isFood(place)||!isFood(old)||!Number.isFinite(place.latitude)||!Number.isFinite(place.longitude)||
    !Number.isFinite(old.latitude)||!Number.isFinite(old.longitude)||kilometres(place,old)>0.025)return false;
 const address=streetKey(place);
 if(!address||address!==streetKey(old))return false;
 const x=normalized(place.name),y=normalized(old.name);
 const [short,long]=x.length<y.length?[x,y]:[y,x];
 if(short.length<7||!long.startsWith(short)||long===short)return false;
 // Only extend an existing name by generic restaurant/trading-type words.
 return /^(?:(?:chinese|restaurant|and|takeaway|takeaways|food|shop|cafe|coffee|bar|grill|diner|kitchen|milkbar|bakery|pizza))+$/i.test(long.slice(short.length));
};


function kilometres(a,b) {
  const rad=n=>n*Math.PI/180, dy=rad(b.latitude-a.latitude), dx=rad(b.longitude-a.longitude);
  const val=Math.sin(dy/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(dx/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(val),Math.sqrt(1-val));
}
// Only turn OSM image tags into photographs after fetching exact Commons
// metadata. Arbitrary restaurant website URLs are not reuse permission.
export function commonsFileFromOsmImage(value) {
  const raw=String(value||'').trim();
  if(!raw||/[;|]/.test(raw))return null;
  if(/^File:/i.test(raw))return raw.replace(/^File:/i,'').trim()||null;
  try {
    const url=new URL(raw);
    if(url.hostname==='commons.wikimedia.org'){
      const path=decodeURIComponent(url.pathname);
      if(/^\/wiki\/File:/i.test(path))return path.replace(/^\/wiki\/File:/i,'').replaceAll('_',' ');
    }
    if(url.hostname==='upload.wikimedia.org'&&url.pathname.startsWith('/wikipedia/commons/')){
      const parts=decodeURIComponent(url.pathname).split('/');
      return (parts.includes('thumb')?parts.at(-2):parts.at(-1))?.replaceAll('_',' ')||null;
    }
  }catch{/* invalid or non-Commons image tag */}
  return null;
}
export function balancedByRegion(records, limit) {
  const buckets=new Map();
  for(const record of [...records].sort((a,b)=>(b._score||0)-(a._score||0)||a.name.localeCompare(b.name))) {
    if(!buckets.has(record.region))buckets.set(record.region,[]);
    buckets.get(record.region).push(record);
  }
  const output=[],regions=[...buckets.keys()].sort();
  let i=0;
  while(output.length<limit&&regions.some(region=>buckets.get(region).length)) {
    const bucket=buckets.get(regions[i%regions.length]);
    if(bucket.length)output.push(bucket.shift());
    i++;
  }
  return output;
}
export function selectOsmCandidates(candidates,curated,previousOsm,{retainVerifiedMedia,verifiedMedia},{coreLimit=520,foodLimit=1250,vendorLimit=180}={}) {
  const byName=new Map(),usedSlugs=new Set(curated.map(place=>place.slug).filter(Boolean));
  // Existing published URLs are owned by their exact OSM source identity.
  // A newly discovered same-name chain outlet cannot claim a prior outlet's slug.
  const oldSlugOwner=new Map([...previousOsm].filter(([,place])=>place.slug).map(([id,place])=>[place.slug,id]));
  for(const place of curated) {
    const key=normalized(place.name);
    if(!key)continue;
    if(!byName.has(key))byName.set(key,[]);
    byName.get(key).push(place);
  }
  let rejectedDuplicates=0,preservedImages=0;
  const accepted=[];
  for(const place of [...candidates].sort((a,b)=>(b._score||0)-(a._score||0)||detailScore(b)-detailScore(a)||a.name.localeCompare(b.name))) {
    const key=normalized(place.name);
    if(!key)continue;
    // A same-name café in Launceston is NOT a duplicate of one in Hobart.
    // Proximity alone is also NOT evidence that two differently named shops are duplicates.
    if((byName.get(key)||[]).some(old => Number.isFinite(old.latitude)&&Number.isFinite(old.longitude)&&kilometres(place,old)<0.15) ||
       [...byName.values()].some(matches=>matches.some(old=>foodAliasDuplicate(place,old)))) {
      rejectedDuplicates++;
      continue;
    }
    const old=previousOsm.get(place.sourceId);
    if(old) {
      retainVerifiedMedia(place,old);
      if(verifiedMedia(place.image)){place._score=(place._score||0)+24;preservedImages++;}
    }
    let slug=old?.slug||place.slug||slugify(place.name);
    if(usedSlugs.has(slug) || (oldSlugOwner.has(slug)&&oldSlugOwner.get(slug)!==place.sourceId)) slug=slugify(`${place.name}-${place.town}`);
    if(usedSlugs.has(slug) || (oldSlugOwner.has(slug)&&oldSlugOwner.get(slug)!==place.sourceId)) slug=`${slugify(place.name).slice(0,50)}-osm-${String(place.sourceId).replace(/[^a-z0-9]+/gi,'-').toLowerCase()}`;
    place.slug=slug;
    usedSlugs.add(slug);
    if(!byName.has(key))byName.set(key,[]);
    byName.get(key).push(place);
    accepted.push(place);
  }
  const isMobile=place=>(place.categories||[]).includes('Food Van')||(place.categories||[]).includes('Mobile Vendor');
  const availableVendors=accepted.filter(place=>isFood(place)&&isMobile(place));
  const availableFood=accepted.filter(place=>isFood(place)&&!isMobile(place));
  const availableOther=accepted.filter(place=>!isFood(place));
  // Mobile vendors have their own budget and cannot be displaced by cafés.
  const selected=[...balancedByRegion(availableOther,coreLimit),...balancedByRegion(availableFood,foodLimit),...balancedByRegion(availableVendors,vendorLimit)];
  return {selected,stats:{candidates:candidates.length,deduplicated:rejectedDuplicates,availableFood:availableFood.length,availableOther:availableOther.length,selectedFood:selected.filter(isFood).length,availableVendors:availableVendors.length,selectedVendors:selected.filter(isMobile).length,selectedOther:selected.filter(place=>!isFood(place)).length,preservedImages}};
}
