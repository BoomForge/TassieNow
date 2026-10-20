/**
 * Consolidate only identical Wikidata source entities that were imported more
 * than once under different instance classes. Names alone, nearby coordinates
 * and different QIDs NEVER establish duplicate identity.
 *
 * Broader multi-site institutions, different non-Wikidata source records and
 * manually managed entries are left for independent owner review.
 */
const norm=x=>String(x||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const qid=p=>p?.sourceType==='wikidata' && /^Q\d+$/.test(p.sourceId||'')
  && (p.wikidata===undefined||p.wikidata===null||p.wikidata===p.sourceId) ? p.sourceId : null;
const genericTown=x=>/^(?:tasmania|tas|victoria|australia|.+(?:council|municipality|municipal area))$/i.test(String(x||'').trim());
const radians=d=>d*Math.PI/180;
function metres(a,b){
 if(![a.latitude,a.longitude,b.latitude,b.longitude].every(Number.isFinite))return Infinity;
 const lat=radians(b.latitude-a.latitude),lon=radians(b.longitude-a.longitude);
 const v=Math.sin(lat/2)**2+
   Math.cos(radians(a.latitude))*Math.cos(radians(b.latitude))*Math.sin(lon/2)**2;
 return 6371000*2*Math.atan2(Math.sqrt(v),Math.sqrt(1-v));
}
const priority=p=>(p.slug?.match(/-\d+$/)?0:20)+(!genericTown(p.town)?10:0)+
  (p.address?5:0)+(p.website?4:0)+(p.phone?3:0)+
  (!p.image?.isFallback&&p.image?.url?2:0)+(p.gallery?.length||0)*0.01;
export function dedupeIdenticalWikidataPlaces(places){
 const source=Array.isArray(places)?places:[];
 const grouped=new Map();
 for(const p of source){const id=qid(p);if(!id)continue;
  if(!grouped.has(id))grouped.set(id,[]);
  grouped.get(id).push(p);
 }
 const dropped=new Set(),aliases=[];
 let groups=0;
 for(const [id,group] of grouped){
  if(group.length<2 || group.some(p=>p.managedManually||!p.slug||!p.name))continue;
  if(new Set(group.map(p=>norm(p.name))).size!==1)continue;
  if(group.some(p=>metres(group[0],p)>500))continue;
  const ranked=[...group].sort((a,b)=>priority(b)-priority(a)||
    a.slug.localeCompare(b.slug));
  const canonical=ranked[0];
  if(!source.includes(canonical))continue;
  for(const other of ranked.slice(1)){
   if(other===canonical || dropped.has(other))continue;
   // Preserve attribution and licensed gallery metadata without claiming that
   // two different operators, entrances or distinct Wikidata entities merge.
   canonical.categories=[...new Set([...(canonical.categories||[]),...(other.categories||[])])];
   if(genericTown(canonical.town)&&!genericTown(other.town)&&other.town)canonical.town=other.town;
   for(const key of ['address','phone','email','website','openingHours']){
    if(!canonical[key]&&other[key])canonical[key]=other[key];
   }
   if((!canonical.image?.url||canonical.image.isFallback) && other.image?.url&&!other.image.isFallback)
    canonical.image=structuredClone(other.image);
   if(!canonical.gallery?.length&&other.gallery?.length)
    canonical.gallery=structuredClone(other.gallery);
   dropped.add(other);
   aliases.push({from:other.slug,to:canonical.slug,qid:id});
  }
  if(ranked.slice(1).some(p=>dropped.has(p)))groups++;
 }
 return {places:source.filter(p=>!dropped.has(p)),removed:dropped.size,groups,aliases};
}
