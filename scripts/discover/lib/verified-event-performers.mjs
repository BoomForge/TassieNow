// Verified Commons photographs of the *named performer*, never of the
// advertised Tasmanian performance. These are editorial context, not posters.
import {eventImagePriority,imageIsPublishable} from './event-media.mjs';
const normalized=s=>String(s||'').normalize('NFKD').toLowerCase()
 .replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
export const verifiedPerformers=[
 {
  name:'The Wiggles',year:2023,location:'a 2023 concert',
  url:'https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/The_Wiggles_performing_live_in_concert_2023.jpg/1280px-The_Wiggles_performing_live_in_concert_2023.jpg',
  sourceUrl:'https://commons.wikimedia.org/wiki/File:The_Wiggles_performing_live_in_concert_2023.jpg',
  credit:'MontereyJim',license:'CC0',licenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/'
 },
 {
  name:'Delta Goodrem',year:2026,location:'the August 2026 Weltklasse Zürich closing ceremony',
  url:'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Australian_singer_Delta_Goodrem_performs_at_the_closing_ceremony_of_Weltklasse_Z%C3%BCrich_2026_at_Letzigrund_Stadium_on_27_August_2026._DSC02076.jpg/1280px-Australian_singer_Delta_Goodrem_performs_at_the_closing_ceremony_of_Weltklasse_Z%C3%BCrich_2026_at_Letzigrund_Stadium_on_27_August_2026._DSC02076.jpg',
  sourceUrl:'https://commons.wikimedia.org/wiki/File:Australian_singer_Delta_Goodrem_performs_at_the_closing_ceremony_of_Weltklasse_Z%C3%BCrich_2026_at_Letzigrund_Stadium_on_27_August_2026._DSC02076.jpg',
  credit:'Peter Arnold',license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/'
 },
 {
  name:'Björn Again',year:2009,location:'a 2009 Sydney performance',
  url:'https://upload.wikimedia.org/wikipedia/commons/4/4e/BjornAgainSydney2009.jpg',
  sourceUrl:'https://commons.wikimedia.org/wiki/File:BjornAgainSydney2009.jpg',
  credit:'TMGAustralia',license:'CC0',licenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/'
 },
 {
  name:'Ross Noble',year:2004,location:'the 2004 Edinburgh Festival Fringe',
  url:'https://upload.wikimedia.org/wikipedia/commons/5/5c/Ross_Noble_Edinburgh_2004.jpg',
  sourceUrl:'https://commons.wikimedia.org/wiki/File:Ross_Noble_Edinburgh_2004.jpg',
  credit:'Ed g2s',license:'CC BY-SA 3.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/3.0/'
 }
];
export function applyVerifiedPerformerImages(events){
 let added=0;
 for(const event of events){
  if(event.status!=='active'||eventImagePriority(event.image)>=5)continue;
  const name=normalized(event.name);
  const performer=verifiedPerformers.find(p=>new RegExp('(?:^| )'+normalized(p.name)+'(?: |$)').test(name));
  if(!performer)continue;
  const image={
   url:performer.url,sourceUrl:performer.sourceUrl,license:performer.license,
   licenseUrl:performer.licenseUrl,attribution:performer.credit,isFallback:false,
   alt:`${performer.name} at ${performer.location}; archive performer photograph, not this event`,
   mediaType:'performer-context',sourceMethod:'verified-event-performer',
   caption:`Performer photo: ${performer.name} at ${performer.location}. This does not depict the advertised event.`,
   matchEvidence:{verified:true,verifiedType:'performer-context',performer:performer.name,
    photoYear:performer.year,eventName:event.name,sourceFilePage:performer.sourceUrl,
    checkedAt:'2026-10-11'}
  };
  if(!imageIsPublishable(image))continue;
  event.image=image;added++;
 }
 return added;
}
