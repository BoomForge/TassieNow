// Free source-link discovery. These records are hyperlinks, NEVER licences or images.
// Source pages may be linked without copying their photographs.
const normal = value => String(value || '').normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '').replace(/<[^>]*>/g, ' ')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const ignored = new Set(['the','and','of','at','in','a','an','tasmania','tasmanian','2026','2027']);
const tokens = value => normal(value).split(' ').filter(token => token.length > 2 && !ignored.has(token));
const blockedHost = /(?:^|\.)(?:google\.[a-z.]+|googleusercontent\.com|gstatic\.com|facebook\.com|instagram\.com|pinterest\.[a-z.]+|openstreetmap\.org|wikidata\.org|bing\.com|x\.com|tiktok\.com)$/i;
const unwantedImage = /(?:logo|brand|icon|favicon|placeholder|default|no-image|banner-ad|avatar|sprite|map-tile|tracking|pixel|watermark)/i;
const imageExt = /\.(?:jpe?g|png|webp|avif)(?:$|[?#])/i;
const unescape = value => String(value || '').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"')
  .replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>');
function url(value, base) {
  try {
    const result = new URL(unescape(value),base);
    if(result.protocol !== 'https:' || result.username || result.password ||
      !result.hostname.includes('.') || blockedHost.test(result.hostname) ||
      /^(localhost|127\.|10\.|192\.168\.|169\.254\.)/i.test(result.hostname))return null;
    return result.href;
  } catch { return null; }
}
function attrs(tag) {
  const result={};
  for(const m of tag.matchAll(/([a-zA-Z][\w:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g))
    result[m[1].toLowerCase()]=unescape(m[2]??m[3]??m[4]);
  return result;
}
function htmlMeta(html,name) {
  for(const tag of String(html).match(/<meta\b[^>]*>/gi) || []) {
    const a=attrs(tag);
    if((a.property||a.name||'').toLowerCase()===name)return a.content||'';
  }
  return '';
}
function htmlTitle(html) {
  return unescape(String(html).match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'').replace(/<[^>]*>/g,' ').trim();
}
function headline(html) {
  return unescape(String(html).match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||'').replace(/<[^>]*>/g,' ').trim();
}
function matchesName(value, name) {
  const nameTokens=tokens(name.replace(/\b20\d{2}-\d\d-\d\d\b/g,''));
  if(!nameTokens.length)return false;
  const actual=new Set(tokens(value));
  const hits=nameTokens.filter(t=>actual.has(t)).length;
  return hits >= Math.max(1,Math.ceil(nameTokens.length*0.78));
}
function strongIdentity(place,html) {
  const fields=[htmlMeta(html,'og:title'),htmlTitle(html),headline(html)];
  return fields.some(title=>matchesName(title,place.name));
}
function originalPhotoPresent(html, pageUrl, place) {
  const meta=htmlMeta(html,'og:image:secure_url') || htmlMeta(html,'og:image') || htmlMeta(html,'twitter:image');
  const width=Number(htmlMeta(html,'og:image:width'));
  const height=Number(htmlMeta(html,'og:image:height'));
  const photo=url(meta,pageUrl);
  if(photo && imageExt.test(photo) && !unwantedImage.test(new URL(photo).pathname) &&
      (!width || width>=450) && (!height || height>=240))return {method:'original-page-open-graph',imageEvidenceUrl:photo};
  // Site templates sometimes have no OpenGraph. Require an image with meaningful
  // alt text that matches the actual listing, rather than a generic hero or logo.
  for(const tag of String(html).match(/<img\b[^>]*>/gi) || []) {
    const a=attrs(tag),src=url(a.src||a['data-src'],pageUrl);
    const candidateWidth=Number(a.width),candidateHeight=Number(a.height);
    if(src && imageExt.test(src) && !unwantedImage.test(new URL(src).pathname) &&
       matchesName(a.alt,place.name) && (!candidateWidth || candidateWidth>=450) &&
       (!candidateHeight || candidateHeight>=240))
      return {method:'original-page-labelled-image',imageEvidenceUrl:src};
  }
  return null;
}
export function originalSourceCandidates(place) {
  const raw=[place.officialSource?.url,place.website,place.eventUrl,place.sourceUrl];
  return [...new Set(raw.map(link=>url(link)).filter(Boolean))].slice(0,2);
}
export function inspectOriginalPage(place, pageUrl, html, now) {
  const sourceUrl=url(pageUrl);
  if(!sourceUrl || !strongIdentity(place,html))return null;
  const photo=originalPhotoPresent(html,sourceUrl,place);
  if(!photo)return null;
  const hostname=new URL(sourceUrl).hostname.replace(/^www\./,'');
  return {
    sourceUrl, title:'Original photos on '+hostname,
    credit:hostname,kind:'external-source-link',
    discoveryMethod:photo.method,
    evidence:{matchingListing:place.name,originalPage:sourceUrl,checkedAt:now,
      imageFoundOnPage:true},
    checkedAt:now
  };
}
function eligible(record, scans, now, isEvent=false) {
  if(record.status!=='active'||record.visibility==='suppressed'||!record.image?.isFallback||
    !originalSourceCandidates(record).length)return false;
  if(!isEvent && Array.isArray(record.photoLinks) && record.photoLinks.length)return false;
  const last=scans[(isEvent?'event:':'place:')+record.slug]?.checkedAt;
  return !last || new Date(now).getTime()-Date.parse(last)>21*86400000;
}
function sorted(records,scans,type) {
  return records.sort((a,b)=>{
    const x=scans[type+':'+a.slug]?.checkedAt||'',y=scans[type+':'+b.slug]?.checkedAt||'';
    return x.localeCompare(y)||a.name.localeCompare(b.name);
  });
}
export function selectPhotoLinkTargets(places,events,state,limit=120,now=new Date().toISOString()) {
  const scans=state.scans||{},active=places.filter(p=>eligible(p,scans,now));
  const availableEvents=events.filter(e=>eligible(e,scans,now,true));
  const markets=sorted(active.filter(p=>p.categories?.includes('Markets')),scans,'place');
  const food=sorted(active.filter(p=>!p.categories?.includes('Markets')&&p.categories?.includes('Food & Drink')),scans,'place');
  const other=sorted(active.filter(p=>!p.categories?.includes('Markets')&&!p.categories?.includes('Food & Drink')),scans,'place');
  const eventRows=sorted(availableEvents,scans,'event');
  const groups=[
    {type:'place',rows:markets,quota:Math.max(1,Math.floor(limit*0.25))},
    {type:'place',rows:food,quota:Math.max(1,Math.floor(limit*0.40))},
    {type:'event',rows:eventRows,quota:Math.max(1,Math.floor(limit*0.15))},
    {type:'place',rows:other,quota:Math.max(1,Math.floor(limit*0.20))}
  ];
  const selected=[];
  for(const group of groups)for(const row of group.rows.splice(0,group.quota))selected.push({type:group.type,record:row});
  while(selected.length<limit&&groups.some(g=>g.rows.length))
    for(const group of groups)if(selected.length<limit&&group.rows.length)
      selected.push({type:group.type,record:group.rows.shift()});
  return selected.slice(0,limit);
}
export function mergePhotoLinkResearch(current,incoming) {
  const result=structuredClone(current||{version:1,places:{},events:{},scans:{}});
  result.version=1;result.places ||= {};result.events ||= {};result.scans ||= {};
  for(const kind of ['places','events'])for(const [slug,entry] of Object.entries(incoming[kind]||{})) {
    if(!result[kind][slug] || (entry.checkedAt||'')>(result[kind][slug].checkedAt||''))
      result[kind][slug]=structuredClone(entry);
  }
  for(const [key,entry] of Object.entries(incoming.scans||{}))
    if(!result.scans[key] || entry.checkedAt>result.scans[key].checkedAt)
      result.scans[key]=structuredClone(entry);
  result.generatedAt=incoming.generatedAt||result.generatedAt;
  return result;
}
