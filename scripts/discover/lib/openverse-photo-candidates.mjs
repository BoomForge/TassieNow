// Openverse is a FREE *discovery* source, not a rights-verification service.
// Only candidates with strong place identity, location and open-licence metadata
// are saved for review. Never publish an image directly from this queue.
const normalize = value => String(value || '').normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '').replace(/<[^>]*>/g, ' ')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const PERMITTED = new Set(['by', 'by-sa', 'cc0', 'pdm']);
const UNWANTED = /\b(?:logo|icon|map|flyer|poster|advertisement|brochure|watermark|screenshot|stock photo|clipart|illustration)\b/i;
const foreignPlaces = /\b(?:victoria|queensland|new south wales|western australia|south australia|northern territory|new zealand|england|canada|united states)\b/i;
const PHOTO_TAGS = new Set(['photograph', 'photo', 'photography']);
const safeUrl = value => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !/^(?:localhost|127\.|10\.|192\.168\.)/.test(url.hostname);
  } catch { return false; }
};
const matchedPhrase = (context, term) => {
  const parts = normalize(term).split(' ').filter(Boolean);
  if (!parts.length) return false;
  const value = ' ' + normalize(context) + ' ';
  return value.includes(' ' + parts.join(' ') + ' ');
};

export function photoSearchQueries(place) {
  const name=String(place.name || '').replace(/"/g, '').trim();
  const town=String(place.town || '').replace(/"/g, '').trim();
  if(name.length<5 || !town) return [];
  // Do not over-constrain the search index with three AND-ed terms:
  // many valid CC photos have the locality only in tags or description.
  // This broadens discovery, NOT publication; original source and exact
  // place-town identity are still checked by openverseCandidate().
  const queries=[
    '"' + name + '" ' + town,
    name + ' ' + town + ' Tasmania',
    name + ' ' + town,
    '"' + name + '" Tasmania'
  ];
  return [...new Set(queries)];
}

export function openverseCandidate(place, work, checkedAt = new Date().toISOString()) {
  if (!place?.slug || !place?.name || !place?.town || !work || work.mature === true) return null;
  const license=String(work.license || '').toLowerCase();
  if(!PERMITTED.has(license)) return null;
  if(!safeUrl(work.url) || !safeUrl(work.foreign_landing_url) || !safeUrl(work.license_url)) return null;
  // A search index's licence claim is a LEAD only. The exact original must
  // independently establish rights before publication.
  const licenseUrl=new URL(work.license_url);
  if(!['creativecommons.org','www.creativecommons.org'].includes(licenseUrl.hostname))return null;
  const licencePath=licenseUrl.pathname.toLowerCase();
  const expected=license==='by'?'licenses/by/':license==='by-sa'?'licenses/by-sa/':
    license==='cc0'?'publicdomain/zero/':'publicdomain/mark/';
  if(!licencePath.startsWith('/'+expected))return null;
  if(!work.creator || !String(work.creator).trim()) return null;
  if((work.width && Number(work.width)<640) || (work.height && Number(work.height)<400)) return null;
  if(work.category && !PHOTO_TAGS.has(String(work.category).toLowerCase())) return null;
  const title=String(work.title || '').trim();
  const tags=(Array.isArray(work.tags)?work.tags:[]).map(tag=>typeof tag==='string'?tag:tag?.name).filter(Boolean);
  const context=[title,...tags].join(' ');
  if(UNWANTED.test(context) || foreignPlaces.test(context)) return null;
  // Research is intentionally broader than publication: two distinctive
  // name words + the actual town are sufficient to queue a lead for review.
  // Full name + town still gives the strongest evidence. Never auto-publish.
  const exactName=matchedPhrase(context,place.name);
  const words=[...new Set(normalize(place.name).split(' ').filter(token=>
    token.length>=4&&!['the','and','market','restaurant','cafe','shop','beach','park','tasmania'].includes(token)))];
  const hits=words.filter(word=>matchedPhrase(context,word));
  if(!matchedPhrase(context,place.town)) return null;
  if(!exactName&&(!words.length||hits.length<Math.min(2,words.length)))return null;
  const titleStrong=matchedPhrase(title,place.name)&&matchedPhrase(title,place.town);
  const id=String(work.id || '').trim();
  if(!id || id.length>128) return null;
  return {
    id:'openverse:'+id,
    url:work.url,
    sourcePage:work.foreign_landing_url,
    discoveryPage:work.detail_url || 'https://openverse.org',
    title,
    credit:String(work.creator).trim(),
    licence:String(work.license).toUpperCase() + (work.license_version?' '+work.license_version:''),
    licenceUrl:work.license_url,
    provider:work.source || work.provider || 'Openverse',
    width:Number(work.width)||null,
    height:Number(work.height)||null,
    rights:'independent-verification-needed',
    identity:'candidate-not-verified',
    reason:titleStrong?'Exact listing and town in source title':exactName?
      'Full name and town in indexed metadata; verify original':'Distinctive words and town only; identity unverified',
    observedAt:checkedAt
  };
}

export function mergePlacePhotoReview(current, incoming, {maxCandidates=8}={}) {
  const output=structuredClone(current || {});
  let added=0, placesAdded=0;
  for(const [slug,entry] of Object.entries(incoming || {})) {
    if(!entry?.name || !Array.isArray(entry.candidates) || !entry.candidates.length)continue;
    const old=output[slug];
    // Never overwrite a reviewer's decisions or mix entries for another place.
    if(old && old.name!==entry.name)continue;
    if(!old){ output[slug]={name:entry.name,town:entry.town,candidates:[]};placesAdded++; }
    const target=output[slug];
    if(!Array.isArray(target.candidates))target.candidates=[];
    const seen=new Set(target.candidates.map(c=>c.id||c.sourcePage||c.url));
    for(const candidate of entry.candidates) {
      if(!candidate?.id || !candidate?.url || seen.has(candidate.id))continue;
      if(target.candidates.length>=maxCandidates)break;
      target.candidates.push(structuredClone(candidate));
      seen.add(candidate.id);
      added++;
    }
  }
  return {queue:output,added,placesAdded};
}
