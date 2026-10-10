import fs from 'node:fs/promises';

const BASE='https://www.ticketebo.com.au/';
const FILE=new URL('../../src/data/events.json',import.meta.url);
const REPORT=new URL('../../reports/ticketebo-discovery.json',import.meta.url);
const MONTHS=['january','february','march','april','may','june','july','august','september','october','november','december'];
const LOCATIONS=[
 ['Sorell','Hobart & South'],['Hobart','Hobart & South'],['Rosny','Hobart & South'],['Glenorchy','Hobart & South'],['Kingston','Hobart & South'],
 ['Launceston','Launceston & North'],['Devonport','North West'],['Burnie','North West'],['Ulverstone','North West'],['Sheffield','North West'],
 ['Stanley','North West'],['Wynyard','North West'],['Smithton','North West'],['St Helens','East Coast'],['Bicheno','East Coast'],
 ['Queenstown','West Coast'],['Strahan','West Coast'],['Zeehan','West Coast'],['Bothwell','Central Tasmania'],['Oatlands','Central Tasmania'],
 ['Campbell Town','Central Tasmania'],['Whitemark','Flinders Island'],['Currie','King Island']
];
const tidy=s=>String(s||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&(?:nbsp|amp|quot);/gi,' ').replace(/&#\d+;/g,' ').replace(/\s+/g,' ').trim();
const key=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const baseName=s=>String(s||'').split(/\s+\|\s+|\s+[–—]\s+/)[0].trim();
const slug=s=>String(s).toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,90);
const dateNow=()=>{const p=new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Hobart',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const v=t=>p.find(x=>x.type===t)?.value;return v('year')+'-'+v('month')+'-'+v('day');};

export function featuredTicketLinks(html){
 const found=[],seen=new Set();
 for(const match of String(html).matchAll(/<a\b[^>]*href\s*=\s*(["'])(.*?)\1/gi)){
  let u;try{u=new URL(match[2].replace(/&amp;/gi,'&'),BASE);}catch{continue}
  if(!['ticketebo.com.au','www.ticketebo.com.au'].includes(u.hostname))continue;
  const parts=u.pathname.split('/').filter(Boolean);
  if(parts.length!==2||parts.some(part=>/^(about|contact|privacy|terms|search|faq|category|account|blog|help|support|events?)$/i.test(part)))continue;
  if(seen.has(u.pathname))continue;
  seen.add(u.pathname);found.push(u.origin+u.pathname);
  if(found.length>=52)break;
 }
 return found;
}
function datesOf(text){
 const out=[],re=/\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?\s*(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b/gi;
 for(const m of String(text).matchAll(re)){
  const day=Number(m[1]),month=MONTHS.indexOf(m[2].toLowerCase())+1,year=m[3];
  const iso=year+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
  if(day>0&&day<=31&&new Date(iso+'T12:00:00Z').toISOString().slice(0,10)===iso)out.push(iso);
 }
 return [...new Set(out)].sort();
}
export function parseTicketEvent(html,url,today=dateNow()){
 const title=String(html).match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
 const name=title?baseName(tidy(title[1])):'';
 if(name.length<6||name.length>110||/^(?:tickets?|ticketebo|event)\b/i.test(name))return null;
 const text=tidy(html);
 const where=text.match(/\bWHERE\b([\s\S]{0,260}?)\bWHEN\b/i);
 const when=text.match(/\bWHEN\b([\s\S]{0,450}?)(?:\bChoose Items\b|\bAbout\b|\bTicket Type\b|\bBROUGHT TO YOU BY\b)/i)
   ||text.match(/\bWHEN\b([\s\S]{0,220})/i);
 if(!where||!when||!/\bTAS\s*\d{4}\b/i.test(where[1]))return null;
 const match=LOCATIONS.find(([town])=>new RegExp('\\b'+town+'\\b','i').test(where[1]));
 if(!match)return null;
 const dates=datesOf(when[1]);
 const max=new Date(today+'T00:00:00Z');max.setUTCDate(max.getUTCDate()+365);
 if(!dates.length||dates.at(-1)<today||dates[0]>max.toISOString().slice(0,10))return null;
 const [town,region]=match;
 return {
  slug:slug(name+'-'+dates[0]+'-'+town),name,town,region,startDate:dates[0],endDate:dates.at(-1),
  categories:['Events',...(/\b(?:lego|brick|family|kids)\b/i.test(name)?['Family']:[])],
  summary:name+' in '+town+'. Check the organiser for available sessions, tickets and conditions.',
  venue:where[1].trim().slice(0,160),eventUrl:url,sourceUrl:url,sourceName:'Ticketebo',
  image:{url:'/images/categories/events.svg',alt:name+' event category artwork',attribution:'TassieNow',license:'Site artwork',licenseUrl:null,sourceUrl:null,isFallback:true},
  status:'active',lastChecked:today
 };
}
function duplicate(a,b){
 return key(baseName(a.name))===key(baseName(b.name))&&a.region===b.region&&a.endDate>=b.startDate&&b.endDate>=a.startDate;
}
async function fetchHtml(url,fetchPage){
 const response=await fetchPage(url,{headers:{'user-agent':'TassieNow/1.4 (+https://tassienow.com)',accept:'text/html'},signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw new Error('HTTP '+response.status);
 return response.text();
}
export async function discoverTicketebo({fetchPage=fetch,today=dateNow()}={}){
 const report={checkedAt:new Date().toISOString(),source:BASE,candidates:0,checked:0,verified:0,added:0,duplicates:0,unverified:0,errors:[]};
 const existing=JSON.parse(await fs.readFile(FILE,'utf8'));
 try{
  const links=featuredTicketLinks(await fetchHtml(BASE,fetchPage));report.candidates=links.length;
  for(let i=0;i<links.length;i+=5){
   const examined=await Promise.all(links.slice(i,i+5).map(async url=>{
    try{return {event:parseTicketEvent(await fetchHtml(url,fetchPage),url,today)};}
    catch(error){return {error:String(error.message).slice(0,100)};}
   }));
   for(const result of examined){
    report.checked++;
    if(result.error){report.errors.push(result.error);continue;}
    if(!result.event){report.unverified++;continue;}
    report.verified++;
    if(existing.some(old=>duplicate(old,result.event))){report.duplicates++;continue;}
    existing.push(result.event);report.added++;
   }
  }
 }catch(error){report.errors.push('Index: '+error.message);}
 if(report.added){
  existing.sort((a,b)=>a.startDate.localeCompare(b.startDate)||a.name.localeCompare(b.name));
  await fs.writeFile(FILE,JSON.stringify(existing,null,2)+'\n');
 }
 await fs.mkdir(new URL('../../reports/',import.meta.url),{recursive:true});
 await fs.writeFile(REPORT,JSON.stringify(report,null,2)+'\n');
 console.log('Independent Ticketebo discovery: '+JSON.stringify({...report,errors:report.errors.slice(0,4)}));
 return report;
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href)await discoverTicketebo();
