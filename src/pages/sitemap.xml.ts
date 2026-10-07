import places from '../data/places.json';
import events from '../data/events.json';
const slugify=(v:string)=>v.toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const maxDate=(values:string[])=>values.filter(Boolean).sort().at(-1)||new Date().toISOString().slice(0,10);
export async function GET({ site }: { site: URL }) {
  const base=site?.href||'https://tassienow.com/';
  const publicPlaces=places.filter((p:any)=>p.status==='active'&&p.visibility!=='suppressed');
  const activeEvents=events.filter((e:any)=>e.status==='active');
  const catalogueDate=maxDate([...publicPlaces.map((p:any)=>p.lastChecked),...activeEvents.map((e:any)=>e.lastChecked)]);
  const urls=new Map<string,string>();
  const add=(path:string,lastmod=catalogueDate)=>urls.set(new URL(path,base).href,lastmod);
  add('/');add('/about/');
  for(const mode of ['kids','free','rainy-day','today','this-weekend','markets','nature','food'])add(`/discover/${mode}/`);
  for(const p of publicPlaces){add(`/place/${p.slug}/`,p.lastChecked);const townSlug=slugify(p.town),regionSlug=slugify(p.region);const townKey=new URL(`/town/${townSlug}/`,base).href,regionKey=new URL(`/region/${regionSlug}/`,base).href;urls.set(townKey,maxDate([urls.get(townKey)||'',p.lastChecked]));urls.set(regionKey,maxDate([urls.get(regionKey)||'',p.lastChecked]));}
  for(const e of activeEvents){
    add(`/event/${e.slug}/`,e.lastChecked);
    if(e.town){
      const townKey=new URL(`/town/${slugify(e.town)}/`,base).href;
      urls.set(townKey,maxDate([urls.get(townKey)||'',e.lastChecked]));
    }
    if(e.region){
      const regionKey=new URL(`/region/${slugify(e.region)}/`,base).href;
      urls.set(regionKey,maxDate([urls.get(regionKey)||'',e.lastChecked]));
    }
  }
  const body=[...urls.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([url,lastmod])=>`  <url><loc>${url}</loc><lastmod>${lastmod}</lastmod></url>`).join('\n');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`,{headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public, max-age=3600'}});
}
