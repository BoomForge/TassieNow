// Commons file titles must identify the actual event, not merely an opponent,
// city, venue, sculpture or a generic activity that happens to share a keyword.
const GENERIC_EVENT_WORDS=new Set([
 'the','and','for','with','tasmania','tasmanian','hobart','launceston',
 'devonport','burnie','festival','event','show','market','annual',
 'concert','exhibition','community','activities','workshop','tickets',
 'at','in','on','to','of','vs','v'
]);
const normalizedWords=value=>String(value||'').normalize('NFKD').toLowerCase()
 .replace(/[\u0300-\u036f]/g,'').split(/[^a-z0-9]+/).filter(Boolean);
export function eventTitleMatchesFile(eventName,fileTitle){
 const fileWords=normalizedWords(fileTitle.replace(/^File:/i,'').replace(/\.[^.]+$/,''));
 const file=new Set(fileWords);
 const name=normalizedWords(eventName);
 const distinctive=[...new Set(name.filter(word=>word.length>=3 && !GENERIC_EVENT_WORDS.has(word) && !/^20\d{2}$/.test(word)))];
 if(!distinctive.length)return false;
 // Single-keyword names (e.g. Brixhibition) require the entire named event
 // phrase, not one broad keyword in a photograph of something else.
 if(distinctive.length===1){
  const full=name.filter(word=>!/^20\d{2}$/.test(word));
  if(!full.every(word=>file.has(word)))return false;
 }else if(!distinctive.every(word=>file.has(word)))return false;
 // A year appearing in a filename must agree with an explicit event year.
 const eventYear=name.find(word=>/^20\d{2}$/.test(word));
 const picturedYears=fileWords.filter(word=>/^20\d{2}$/.test(word));
 if(eventYear && picturedYears.length && !picturedYears.includes(eventYear))return false;
 if(/\b(?:logo|poster|advertisement|screenshot|sculpture|statue|venue|signage|banner|map)\b/i.test(fileTitle))return false;
 return true;
}

// Earlier editions may be used when the source explicitly names the same
// event series. Year is handled separately and always disclosed.
const seriesStop=new Set(['the','and','of','at','in','for','with','v','vs','festival',
 'show','event','annual','concert','exhibition','market','2026','2027','2028']);
export function eventSeriesMatchesFile(eventName,fileTitle){
 const identity=[...new Set(normalizedWords(eventName)
   .filter(w=>w.length>=3&&!/^20\d{2}$/.test(w)&&!seriesStop.has(w)))];
 const words=new Set(normalizedWords(fileTitle.replace(/^File:/i,'')));
 const distinctive=identity.filter(w=>!['tasmania','tasmanian','hobart','launceston','sorell','devonport','burnie'].includes(w));
 if(!distinctive.length||!distinctive.every(word=>words.has(word)))return false;
 // A single distinctive word needs extra brand/location context, except when
 // it is an unusually specific identity such as Brixhibition.
 if(distinctive.length===1&&distinctive[0].length<9)
   return identity.some(w=>w!==distinctive[0]&&words.has(w));
 return true;
}

