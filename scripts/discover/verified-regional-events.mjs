import fs from 'node:fs/promises';

// Handpicked high-confidence official source routes, not a fabricated
// calendar. Every proposed record is published only if the LIVE organiser
// page still names the event and explicitly states its 2026 dates.
export const SOURCES=[
  {name:'West Coast Heritage Centre',url:'https://wchczeehan.com.au/events/',
    event:'Zeehan Heritage and Mineral Fair 2026',
    title:/Heritage and Mineral Fair/i,
    date:/7(?:th)?\s+and\s+8(?:th)?\s+of\s+November\s+2026/i,
    startDate:'2026-11-07',endDate:'2026-11-08',town:'Zeehan',region:'West Coast',
    venue:'West Coast Heritage Centre, Zeehan',description:'Heritage and mineral fair in Zeehan. Check the organiser for programme, opening hours and any booking requirements.'},
  {name:'Highlands BushFest organising team',url:'https://form.jotform.com/261237457215860',
    event:'Highlands BushFest 2026',title:/HIGHLANDS\s+BUSHFEST\s+2026/i,
    date:/Saturday\s+21\s+and\s+Sunday\s+22\s+November\s+2026/i,
    startDate:'2026-11-21',endDate:'2026-11-22',town:'Bothwell',region:'Central Tasmania',
    venue:'Bothwell, Tasmania',description:'An outdoors and regional-life festival in Bothwell, including demonstrations, workshops, food, crafts and small producers. Confirm visiting details with organisers.'},
  {name:'Zeehan Neighbourhood Centre',url:'https://www.zeehannc.org.au/',
    event:'Memories of the West Coast Morning',
    title:/Memories of the West Coast Morning/i,
    date:/14\s+October\s+2026/i,
    startDate:'2026-10-14',endDate:'2026-10-14',town:'Zeehan',region:'West Coast',
    venue:'Somer House, Zeehan Neighbourhood Centre',description:'Seniors Week morning of shared West Coast memories at Somer House. Check organiser details before visiting.'}
];
const norm=x=>String(x).toLowerCase().replace(/[^a-z0-9]/g,'');
const slug=x=>String(x).toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,90);
const clean=x=>String(x).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();
export function verifiedRegionalEvent(source,html,today){
  const text=clean(html);
  if(source.endDate<today||!source.title.test(text)||!source.date.test(text))return null;
  return {
    slug:slug(source.event+'-'+source.startDate+'-'+source.town),
    name:source.event,town:source.town,region:source.region,
    startDate:source.startDate,endDate:source.endDate,
    categories:['Events',...(source.event.includes('Fair')?['Markets']:[])],
    summary:source.description,venue:source.venue,eventUrl:source.url,sourceUrl:source.url,
    sourceName:source.name,
    image:{url:'/images/categories/events.svg',alt:source.event+' category artwork',attribution:'TassieNow',license:'Site artwork',licenseUrl:null,sourceUrl:null,isFallback:true},
    status:'active',lastChecked:today
  };
}
export async function enrichVerifiedRegionals({readFile=fs.readFile,writeFile=fs.writeFile,fetchPage=fetch,today}={}){
  const date=today||new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Hobart',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const file=new URL('../../src/data/events.json',import.meta.url);
  const stored=JSON.parse(await readFile(file,'utf8'));
  const report={checkedAt:new Date().toISOString(),sources:[],added:0,updated:0,failed:0};
  let changed=false;
  for(const source of SOURCES){
    if(source.endDate<date)continue;
    let html;
    try{
      const response=await fetchPage(source.url,{headers:{'user-agent':'TassieNow/1.2 (+https://tassienow.com)',accept:'text/html'},signal:AbortSignal.timeout(18000)});
      if(!response.ok)throw new Error('HTTP '+response.status);
      html=await response.text();
    }catch(error){report.sources.push({name:source.name,status:'fetch-failed',error:String(error.message).slice(0,100)});report.failed++;continue;}
    const record=verifiedRegionalEvent(source,html,date);
    if(!record){report.sources.push({name:source.name,status:'missing-date-or-identity',expected:source.event,dates:source.startDate+'/'+source.endDate});continue;}
    const existing=stored.find(x=>x.slug===record.slug||(x.startDate===record.startDate&&x.region===record.region&&norm(x.name)===norm(record.name)));
    if(existing){
      // Never clobber curated metadata, images, ticket URLs or newer organiser evidence.
      if(!existing.lastChecked || existing.lastChecked<date){existing.lastChecked=date;changed=true;report.updated++;}
      report.sources.push({name:source.name,status:'already-listed',slug:existing.slug});
    }else{stored.push(record);changed=true;report.added++;report.sources.push({name:source.name,status:'verified-new',slug:record.slug});}
  }
  if(changed){stored.sort((a,b)=>a.startDate.localeCompare(b.startDate)||a.name.localeCompare(b.name));await writeFile(file,JSON.stringify(stored,null,2)+'\n');}
  await fs.mkdir(new URL('../../reports/',import.meta.url),{recursive:true});
  await fs.writeFile(new URL('../../reports/regional-events-evidence.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
  console.log('Verified official regional events: '+JSON.stringify(report));
  return report;
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href)await enrichVerifiedRegionals();
