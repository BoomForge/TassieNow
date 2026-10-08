import fs from 'node:fs/promises';
import { isMarketEvent } from '../../src/lib/market-category.js';

const FILE = new URL('../../src/data/events.json', import.meta.url);
const USER_AGENT = 'TassieNow/1.2 (+https://tassienow.pages.dev)';
const SOURCES = [
  { name: 'East Coast Tasmania', url: 'https://eastcoasttasmania.com/events/', town: 'St Helens', region: 'East Coast', regionalCards: true, structuredOnly: true },
  { name: 'King Island Tourism', url: 'https://kingisland.org.au/events/', town: 'Currie', region: 'King Island', regionalCards: true, structuredOnly: true },
  { name: 'West Coast Tasmania', url: 'https://westcoasttas.com.au/listings/major-events', town: 'Queenstown', region: 'West Coast', regionalCards: true, structuredOnly: true },
  { name: 'Discover Tasmania', url: 'https://www.discovertasmania.com.au/whats-on/', town: 'Tasmania', region: 'Central Tasmania', statewide: true },
  { name: 'Humanitix Hobart', url: 'https://humanitix.com/events/au--hobart--7000', town: 'Hobart', region: 'Hobart & South', ticketProvider: 'Humanitix' },
  { name: 'Humanitix Launceston', url: 'https://humanitix.com/au/events/au--tas--launceston', town: 'Launceston', region: 'Launceston & North', ticketProvider: 'Humanitix' },
  { name: 'Ticketmaster Hobart', url: 'https://www.ticketmaster.com.au/discover/hobart?tt_scene=anchor_view', town: 'Hobart', region: 'Hobart & South', ticketProvider: 'Ticketmaster' },
  { name: 'Eventbrite Hobart', url: 'https://www.eventbrite.com.au/d/australia--hobart/events/', town: 'Hobart', region: 'Hobart & South', ticketProvider: 'Eventbrite' },
  { name: 'Eventbrite Launceston', url: 'https://www.eventbrite.com.au/d/australia--launceston/events/', town: 'Launceston', region: 'Launceston & North', ticketProvider: 'Eventbrite' },
  { name: 'Moshtix Tasmania', url: 'https://www.moshtix.com.au/v2/tas', town: 'Tasmania', region: 'Central Tasmania', ticketProvider: 'Moshtix', statewide: true },
  { name: 'Ticketek Hobart', url: 'https://premier.ticketek.com.au/search/SearchResults.aspx?k=Hobart', town: 'Hobart', region: 'Hobart & South', ticketProvider: 'Ticketek', requireTasContext: true },
  { name: 'Theatre Royal Hobart', url: 'https://www.theatreroyal.com.au/what-s-on', town: 'Hobart', region: 'Hobart & South', officialHostOnly: true },
  { name: 'MyState Bank Arena', url: 'https://www.mystatebankarena.com.au/events', town: 'Glenorchy', region: 'Hobart & South', officialHostOnly: true, structuredOnly: true },
  { name: 'Theatre North Launceston', url: 'https://theatrenorth.com.au/whats-on', town: 'Launceston', region: 'Launceston & North', officialHostOnly: true }
];
const MONTHS = { jan:1,january:1,feb:2,february:2,mar:3,march:3,apr:4,april:4,may:5,jun:6,june:6,jul:7,july:7,aug:8,august:8,sep:9,september:9,sept:9,oct:10,october:10,nov:11,november:11,dec:12,december:12 };
const MONTH = 'Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?';
const DATE_ONLY_NAME = /^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+20\d{2})?$/i;
const TAS_CONTEXT = /\b(?:TAS|Tasmania|Hobart|Bellerive|Glenorchy|Moonah|Sandy Bay|Rosny|Kingston|Launceston|Prospect|Invermay|Burnie|Devonport|Ulverstone|Wynyard|Smithton|Stanley|St Helens|Bicheno|Swansea|Coles Bay|Queenstown|Strahan|Campbell Town|Oatlands|Ross|Bothwell|Hamilton|Ouse|Miena|Tarraleah|Waddamana|Evandale|Richmond|Sorell|Huonville|Cygnet|New Norfolk|Port Arthur|Whitemark|Lady Barron|Flinders Island|Cape Barren Island|Currie|Grassy|Naracoopa|King Island|Zeehan|Rosebery|Tullah|Triabunna|Orford|Scamander|Binalong Bay|Derwent Bridge)\b/i;
const LOCATION_RULES = [
  { town:'Whitemark', region:'Flinders Island', re:/\b(?:Whitemark|Lady Barron|Flinders Island|Cape Barren Island)\b/i },
  { town:'Currie', region:'King Island', re:/\b(?:Currie|Grassy|Naracoopa|King Island)\b/i },
  { town:'Hobart', region:'Hobart & South', re:/\b(?:Hobart|Bellerive|Glenorchy|Moonah|Sandy Bay|Rosny|Kingston|Battery Point|North Hobart|New Town|Claremont|Derwent Park)\b/i },
  { town:'Launceston', region:'Launceston & North', re:/\b(?:Launceston|Prospect|Invermay|Mowbray|Kings Meadows|Evandale|Longford|George Town|Scottsdale|Derby|Bridport|Beaconsfield|Deloraine|Westbury|Mole Creek)\b/i },
  { town:'Devonport', region:'North West', re:/\b(?:Devonport|Burnie|Ulverstone|Penguin|Wynyard|Smithton|Stanley|Latrobe|Sheffield)\b/i },
  { town:'St Helens', region:'East Coast', re:/\b(?:St Helens|Bicheno|Swansea|Coles Bay|Scamander|Orford|Triabunna|Binalong Bay)\b/i },
  { town:'Queenstown', region:'West Coast', re:/\b(?:Queenstown|Strahan|Zeehan|Rosebery|Tullah)\b/i },
  { town:'Campbell Town', region:'Central Tasmania', re:/\b(?:Campbell Town|Oatlands|Ross|Bothwell|Hamilton|Ouse|Miena|Tarraleah|Waddamana|Bronte Park|Derwent Bridge|Lake St Clair|Kempton|Tunbridge)\b/i },
  { town:'Hobart', region:'Hobart & South', re:/\b(?:Richmond|Sorell|Huonville|Cygnet|Geeveston|New Norfolk|Port Arthur|Bruny Island)\b/i }
];
function tasDate(date = new Date()) { const p = new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Hobart',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date); const g=(t)=>p.find((x)=>x.type===t)?.value; return `${g('year')}-${g('month')}-${g('day')}`; }
const TODAY = tasDate();
const horizonDate = new Date(`${TODAY}T00:00:00Z`); horizonDate.setUTCDate(horizonDate.getUTCDate() + 550); const HORIZON = horizonDate.toISOString().slice(0,10);
const slugify=(v)=>String(v).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,90);
const decode=(v='')=>String(v).replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;|&#x27;/gi,"'").replace(/&ndash;|&#8211;/gi,'–').replace(/&mdash;|&#8212;/gi,'—');
const clean=(v='')=>decode(String(v).replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
const norm=(v='')=>clean(v).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function fallback(name){return{url:'/images/categories/events.svg',alt:`${name} event category image`,attribution:'TassieNow',license:'Site artwork',licenseUrl:null,sourceUrl:null,isFallback:true};}
function categories(text='', name=''){const out=['Events'];if(/\bfree\b/i.test(text))out.push('Free');if(/family|kids|children|school holiday/i.test(text))out.push('Family');if(isMarketEvent(name))out.push('Markets');if(/music|concert|gig|festival/i.test(text))out.push('Music');if(/sport|afl|cricket|basketball|run|race|game/i.test(text))out.push('Sport');return[...new Set(out)];}
function providerFromUrl(value=''){try{const host=new URL(value).hostname.replace(/^www\./,'');if(host.endsWith('humanitix.com'))return'Humanitix';if(host.endsWith('eventbrite.com.au')||host.endsWith('eventbrite.com'))return'Eventbrite';if(host.endsWith('ticketmaster.com.au')||host.endsWith('ticketmaster.com'))return'Ticketmaster';if(host.endsWith('trybooking.com'))return'TryBooking';if(host.endsWith('moshtix.com.au'))return'Moshtix';if(host.endsWith('ticketek.com.au'))return'Ticketek';return null;}catch{return null;}}
function inferLocation(text,source){if(!source.statewide)return{town:source.town,region:source.region};for(const rule of LOCATION_RULES)if(rule.re.test(text))return{town:rule.town,region:rule.region};return{town:source.town,region:source.region};}
function iso(day,month,year){const m=MONTHS[String(month).toLowerCase()];if(!m)return null;return`${year}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`;}
function inferYear(day, month){const currentYear=Number(TODAY.slice(0,4));let date=iso(day,month,currentYear);if(date && date < TODAY){const d=new Date(`${date}T00:00:00Z`),t=new Date(`${TODAY}T00:00:00Z`);if((t-d)/(864e5)>45)date=iso(day,month,currentYear+1);}return date;}
function dateRange(text=''){
  const value=clean(text);let m;
  m=value.match(new RegExp(`\\b(\\d{1,2})\\s+(${MONTH})\\s*[-–—]\\s*(\\d{1,2})\\s+(${MONTH})\\s+(20\\d{2})\\b`,'i'));if(m)return{startDate:iso(m[1],m[2],m[5]),endDate:iso(m[3],m[4],m[5])};
  m=value.match(new RegExp(`\\b(\\d{1,2})\\s*[-–—]\\s*(\\d{1,2})\\s+(${MONTH})\\s+(20\\d{2})\\b`,'i'));if(m)return{startDate:iso(m[1],m[3],m[4]),endDate:iso(m[2],m[3],m[4])};
  m=value.match(new RegExp(`\\b(\\d{1,2})\\s+(${MONTH})\\s+(20\\d{2})\\b`,'i'));if(m){const d=iso(m[1],m[2],m[3]);return{startDate:d,endDate:d};}
  m=value.match(new RegExp(`\\b(\\d{1,2})\\s+(${MONTH})\\s*[-–—]\\s*(\\d{1,2})\\s+(${MONTH})\\b`,'i'));if(m){const start=inferYear(m[1],m[2]),end=inferYear(m[3],m[4]);return{startDate:start,endDate:end};}
  m=value.match(new RegExp(`\\b(\\d{1,2})\\s*[-–—]\\s*(\\d{1,2})\\s+(${MONTH})\\b`,'i'));if(m){const start=inferYear(m[1],m[3]),end=inferYear(m[2],m[3]);return{startDate:start,endDate:end};}
  m=value.match(new RegExp(`\\b(${MONTH})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,)?\\s+(20\\d{2})\\b`,'i'));if(m){const d=iso(m[2],m[1],m[3]);return{startDate:d,endDate:d};}
  m=value.match(new RegExp(`\\b(\\d{1,2})\\s+(${MONTH})\\b`,'i'));if(m){const d=inferYear(m[1],m[2]);return{startDate:d,endDate:d};}
  m=value.match(new RegExp(`\\b(${MONTH})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`,'i'));if(m){const d=inferYear(m[2],m[1]);return{startDate:d,endDate:d};}
  return null;
}
function validRange(r){return r?.startDate&&r?.endDate&&r.endDate>=TODAY&&r.startDate<=HORIZON;}
function plausibleName(value=''){const name=clean(value).replace(/\b(?:find|buy|get|view|book)\s+tickets?\b/gi,'').trim();if(name.length<4||name.length>130||DATE_ONLY_NAME.test(name))return false;if(/^(?:home|events?|today|this weekend|tickets?|learn more|read more|see all|save|share|more)\b/i.test(name))return false;if(!/[a-z]{3}/i.test(name))return false;return true;}
function finalName(value=''){return clean(value).replace(/\b(?:find|buy|get|view|book)\s+tickets?\b/gi,'').replace(/^[-–—|: ]+|[-–—|: ]+$/g,'').slice(0,130).trim();}
function titleFromEventUrl(value=''){
  try{
    let leaf=decodeURIComponent(new URL(value).pathname.split('/').filter(Boolean).at(-1)||'').replace(/-(?:2|3)$/,'');
    const special={nz:'NZ',se:'SE',abba:'ABBA',afl:'AFL',nbl:'NBL',wnbl:'WNBL',jackjumpers:'JackJumpers'};
    return leaf.split('-').filter(Boolean).map((token,index)=>token==='v'?'v':special[token.toLowerCase()]||(/^\d/.test(token)?token:token.charAt(0).toUpperCase()+token.slice(1))).join(' ').replace(/\s+/g,' ').trim();
  }catch{return'';}
}
function dateValue(value){if(!value)return null;const d=new Date(value);return Number.isNaN(d.valueOf())?null:d.toISOString().slice(0,10);}
function flatten(value,out=[]){if(!value)return out;if(Array.isArray(value)){value.forEach((x)=>flatten(x,out));return out;}if(typeof value!=='object')return out;const types=Array.isArray(value['@type'])?value['@type']:[value['@type']];if(types.includes('Event'))out.push(value);for(const child of Object.values(value))if(child&&typeof child==='object')flatten(child,out);return out;}
function jsonld(html){const out=[];for(const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{flatten(JSON.parse(match[1].trim()),out);}catch{}}return out;}
function offersFrom(event){const offers=Array.isArray(event?.offers)?event.offers:event?.offers?[event.offers]:[];const offer=offers.find((item)=>item&&typeof item==='object')||null;if(!offer)return{};const ticketUrl=offer.url||null;const rawPrice=offer.lowPrice??offer.price??null;const high=offer.highPrice??null;return{ticketUrl,priceFrom:Number.isFinite(Number(rawPrice))?Number(rawPrice):undefined,priceTo:Number.isFinite(Number(high))?Number(high):undefined,priceCurrency:offer.priceCurrency?String(offer.priceCurrency).toUpperCase():undefined,availability:typeof offer.availability==='string'?offer.availability.split('/').pop():undefined};}
function makeEvent({name,source,startDate,endDate,town,region,venue,eventUrl,description='',offer={}}){const cleanName=finalName(name);if(!plausibleName(cleanName)||!validRange({startDate,endDate}))return null;const provider=source.ticketProvider||providerFromUrl(offer.ticketUrl)||providerFromUrl(eventUrl);const ticketUrl=offer.ticketUrl||(provider?eventUrl:null);const result={slug:slugify(`${cleanName}-${startDate}-${town||source.town}`),name:cleanName,town:town||source.town,region:region||source.region,startDate,endDate,categories:categories(`${cleanName} ${description}`, cleanName),summary:description?clean(description).slice(0,300):`${cleanName} in ${town||source.town}. Check the source for current times, venue details and availability.`,venue:venue||undefined,eventUrl:eventUrl||source.url,sourceUrl:source.url,sourceName:source.name,image:fallback(cleanName),status:'active',lastChecked:TODAY};if(ticketUrl)result.ticketUrl=ticketUrl;if(provider)result.ticketProvider=provider;for(const key of ['priceFrom','priceTo','priceCurrency','availability'])if(offer[key]!==undefined)result[key]=offer[key];if(result.priceFrom===0)result.categories=[...new Set([...result.categories,'Free'])];return result;}
async function fetchHtml(url){const response=await fetch(url,{headers:{'user-agent':USER_AGENT,accept:'text/html,*/*;q=.8'},redirect:'follow',signal:AbortSignal.timeout(35000)});if(!response.ok)throw new Error(`${response.status} ${response.statusText}`);return{html:await response.text(),finalUrl:response.url};}
function structuredEvents(html,source){const out=[];for(const item of jsonld(html)){const startDate=dateValue(item.startDate),endDate=dateValue(item.endDate||item.startDate);if(!validRange({startDate,endDate}))continue;const address=item.location?.address||{};const description=clean(item.description||'').slice(0,300);const inferred=inferLocation(`${clean(address.addressLocality||'')} ${clean(item.location?.name||'')} ${description}`,source);const town=clean(address.addressLocality||inferred.town)||inferred.town;const venue=clean(item.location?.name||'');const offer=offersFrom(item);const event=makeEvent({name:item.name,source,startDate,endDate,town,region:inferred.region,venue,eventUrl:item.url||offer.ticketUrl||source.url,description,offer});if(event)out.push(event);}return out;}
function regionalListingEvents(html,source){
  const out=[];
  const anchors=[...html.matchAll(/<a\\b[^>]*href=["']([^"']+)["'][^>]*>([\\s\\S]*?)<\\/a>/gi)];
  for(let i=0;i<anchors.length;i++){
    const anchor=anchors[i];let href;
    try{href=new URL(decode(anchor[1]),source.url).href;}catch{continue;}
    const url=new URL(href),host=new URL(source.url).hostname;
    if(url.hostname!==host)continue;
    if(source.name==='East Coast Tasmania'&&!/^\\/atdw_events\\/[^/]+\\/?$/.test(url.pathname))continue;
    if(source.name==='King Island Tourism'&&!/^\\/events\\/[^/]+\\/?$/.test(url.pathname))continue;
    if(source.name==='West Coast Tasmania'&&!/^\\/listings\\/[^/]+\\/?$/.test(url.pathname))continue;
    const inner=clean(anchor[2]);
    const name=source.name==='King Island Tourism'?titleFromEventUrl(href):finalName(inner);
    if(!plausibleName(name))continue;
    const sliceEnd=Math.min(html.length,anchor.index+anchor[0].length+500);
    const nearby=clean(html.slice(anchor.index,sliceEnd));
    // Require an explicit year and nearby date. Recurring/monthly text is not a dated event.
    const date=dateRange(nearby);
    if(!validRange(date))continue;
    const event=makeEvent({name,source,startDate:date.startDate,endDate:date.endDate,town:source.town,region:source.region,eventUrl:href,description:''});
    if(event)out.push(event);
  }
  return out;
}
function anchorEvents(html,source){const out=[];for(const anchor of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){let href;try{href=new URL(decode(anchor[1]),source.url).href;}catch{continue;}const provider=providerFromUrl(href);if(source.ticketProvider&&!provider)continue;if(source.name==='Discover Tasmania'&&!new URL(href).hostname.endsWith('discovertasmania.com.au'))continue;let name=finalName(anchor[2]);if(!plausibleName(name)&&source.officialHostOnly)name=titleFromEventUrl(href);if(!plausibleName(name))continue;const around=html.slice(Math.max(0,anchor.index-700),anchor.index+anchor[0].length+850);const context=clean(around);if(source.requireTasContext&&!TAS_CONTEXT.test(context))continue;const range=dateRange(context);if(!validRange(range))continue;const inferred=inferLocation(context,source);const description=context.slice(0,300);const event=makeEvent({name,source,startDate:range.startDate,endDate:range.endDate,town:inferred.town,region:inferred.region,eventUrl:href,description,offer:{ticketUrl:source.ticketProvider?href:null}});if(event)out.push(event);}return out;}
function preference(event){let score=0;if(event.ticketUrl)score+=6;if(event.venue)score+=2;if(event.summary&&!/Check the source/i.test(event.summary))score+=1;if(event.eventUrl!==event.sourceUrl)score+=2;if(event.town&&event.town!=='Tasmania')score+=1;return score;}
function dedupe(items){const out=[];for(const event of items){const name=norm(event.name);let index=-1;for(let i=0;i<out.length;i++){const other=out[i];if(other.startDate!==event.startDate)continue;const on=norm(other.name);if(name===on||(name.length>=9&&on.length>=9&&(name.includes(on)||on.includes(name)))){index=i;break;}}if(index<0)out.push(event);else if(preference(event)>preference(out[index]))out[index]={...out[index],...event};}return out;}

const previous=JSON.parse(await fs.readFile(FILE,'utf8')).filter((event)=>event.status==='active'&&event.endDate>=TODAY);
const found=[];
for(const source of SOURCES){try{const{html}=await fetchHtml(source.url);const structured=structuredEvents(html,source);const anchors=source.regionalCards?regionalListingEvents(html,source):(source.structuredOnly?[]:anchorEvents(html,source));const events=dedupe([...structured,...anchors]);found.push(...events);console.log(`${source.name}: ${events.length} high-confidence event(s) (${structured.length} structured, ${anchors.length} linked).`);}catch(error){console.warn(`${source.name}: skipped (${error.message}).`);}}
const merged=dedupe([...previous,...found]).sort((a,b)=>a.startDate.localeCompare(b.startDate)||a.name.localeCompare(b.name));
await fs.writeFile(FILE,`${JSON.stringify(merged,null,2)}\n`);
console.log(`Public event sources: ${found.length} discoveries merged; ${merged.length} active events total.`);
