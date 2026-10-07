import fs from 'node:fs/promises';

const FILE = new URL('../src/data/events.json', import.meta.url);
const JUNK_NAME = /\b(?:for visit the event on rosny farm|living well devonport program|program dates?|time location|upcoming events?|community noticeboard|fogo collection|waste collection)\b/i;
const HTML_LEAK = /<\/?[a-z!]|\b(?:src|srcset|class|media|href)\s*=|&(?:lt|gt);/i;
const DATE_ONLY_NAME = /^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+20\d{2})?$/i;

function decode(value=''){
  return String(value)
    .replace(/&nbsp;|&#160;/gi,' ')
    .replace(/&amp;/gi,'&')
    .replace(/&quot;/gi,'"')
    .replace(/&#39;|&apos;|&#x27;/gi,"'")
    .replace(/&ndash;|&#8211;/gi,'–')
    .replace(/&mdash;|&#8212;/gi,'—');
}
function cleanText(value=''){
  return decode(String(value))
    .replace(/<script[\s\S]*?<\/script>/gi,' ')
    .replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]*>/g,' ')
    .replace(/<[^>]*$/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}
function slugify(value=''){return String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,90);}
function titleFromEventUrl(value=''){
  try{
    let leaf=decodeURIComponent(new URL(value).pathname.split('/').filter(Boolean).at(-1)||'').replace(/-(?:2|3)$/,'');
    const special={nz:'NZ',se:'SE',abba:'ABBA',afl:'AFL',nbl:'NBL',wnbl:'WNBL',jackjumpers:'JackJumpers'};
    return leaf.split('-').filter(Boolean).map((token)=>token==='v'?'v':special[token.toLowerCase()]||(/^\d/.test(token)?token:token.charAt(0).toUpperCase()+token.slice(1))).join(' ').replace(/\s+/g,' ').trim();
  }catch{return'';}
}
function genericSummary(event){
  return `${event.name} in ${event.town}. Check the official event listing for current times, venue, accessibility and booking details.`;
}
function summaryLooksUseful(event, raw, cleaned){
  if(!cleaned || cleaned.length < 28 || HTML_LEAK.test(raw) || HTML_LEAK.test(cleaned)) return false;
  if(/^\W+$/.test(cleaned)) return false;
  const nameTokens = cleanText(event.name).toLowerCase().split(/[^a-z0-9]+/).filter((token)=>token.length >= 5);
  if(!nameTokens.length) return true;
  const lower = cleaned.toLowerCase();
  const overlap = nameTokens.filter((token)=>lower.includes(token)).length;
  // Short snippets with no connection to the event title are often neighbouring cards/nav fragments.
  if(cleaned.length < 120 && overlap === 0) return false;
  return true;
}
function preference(event){
  let score=0;
  if(event.eventUrl && event.eventUrl !== event.sourceUrl) score+=4;
  if(event.venue) score+=2;
  if(event.summary && !/^.+ in .+\. Check the official event listing/.test(event.summary)) score+=1;
  if(event.ticketUrl) score+=2;
  return score;
}
function normalize(value=''){return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
function dedupe(items){
  const out=[];
  for(const event of items){
    const name=normalize(event.name); let match=-1;
    for(let i=0;i<out.length;i++){
      const other=out[i];
      if(other.startDate!==event.startDate || normalize(other.town)!==normalize(event.town)) continue;
      const otherName=normalize(other.name);
      if(name===otherName || (name.length>=8&&otherName.length>=8&&(name.includes(otherName)||otherName.includes(name)))) { match=i; break; }
    }
    if(match<0) out.push(event);
    else if(preference(event)>preference(out[match])) out[match]=event;
  }
  return out;
}

const events = JSON.parse(await fs.readFile(FILE,'utf8'));
const cleaned=[];
let removed=0,repaired=0;
for(const original of events){
  const event={...original};
  event.name=cleanText(event.name);
  if(DATE_ONLY_NAME.test(event.name)){
    const recovered=titleFromEventUrl(event.eventUrl);
    if(!recovered || DATE_ONLY_NAME.test(recovered)){ removed++; continue; }
    event.name=recovered;
    event.slug=slugify(`${event.name}-${event.startDate}-${event.town}`);
    if(event.image?.isFallback) event.image={...event.image,alt:`${event.name} event category image`};
    repaired++;
  }
  if(!event.name || event.name.length<3 || JUNK_NAME.test(event.name)) { removed++; continue; }
  const rawSummary=String(event.summary||'');
  const summary=cleanText(rawSummary);
  if(summaryLooksUseful(event,rawSummary,summary)) event.summary=summary.slice(0,320);
  else { event.summary=genericSummary(event); repaired++; }
  if(event.venue) event.venue=cleanText(event.venue);
  cleaned.push(event);
}
const unique=dedupe(cleaned).sort((a,b)=>a.startDate.localeCompare(b.startDate)||a.name.localeCompare(b.name));
removed += cleaned.length - unique.length;
await fs.writeFile(FILE,`${JSON.stringify(unique,null,2)}\n`);
console.log(`Event sanitiser: ${unique.length} kept; ${removed} junk/duplicate record(s) removed; ${repaired} summary record(s) repaired.`);