// Event image provenance and source-preservation utilities.
// Metadata is not permission: retain organizer image previews for review
// unless an explicit, verifiable re-use grant exists.
export const fallback = image=>!image?.url||image.isFallback===true;
export function imageIsPublishable(image){
  if(fallback(image))return false;
  if(!image?.attribution||!image?.license||!/^https:\/\//i.test(image.url))return false;
  if(image.sourceMethod==='commons-event') {
    if(!image.matchEvidence?.verified || !image.matchEvidence.eventName ||
       !image.matchEvidence.sourceFileTitle)return false;
    const matched=image.mediaType
      ? (image.mediaType==='contextual'
          ? Boolean(image.caption && image.matchEvidence.verifiedType==='contextual' &&
              image.matchEvidence.sourceFilePage?.startsWith('https://'))
          : eventSeriesMatchesFile(image.matchEvidence.eventName,image.matchEvidence.sourceFileTitle))
      : eventTitleMatchesFile(image.matchEvidence.eventName,image.matchEvidence.sourceFileTitle);
    if(!matched)return false;
    if(['historical-event','contextual'].includes(image.mediaType)&&!image.caption)return false;
  }
  if(image.sourceMethod==='verified-event-venue' &&
    (image.mediaType!=='contextual'||!image.caption||!image.matchEvidence?.verified||
     !image.matchEvidence?.venue||!image.matchEvidence?.town||
     !image.matchEvidence?.sourceFilePage?.startsWith('https://')))return false;
  if(image.sourceMethod==='organiser-approved') {
    const p=image.permissionEvidence;
    if(image.usagePermission!=='granted' || !image.matchEvidence?.verified ||
       !p?.grantedBy || !p?.verifiedAt || !p?.evidenceUrl?.startsWith('https://') ||
       !p?.scope?.includes('TassieNow'))return false;
    if(['historical-event','contextual'].includes(image.mediaType)&&!image.caption)return false;
  }
  return permittedLicence(image.license,image.licenseUrl)||
    (image.sourceMethod==='organiser-approved'&&image.usagePermission==='granted');
}
export function eventImagePriority(image){
 if(!imageIsPublishable(image))return 0;
 if(image.sourceMethod==='organiser-approved')return 10;
 return ({'event-photo':9,'official-artwork':8,'event-artwork':7,
  'historical-event':6,'contextual':3})[image.mediaType]||8;
}
const norm=s=>String(s||'').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g,'');
export function sameEvent(a,b){
  return a.slug===b.slug||
    (norm(a.name)===norm(b.name)&&a.startDate===b.startDate&&
     a.town===b.town);
}
export function preserveEventImages(current,previous){
  let kept=0;
  for(const event of current){
    const old=previous.find(p=>sameEvent(p,event)&&imageIsPublishable(p.image));
    if(old && eventImagePriority(old.image)>eventImagePriority(event.image)) {
      event.image=structuredClone(old.image);
      if(Array.isArray(old.gallery)&&!event.gallery?.length)event.gallery=structuredClone(old.gallery);
      kept++;
    }
  }
  return kept;
}
export function permittedLicence(name,link){
  // CC attribution licences and public domain only. Copyright status alone
  // is not a reusable licence, nor is simply having an OG image.
  const n=String(name||'').toLowerCase();
  if(/(?:non.?commercial|no.?derivatives|cc.?by.?nc|cc.?by.?nd|all rights reserved)/.test(n))return false;
  const u=String(link||'').toLowerCase();
  if(/^(?:cc0|public domain|cc by(?:-sa)?(?: \d(?:\.\d)?)?)$/.test(n))return true;
  return /creativecommons\.org\/(?:licenses\/by(?:-sa)?\/|publicdomain\/zero\/)/.test(u);
}
export function metaImageCandidates(html,base){
  const attrs=tag=>Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gi)].map(m=>[m[1].toLowerCase(),m[3].replace(/&amp;/g,'&')]));
  const candidates=[];
  for(const tag of String(html).match(/<meta\b[^>]*>/gi)||[]){
    const a=attrs(tag);
    if(!/^(?:og:image(?::url)?|twitter:image)$/i.test(a.property||a.name||''))continue;
    if(a.content)candidates.push({url:a.content,source:'social-preview'});
  }
  for(const tag of String(html).match(/<img\b[^>]*>/gi)||[]){
    const a=attrs(tag);
    if(a.src)candidates.push({url:a.src,alt:a.alt||'',source:'on-page-gallery'});
  }
  const root=new URL(base),seen=new Set();
  return candidates.flatMap(candidate=>{
    try{
      const url=new URL(candidate.url,base);
      if(url.protocol!=='https:'||!/\.(?:png|jpe?g|webp)(?:$|\?)/i.test(url.pathname+url.search))return [];
      if(/favicon|avatar|social-icon|logo|sprite|pixel|tracking|blank|placeholder|transparent|banner-ad/i.test(url.pathname))return [];
      // Local organiser imagery only; arbitrary third-party CDNs need manual vetting.
      if(url.hostname!==root.hostname && !url.hostname.endsWith('.'+root.hostname))return [];
      if(seen.has(url.href))return [];
      seen.add(url.href);
      return [{...candidate,url:url.href,sourcePage:base,rights:'permission-needed'}];
    }catch{return [];}
  }).slice(0,12);
}
