/**
 * Huon Valley Council's Dover mobile service was duplicated when its list
 * importer paired the next card's 30 Oct–1 Nov date with the prior Dover title.
 * Keep one independently confirmed, one-day Services Australia visit.
 */
const TITLE='Australian Government Mobile Service Centre – Dover';
const URL='https://www.huonvalley.tas.gov.au/event/australian-government-mobile-service-centre-dover/';
const CANONICAL='australian-government-mobile-service-centre-dover-2026-10-29-dover';
function isDover2026(event){
 const name=String(event?.name||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 const title=TITLE.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 const source=String(event?.eventUrl||event?.sourceUrl||'');
 const eligible=/^2026-10-(?:29|30)$/.test(event?.startDate||'')||
  event?.slug===CANONICAL;
 return name===title&&eligible&&
  /^https:\/\/www\.huonvalley\.tas\.gov\.au\/(?:event\/australian-government-mobile-service-centre-dover\/?|events\/?)$/.test(source);
}
export function correctDoverMobileServiceCentre(events){
 if(!Array.isArray(events))return events;
 const matches=events.filter(isDover2026);
 if(!matches.length)return events;
 // The detail URL is unique to this service; the overview URL is not.
 const selected=matches.find(e=>e.eventUrl===URL)||matches[0];
 const canonical={
  ...selected,slug:CANONICAL,name:TITLE,
  town:'Dover',region:'Hobart & South',
  startDate:'2026-10-29',endDate:'2026-10-29',
  startTime:'09:00',endTime:'15:30',
  venue:'Opposite Dover RSL',address:'Chapman Avenue, Dover TAS',
  eventUrl:URL,sourceUrl:URL,sourceName:'Huon Valley Council',
  summary:'The Australian Government Mobile Service Centre visits opposite Dover RSL on Chapman Avenue in Dover on Thursday 29 October 2026, 9 am–3:30 pm. Services Australia staff can help with Centrelink, Medicare, myGov and other government services.',
  image:{url:'/images/categories/events.svg',alt:'Australian Government Mobile Service Centre – Dover event artwork',attribution:'TassieNow',license:'Site artwork',licenseUrl:null,sourceUrl:null,isFallback:true}
 };
 return [...events.filter(e=>!matches.includes(e)),canonical];
}
