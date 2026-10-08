/**
 * Keep genuine businesses in different towns (and distinct nearby businesses)
 * while preventing repeated OSM node/way records for the same venue.
 * Selection budgets are separate: restaurant coverage must not be squeezed
 * out by a high number of viewpoints and attractions.
 */
const normalized = (text='') => String(text).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const slugify = text => String(text).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,90);
const isFood = place => (place.categories||[]).includes('Food & Drink');

function kilometres(a,b) {
  const rad=n=>n*Math.PI/180, dy=rad(b.latitude-a.latitude), dx=rad(b.longitude-a.longitude);
  const val=Math.sin(dy/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(dx/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(val),Math.sqrt(1-val));
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
export function selectOsmCandidates(candidates,curated,previousOsm,{retainVerifiedMedia,verifiedMedia},{coreLimit=520,foodLimit=1250}={}) {
  const byName=new Map(),usedSlugs=new Set(curated.map(place=>place.slug).filter(Boolean));
  for(const place of curated) {
    const key=normalized(place.name);
    if(!key)continue;
    if(!byName.has(key))byName.set(key,[]);
    byName.get(key).push(place);
  }
  let rejectedDuplicates=0,preservedImages=0;
  const accepted=[];
  for(const place of [...candidates].sort((a,b)=>(b._score||0)-(a._score||0)||a.name.localeCompare(b.name))) {
    const key=normalized(place.name);
    if(!key)continue;
    // A same-name café in Launceston is NOT a duplicate of one in Hobart.
    // Proximity alone is also NOT evidence that two differently named shops are duplicates.
    if((byName.get(key)||[]).some(old => Number.isFinite(old.latitude)&&Number.isFinite(old.longitude)&&kilometres(place,old)<0.15)) {
      rejectedDuplicates++;
      continue;
    }
    const old=previousOsm.get(place.sourceId);
    if(old) {
      retainVerifiedMedia(place,old);
      if(verifiedMedia(place.image)){place._score=(place._score||0)+24;preservedImages++;}
    }
    let slug=old?.slug||place.slug||slugify(place.name);
    if(usedSlugs.has(slug)) slug=slugify(`${place.name}-${place.town}`);
    if(usedSlugs.has(slug)) slug=`${slugify(place.name).slice(0,50)}-osm-${String(place.sourceId).replace(/[^a-z0-9]+/gi,'-').toLowerCase()}`;
    place.slug=slug;
    usedSlugs.add(slug);
    if(!byName.has(key))byName.set(key,[]);
    byName.get(key).push(place);
    accepted.push(place);
  }
  const availableFood=accepted.filter(isFood);
  const availableOther=accepted.filter(place=>!isFood(place));
  const selected=[...balancedByRegion(availableOther,coreLimit),...balancedByRegion(availableFood,foodLimit)];
  return {selected,stats:{candidates:candidates.length,deduplicated:rejectedDuplicates,availableFood:availableFood.length,availableOther:availableOther.length,selectedFood:selected.filter(isFood).length,selectedOther:selected.filter(place=>!isFood(place)).length,preservedImages}};
}
