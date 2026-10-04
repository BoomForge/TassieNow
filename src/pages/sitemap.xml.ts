import places from '../data/places.json';
import events from '../data/events.json';
const slugify=(v:string)=>v.toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export async function GET({ site }: { site: URL }) {
  const base=site?.href||'https://tassienow.pages.dev/';
  const urls=new Set<string>([new URL('/',base).href,new URL('/about/',base).href]);
  for(const mode of ['kids','free','rainy-day','today','this-weekend','markets','nature','food'])urls.add(new URL(`/discover/${mode}/`,base).href);
  const active=places.filter((p:any)=>p.status==='active');
  active.forEach((p:any)=>{urls.add(new URL(`/place/${p.slug}/`,base).href);urls.add(new URL(`/town/${slugify(p.town)}/`,base).href);urls.add(new URL(`/region/${slugify(p.region)}/`,base).href);});
  events.filter((e:any)=>e.status==='active').forEach((e:any)=>urls.add(new URL(`/event/${e.slug}/`,base).href));
  const body=[...urls].sort().map((url)=>`  <url><loc>${url}</loc></url>`).join('\n');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`,{headers:{'Content-Type':'application/xml; charset=utf-8'}});
}
