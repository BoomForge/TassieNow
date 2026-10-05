import fs from 'node:fs/promises';

const FILE = new URL('../src/data/events.json', import.meta.url);
const USER_AGENT = 'TassieNow/1.3 (+https://tassienow.pages.dev)';
const MAX_FETCH = 120;
const MAX_TICKET_FETCH = 90;
const PROVIDERS = [
  ['Humanitix', /(^|\.)humanitix\.com$/i],
  ['Eventbrite', /(^|\.)eventbrite\.(?:com|com\.au)$/i],
  ['Ticketmaster', /(^|\.)ticketmaster\.(?:com|com\.au)$/i],
  ['TryBooking', /(^|\.)trybooking\.com$/i],
  ['Moshtix', /(^|\.)moshtix\.com\.au$/i],
  ['Ticketek', /(^|\.)ticketek\.com\.au$/i],
  ['Rezdy', /(^|\.)rezdy\.com$/i]
];
const TICKET_FIELDS = ['ticketUrl','ticketProvider','priceFrom','priceTo','priceCurrency','availability','bookingRequired','ticketLastChecked'];
const EXACT_BOOKING_TEXT = /^(?:tickets?|book(?: now| here| online)?|book tickets?|buy tickets?|get tickets?|find tickets?|purchase tickets?|register(?: now| here)?|registrations?|rsvp(?: now)?|reserve(?: now)?|make a booking)$/i;
const BAD_BOOKING_TEXT = /\b(?:dog|pet|animal|rates|parking|bin|waste|library card|membership|venue hire|facility hire|planning|permit|licen[cs]e)\b/i;

function tasDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Hobart',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
const TODAY = tasDate();
const clean = (value='') => String(value)
  .replace(/<[^>]*>/g,' ')
  .replace(/&nbsp;|&#160;/gi,' ')
  .replace(/&amp;/gi,'&')
  .replace(/&quot;/gi,'"')
  .replace(/&#39;|&apos;|&#x27;/gi,"'")
  .replace(/\s+/g,' ')
  .trim();
function validUrl(value){try{const u=new URL(value);return['http:','https:'].includes(u.protocol)?u.href:null;}catch{return null;}}
function providerFromUrl(value=''){
  try{
    const host = new URL(value).hostname.replace(/^www\./,'');
    for(const [name,re] of PROVIDERS) if(re.test(host)) return name;
    return null;
  }catch{return null;}
}
function isSpecificTicketUrl(value=''){
  const url = validUrl(value); if(!url) return false;
  const parsed = new URL(url), host = parsed.hostname.replace(/^www\./,''), path = `${parsed.pathname}${parsed.search}`;
  const provider = providerFromUrl(url);
  if(!provider) return false;
  if(provider === 'Humanitix') return host.startsWith('events.') || (!/^\/(?:events\/au--|au\/events(?:\/|$))/i.test(parsed.pathname) && parsed.pathname.length > 2);
  if(provider === 'Eventbrite') return /\/e\//i.test(parsed.pathname);
  if(provider === 'Ticketmaster') return /\/event\//i.test(parsed.pathname);
  if(provider === 'TryBooking') return /\/events\/(?:landing\/)?\d+/i.test(parsed.pathname) || /\/events\/landing\//i.test(parsed.pathname);
  if(provider === 'Moshtix') return /\/v2\/event\//i.test(parsed.pathname);
  if(provider === 'Ticketek') return /\/shows\/show\.aspx/i.test(path) || /\beventid=/i.test(path);
  if(provider === 'Rezdy') return parsed.pathname.length > 4 && /\d/.test(parsed.pathname);
  return false;
}
function sameUrl(a,b){try{const x=new URL(a),y=new URL(b);return x.origin===y.origin&&x.pathname.replace(/\/$/,'')===y.pathname.replace(/\/$/,'');}catch{return false;}}
function flatten(value,out=[]){
  if(!value) return out;
  if(Array.isArray(value)){value.forEach((x)=>flatten(x,out));return out;}
  if(typeof value!=='object') return out;
  const types=Array.isArray(value['@type'])?value['@type']:[value['@type']];
  if(types.includes('Event')) out.push(value);
  for(const child of Object.values(value)) if(child&&typeof child==='object') flatten(child,out);
  return out;
}
function jsonld(html){
  const out=[];
  for(const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
    try{flatten(JSON.parse(match[1].trim()),out);}catch{}
  }
  return out;
}
function offerData(item,pageUrl){
  const offers=Array.isArray(item?.offers)?item.offers:item?.offers?[item.offers]:[];
  for(const offer of offers){
    if(!offer||typeof offer!=='object') continue;
    const candidate = validUrl(offer.url) || (isSpecificTicketUrl(pageUrl)?validUrl(pageUrl):null);
    if(!candidate || !isSpecificTicketUrl(candidate)) continue;
    const currency = offer.priceCurrency ? String(offer.priceCurrency).toUpperCase() : undefined;
    // Tasmania-facing sources should be AUD. Reject foreign/default schema prices rather than publishing bad money data.
    const allowPrice = !currency || currency === 'AUD';
    const low = allowPrice ? Number(offer.lowPrice ?? offer.price) : Number.NaN;
    const high = allowPrice ? Number(offer.highPrice) : Number.NaN;
    const availability = typeof offer.availability==='string' ? offer.availability.split('/').pop() : undefined;
    return {
      ticketUrl:candidate,
      priceFrom:Number.isFinite(low)?low:undefined,
      priceTo:Number.isFinite(high)?high:undefined,
      priceCurrency:Number.isFinite(low)||Number.isFinite(high)?(currency||'AUD'):undefined,
      availability
    };
  }
  return {};
}
function htmlLines(html='') {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi,' ')
    .replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<(?:br\s*\/?|\/p|\/div|\/li|\/article|\/section|\/h[1-6]|\/tr|\/td|\/th)>/gi,'\n')
    .replace(/<[^>]+>/g,' ')
    .split(/\n+/)
    .map((line)=>clean(line))
    .filter(Boolean);
}
function visiblePriceData(html='') {
  const lines=htmlLines(html);
  const heading=lines.findIndex((line)=>/^(?:pricing|ticket prices?|ticket price|tickets?|admission|entry fees?)\b/i.test(line));
  if(heading<0) return {};
  const values=[];
  for(let i=heading;i<Math.min(lines.length,heading+60);i++){
    const line=lines[i];
    if(i>heading+2&&/^(?:show info|duration|venue|location|accessibility|contact|about|terms|important information)\b/i.test(line)) break;
    if(/\b(?:transaction|processing|booking|service|handling)\s+fee\b|\bsurcharge\b/i.test(line)) continue;
    for(const match of line.matchAll(/(?:A\$|AUD\s*|\$)\s*(\d{1,4}(?:\.\d{1,2})?)/gi)){
      const value=Number(match[1]);
      if(Number.isFinite(value)&&value>=0&&value<=5000) values.push(value);
    }
  }
  if(!values.length) return {};
  return {priceFrom:Math.min(...values),priceTo:Math.max(...values),priceCurrency:'AUD'};
}
function structuredOfferFromHtml(html,eventName,pageUrl){
  const wanted=clean(eventName||'').toLowerCase();
  const items=jsonld(html);
  const exact=items.find((item)=>clean(item.name||'').toLowerCase()===wanted);
  return offerData(exact||items[0],pageUrl);
}

