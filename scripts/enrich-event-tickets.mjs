import fs from 'node:fs/promises';

const FILE = new URL('../src/data/events.json', import.meta.url);
const USER_AGENT = 'TassieNow/1.1 (+https://tassienow.pages.dev)';
const MAX_FETCH = 120;
const PROVIDERS = [
  ['Humanitix', /(^|\.)humanitix\.com$/i],
  ['Eventbrite', /(^|\.)eventbrite\.(?:com|com\.au)$/i],
  ['Ticketmaster', /(^|\.)ticketmaster\.(?:com|com\.au)$/i],
  ['TryBooking', /(^|\.)trybooking\.com$/i],
  ['Moshtix', /(^|\.)moshtix\.com\.au$/i]
];
function tasDate(date = new Date()) { const p=new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Hobart',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date); const g=(t)=>p.find((x)=>x.type===t)?.value; return `${g('year')}-${g('month')}-${g('day')}`; }
const TODAY=tasDate();
const clean=(v='')=>String(v).replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;|&#x27;/gi,"'").replace(/\s+/g,' ').trim();
function validUrl(value){try{const u=new URL(value);return['http:','https:'].includes(u.protocol)?u.href:null;}catch{return null;}}
function providerFromUrl(value=''){try{const host=new URL(value).hostname.replace(/^www\./,'');for(const[name,re]of PROVIDERS)if(re.test(host))return name;return null;}catch{return null;}}
function flatten(value,out=[]){if(!value)return out;if(Array.isArray(value)){value.forEach((x)=>flatten(x,out));return out;}if(typeof value!=='object')return out;const types=Array.isArray(value['@type'])?value['@type']:[value['@type']];if(types.includes('Event'))out.push(value);for(const child of Object.values(value))if(child&&typeof child==='object')flatten(child,out);return out;}
function jsonld(html){const out=[];for(const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{flatten(JSON.parse(match[1].trim()),out);}catch{}}return out;}
function offerData(item){const offers=Array.isArray(item?.offers)?item.offers:item?.offers?[item.offers]:[];for(const offer of offers){if(!offer||typeof offer!=='object')continue;const ticketUrl=validUrl(offer.url);const low=Number(offer.lowPrice??offer.price);const high=Number(offer.highPrice);const availability=typeof offer.availability==='string'?offer.availability.split('/').pop():undefined;return{ticketUrl,priceFrom:Number.isFinite(low)?low:undefined,priceTo:Number.isFinite(high)?high:undefined,priceCurrency:offer.priceCurrency||undefined,availability};}return{};}
function ticketLinks(html,base){const candidates=[];for(const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){let href;try{href=new URL(match[1],base).href;}catch{continue;}const text=clean(match[2]);const provider=providerFromUrl(href);const explicit=/\b(?:ticket|tickets|book|booking|register|buy now|buy tickets|get tickets|purchase)\b/i.test(text);if(provider||explicit)candidates.push({href,provider,text,score:(provider?5:0)+(explicit?3:0)+(/buy|get|book/i.test(text)?1:0)});}return candidates.sort((a,b)=>b.score-a.score);}
async function fetchPage(url){const response=await fetch(url,{headers:{'user-agent':USER_AGENT,accept:'text/html,*/*;q=.8'},redirect:'follow',signal:AbortSignal.timeout(18000)});if(!response.ok)throw new Error(`${response.status} ${response.statusText}`);return{html:await response.text(),finalUrl:response.url};}
function mergeOffer(event,offer){if(offer.ticketUrl&&!event.ticketUrl)event.ticketUrl=offer.ticketUrl;if(offer.priceFrom!==undefined)event.priceFrom=offer.priceFrom;if(offer.priceTo!==undefined)event.priceTo=offer.priceTo;if(offer.priceCurrency)event.priceCurrency=offer.priceCurrency;if(offer.availability)event.availability=offer.availability;if(event.priceFrom===0)event.categories=[...new Set([...(event.categories||[]),'Free'])];}

const events=JSON.parse(await fs.readFile(FILE,'utf8'));
let fetched=0,changed=0;
for(const event of events){
  if(event.status!=='active'||event.endDate<TODAY)continue;
  const directProvider=providerFromUrl(event.ticketUrl||event.eventUrl||'');
  if(directProvider){event.ticketProvider=event.ticketProvider||directProvider;event.ticketUrl=event.ticketUrl||event.eventUrl;}
  const stale=!event.ticketLastChecked||event.ticketLastChecked<TODAY;
  if(!stale||fetched>=MAX_FETCH){if(event.ticketUrl)event.bookingRequired=true;continue;}
  const pageUrl=validUrl(event.eventUrl||event.sourceUrl);if(!pageUrl)continue;
  fetched++;
  try{
    const{html,finalUrl}=await fetchPage(pageUrl);
    const before=JSON.stringify({ticketUrl:event.ticketUrl,ticketProvider:event.ticketProvider,priceFrom:event.priceFrom,priceTo:event.priceTo,priceCurrency:event.priceCurrency,availability:event.availability});
    const structuredEvents=jsonld(html);
    const structured=structuredEvents.find((item)=>clean(item.name||'').toLowerCase()===clean(event.name||'').toLowerCase())||structuredEvents[0];
    if(structured)mergeOffer(event,offerData(structured));
    if(!event.ticketUrl){const link=ticketLinks(html,finalUrl)[0];if(link){event.ticketUrl=link.href;event.ticketProvider=link.provider||providerFromUrl(link.href)||'Booking link';}}
    event.ticketProvider=event.ticketProvider||providerFromUrl(event.ticketUrl||'')||undefined;
    event.bookingRequired=Boolean(event.ticketUrl);
    event.ticketLastChecked=TODAY;
    const after=JSON.stringify({ticketUrl:event.ticketUrl,ticketProvider:event.ticketProvider,priceFrom:event.priceFrom,priceTo:event.priceTo,priceCurrency:event.priceCurrency,availability:event.availability});
    if(before!==after)changed++;
  }catch(error){console.warn(`${event.name}: ticket enrichment skipped (${error.message}).`);}
}
await fs.writeFile(FILE,`${JSON.stringify(events,null,2)}\n`);
console.log(`Ticket enrichment: checked ${fetched} event page(s); updated ticket data for ${changed} event(s).`);
