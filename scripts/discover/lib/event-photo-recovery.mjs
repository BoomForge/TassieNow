// A focused, rights-safe event photo recovery pass. Web images on original
// pages are leads only: presence on the page is not a licence to copy/embed.
import {metaImageCandidates} from './event-media.mjs';

const attrs=tag=>Object.fromEntries([...String(tag).matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gi)]
  .map(m=>[m[1].toLowerCase(),m[3].replace(/&amp;/gi,'&')]));
const blocked=/(?:favicon|avatar|social-icon|logo|sprite|pixel|tracking|blank|placeholder|transparent|banner-ad|google-analytics)/i;
const imageExt=/\.(?:jpe?g|png|webp|avif)(?:$|[?#])/i;
function validPhotoUrl(raw,page){
  try{
    const u=new URL(raw,page);
    if(u.protocol!=='https:'||u.username||u.password||blocked.test(u.pathname)||
       !imageExt.test(u.href)||/^(?:localhost|127\.|10\.|192\.168\.)/i.test(u.hostname))return null;
    return u.href;
  }catch{return null;}
}
export function researchOfficialEventImages(html,pageUrl){
  // Existing strict same-host matcher first; supplement with official page
  // lazy-loading and third-party media CDNs for the *unapproved review queue*.
  const found=metaImageCandidates(html,pageUrl);
  const seen=new Set(found.map(c=>c.url));
  const append=(raw,source,alt='')=>{
    const url=validPhotoUrl(raw,pageUrl);
    if(!url||seen.has(url))return;
    seen.add(url);
    found.push({url,source,alt,sourcePage:pageUrl,rights:'permission-needed',
      identity:'original-page-asset-unverified',
      externalAssetHost:new URL(url).hostname!==new URL(pageUrl).hostname});
  };
  for(const tag of String(html||'').match(/<meta\b[^>]*>/gi)||[]){
    const a=attrs(tag),field=a.property||a.name||'';
    if(/^(?:og:image(?::url|:secure_url)?|twitter:image(?::src)?)$/i.test(field))
      append(a.content,'original-page-social-preview');
  }
  for(const tag of String(html||'').match(/<img\b[^>]*>/gi)||[]){
    const a=attrs(tag);
    for(const key of ['src','data-src','data-lazy-src','data-original','data-image-src']){
      if(a[key])append(a[key],'original-page-img',a.alt||'');
    }
    for(const key of ['srcset','data-srcset']){
      const raw=a[key];
      if(raw)for(const src of raw.split(',').slice(-2)){
        const url=src.trim().split(/\s+/)[0];
        if(url)append(url,'original-page-srcset',a.alt||'');
      }
    }
  }
  return found.slice(0,20);
}
export function selectEventPhotoRecoveryTargets(events,{today,limit=25,sourceLinks={},review={},slot=0}={}){
  const eligible=events.filter(e=>e.status==='active'&&e.endDate>=today&&e.needsRecovery!==false);
  const nearEnd=new Date(Date.parse(today+'T00:00:00Z')+30*86400000).toISOString().slice(0,10);
  const urgent=eligible.filter(e=>e.startDate<=nearEnd);
  const byDate=(a,b)=>a.endDate.localeCompare(b.endDate)||a.startDate.localeCompare(b.startDate);
  // Known original-image sources with no candidate are the highest-value
  // recovery debt; prioritise these before speculative image search.
  const missingQueue=urgent.filter(e=>sourceLinks[e.slug]?.evidence?.imageFoundOnPage===true&&
    !(review[e.slug]?.candidates||[]).some(c=>Boolean(c.url))).sort(byDate);
  const result=missingQueue.slice(0,Math.min(limit,Math.ceil(limit*.6)));
  const rotate=(xs)=>{if(!xs.length)return xs;const start=(slot*limit)%xs.length;return [...xs.slice(start),...xs.slice(0,start)];};
  const remaining=eligible.filter(e=>!result.includes(e));
  const add=items=>{for(const e of items)if(result.length<limit&&!result.includes(e))result.push(e);};
  add(rotate(remaining.filter(e=>e.startDate<=nearEnd)));
  add(rotate(remaining.filter(e=>e.startDate>nearEnd)));
  return result.slice(0,limit);
}
