// Verified older edition of an actual repeating Tasmanian event.
// An old race photograph is never represented as a photograph of this year's event.
import {eventImagePriority,imageIsPublishable} from './event-media.mjs';
const history=[{
 name:'Burnie Ten',town:'Burnie',year:2017,photographer:'Gary Houston',
 url:'https://upload.wikimedia.org/wikipedia/commons/1/1d/Stewart_McSweyn_20171022-001.jpg',
 sourceUrl:'https://commons.wikimedia.org/wiki/File:Stewart_McSweyn_20171022-001.jpg',
 license:'CC0',licenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/',
 subject:'Stewart McSweyn winning the 2017 Burnie Ten'
}];
export function applyVerifiedHistoricalEvents(events){
 let added=0;
 for(const event of events){
  if(event.status!=='active'||eventImagePriority(event.image)>=6)continue;
  const item=history.find(h=>event.name.trim().toLowerCase()===h.name.toLowerCase()
    &&event.town===h.town&&Number(event.startDate?.slice(0,4))>h.year);
  if(!item)continue;
  const currentYear=event.startDate.slice(0,4);
  const image={
   url:item.url,sourceUrl:item.sourceUrl,license:item.license,licenseUrl:item.licenseUrl,
   attribution:item.photographer,isFallback:false,sourceMethod:'verified-event-history',
   mediaType:'historical-event',historicalYear:item.year,
   alt:`${item.subject} — archival photo, not the ${currentYear} race`,
   caption:`Photo from the ${item.year} edition of ${item.name} (${item.subject}); not a photograph of the ${currentYear} event.`,
   matchEvidence:{verified:true,verifiedType:'historical-event',eventName:item.name,
    town:item.town,photoYear:item.year,sourceFilePage:item.sourceUrl,checkedAt:'2026-10-11'}
  };
  if(!imageIsPublishable(image))continue;
  event.image=image;added++;
 }
 return added;
}