function ticketLinks(html,base){
  const candidates=[];
  for(const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
    let href; try{href=new URL(match[1],base).href;}catch{continue;}
    if(sameUrl(href,base)) continue;
    const text=clean(match[2]);
    if(!text || BAD_BOOKING_TEXT.test(text)) continue;
    const provider=providerFromUrl(href);
    if(provider && isSpecificTicketUrl(href)){
      candidates.push({href,provider,text,score:20 + (EXACT_BOOKING_TEXT.test(text)?5:0)});
      continue;
    }
    // Generic official-site booking links must have concise, explicit booking text and a booking-shaped URL.
    if(EXACT_BOOKING_TEXT.test(text) && /\b(?:book|booking|ticket|register|registration|rsvp|reserve)\b/i.test(new URL(href).pathname)){
      candidates.push({href,provider:null,text,score:8});
    }
  }
  return candidates.sort((a,b)=>b.score-a.score);
}
async function fetchPage(url){
  const response=await fetch(url,{headers:{'user-agent':USER_AGENT,accept:'text/html,*/*;q=.8'},redirect:'follow',signal:AbortSignal.timeout(18000)});
  if(!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return {html:await response.text(),finalUrl:response.url};
}
function mergeOffer(event,offer){
  if(offer.ticketUrl && !event.ticketUrl) event.ticketUrl=offer.ticketUrl;
  if(offer.priceFrom!==undefined) event.priceFrom=offer.priceFrom;
  if(offer.priceTo!==undefined) event.priceTo=offer.priceTo;
  if(offer.priceCurrency) event.priceCurrency=String(offer.priceCurrency).toUpperCase();
  if(offer.availability) event.availability=offer.availability;
  if(event.priceFrom===0) event.categories=[...new Set([...(event.categories||[]),'Free'])];
}
function clearTicketData(event){for(const key of TICKET_FIELDS) delete event[key];}

const events=JSON.parse(await fs.readFile(FILE,'utf8'));
let fetched=0,ticketFetched=0,changed=0,preservedDirect=0,rejectedStale=0;
for(const event of events){
  if(event.status!=='active'||event.endDate<TODAY) continue;
  const before=JSON.stringify(Object.fromEntries(TICKET_FIELDS.map((key)=>[key,event[key]])));
  const priorTicket=validUrl(event.ticketUrl);
  const directEventUrl=validUrl(event.eventUrl);
  const trustedDirect = isSpecificTicketUrl(priorTicket) ? priorTicket : isSpecificTicketUrl(directEventUrl) ? directEventUrl : null;
  if(priorTicket && !isSpecificTicketUrl(priorTicket)) rejectedStale++;
  clearTicketData(event);
  if(trustedDirect){
    event.ticketUrl=trustedDirect;
    event.ticketProvider=providerFromUrl(trustedDirect);
    event.bookingRequired=true;
    preservedDirect++;
  }
  if(fetched>=MAX_FETCH){
    const after=JSON.stringify(Object.fromEntries(TICKET_FIELDS.map((key)=>[key,event[key]])));
    if(before!==after) changed++;
    continue;
  }
  const pageUrl=validUrl(event.eventUrl||event.sourceUrl); if(!pageUrl) continue;
  fetched++;
  try{
    const {html,finalUrl}=await fetchPage(pageUrl);
    const structuredEvents=jsonld(html);
    const eventName=clean(event.name||'').toLowerCase();
    const structured=structuredEvents.find((item)=>clean(item.name||'').toLowerCase()===eventName);
    if(structured) mergeOffer(event,offerData(structured,finalUrl));
    if(event.priceFrom===undefined&&event.priceTo===undefined) mergeOffer(event,visiblePriceData(html));
    if(!event.ticketUrl){
      const link=ticketLinks(html,finalUrl)[0];
      if(link){
        event.ticketUrl=link.href;
        event.ticketProvider=link.provider||'Booking link';
        event.bookingRequired=true;
      }
    }
    if(event.ticketUrl){
      event.ticketProvider=event.ticketProvider||providerFromUrl(event.ticketUrl)||'Booking link';
      event.bookingRequired=true;
      if(ticketFetched<MAX_TICKET_FETCH&&!sameUrl(event.ticketUrl,finalUrl)&&(event.priceFrom===undefined||!event.availability)){
        ticketFetched++;
        try{
          const ticketPage=await fetchPage(event.ticketUrl);
          mergeOffer(event,structuredOfferFromHtml(ticketPage.html,event.name,ticketPage.finalUrl));
          if(event.priceFrom===undefined&&event.priceTo===undefined) mergeOffer(event,visiblePriceData(ticketPage.html));
        }catch(error){
          console.warn(`${event.name}: ticket page detail skipped (${error.message}).`);
        }
      }
    }
    event.ticketLastChecked=TODAY;
  }catch(error){
    console.warn(`${event.name}: ticket enrichment skipped (${error.message}).`);
  }
  const after=JSON.stringify(Object.fromEntries(TICKET_FIELDS.map((key)=>[key,event[key]])));
  if(before!==after) changed++;
}
await fs.writeFile(FILE,`${JSON.stringify(events,null,2)}\n`);
console.log(`Ticket enrichment: checked ${fetched} event page(s) plus ${ticketFetched} ticket page(s); changed ticket data for ${changed} event(s); preserved ${preservedDirect} provider-specific event link(s); rejected ${rejectedStale} stale/generic ticket link(s).`);
