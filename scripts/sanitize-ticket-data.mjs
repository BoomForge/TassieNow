import fs from 'node:fs/promises';

const FILE = new URL('../src/data/events.json', import.meta.url);
const FIELDS = ['ticketUrl','ticketProvider','priceFrom','priceTo','priceCurrency','availability','bookingRequired','ticketLastChecked'];

function url(value){try{return new URL(value);}catch{return null;}}
function provider(value=''){
  const parsed=url(value); if(!parsed) return null;
  const host=parsed.hostname.replace(/^www\./,'');
  if(/(^|\.)humanitix\.com$/i.test(host)) return 'Humanitix';
  if(/(^|\.)eventbrite\.(?:com|com\.au)$/i.test(host)) return 'Eventbrite';
  if(/(^|\.)ticketmaster\.(?:com|com\.au)$/i.test(host)) return 'Ticketmaster';
  if(/(^|\.)trybooking\.com$/i.test(host)) return 'TryBooking';
  if(/(^|\.)moshtix\.com\.au$/i.test(host)) return 'Moshtix';
  if(/(^|\.)ticketek\.com\.au$/i.test(host)) return 'Ticketek';
  if(/(^|\.)rezdy\.com$/i.test(host)) return 'Rezdy';
  return null;
}
function specific(value=''){
  const parsed=url(value); if(!parsed) return false;
  const name=provider(value), path=`${parsed.pathname}${parsed.search}`;
  if(name==='Humanitix') return parsed.hostname.startsWith('events.') || (!/^\/(?:events\/au--|au\/events(?:\/|$))/i.test(parsed.pathname) && parsed.pathname.length>2);
  if(name==='Eventbrite') return /\/e\//i.test(parsed.pathname);
  if(name==='Ticketmaster') return /\/event\//i.test(parsed.pathname);
  if(name==='TryBooking') return /\/events\/(?:landing\/)?\d+/i.test(parsed.pathname) || /\/events\/landing\//i.test(parsed.pathname);
  if(name==='Moshtix') return /\/v2\/event\//i.test(parsed.pathname);
  if(name==='Ticketek') return /\/shows\/show\.aspx/i.test(path) || /\beventid=/i.test(path);
  if(name==='Rezdy') return parsed.pathname.length>4 && /\d/.test(parsed.pathname);
  return false;
}
function clear(event){for(const key of FIELDS) delete event[key];}

const events=JSON.parse(await fs.readFile(FILE,'utf8'));
let removed=0,priceRemoved=0;
for(const event of events){
  if(event.ticketUrl && !specific(event.ticketUrl)){
    clear(event); removed++; continue;
  }
  if(event.ticketUrl){
    event.ticketProvider=provider(event.ticketUrl);
    event.bookingRequired=true;
  }
  if(event.priceCurrency && String(event.priceCurrency).toUpperCase()!=='AUD'){
    delete event.priceFrom; delete event.priceTo; delete event.priceCurrency; delete event.availability; priceRemoved++;
  } else if(event.priceCurrency) {
    event.priceCurrency=String(event.priceCurrency).toUpperCase();
  }
}
await fs.writeFile(FILE,`${JSON.stringify(events,null,2)}\n`);
console.log(`Ticket sanitiser: removed ${removed} ambiguous/non-event booking link(s); removed ${priceRemoved} non-AUD price record(s).`);
