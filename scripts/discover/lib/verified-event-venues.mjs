// Manually verified named-venue context. It is NOT event photography.
// Each source is independently licensed by its Commons photographer.
import {imageIsPublishable} from './event-media.mjs';

export const verifiedEventVenues=[
  {
    venue:'Hobart City Hall',town:'Hobart',
    url:'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5a/CG-Hobart-City-Hall_from_above_Feb2015.jpg/1280px-CG-Hobart-City-Hall_from_above_Feb2015.jpg',
    sourceUrl:'https://commons.wikimedia.org/wiki/File:CG-Hobart-City-Hall_from_above_Feb2015.jpg',
    attribution:'Chuq',license:'CC BY-SA 4.0',
    licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',
    locationEvidence:'Commons identifies Hobart City Hall, Macquarie Street, Tasmania, photographed 9 February 2015'
  },
  {
    venue:'Hobart Town Hall',town:'Hobart',
    url:'https://upload.wikimedia.org/wikipedia/commons/f/f9/Town_Hall%2C_Hobart.jpg',
    sourceUrl:'https://commons.wikimedia.org/wiki/File:Town_Hall,_Hobart.jpg',
    attribution:'S Pwz',license:'CC BY-SA 4.0',
    licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',
    locationEvidence:'Commons categorises the 27 January 2017 photo under Hobart Town Hall, Tasmania'
  },
  {
    venue:'Princes Wharf No. 1',town:'Hobart',
    url:'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/72/Princes_Wharf_No1_Shed_20171117-007.jpg/1280px-Princes_Wharf_No1_Shed_20171117-007.jpg',
    sourceUrl:'https://commons.wikimedia.org/wiki/File:Princes_Wharf_No1_Shed_20171117-007.jpg',
    attribution:'Gary Houston',license:'CC0',
    licenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/',
    locationEvidence:'Commons photo identifies Princes Wharf No. 1 shed in Hobart, 17 November 2017'
  },
  {
    venue:'West Coast Heritage Centre',town:'Zeehan',
    url:'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/02/Zeehan_School_of_Mines_20171121-053.jpg/1280px-Zeehan_School_of_Mines_20171121-053.jpg',
    sourceUrl:'https://commons.wikimedia.org/wiki/File:Zeehan_School_of_Mines_20171121-053.jpg',
    attribution:'Gary Houston',license:'CC0',
    licenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/',
    subject:'Former School of Mines building, now part of the West Coast Heritage Centre',
    locationEvidence:'Commons identifies the former Zeehan School of Mines as part of West Coast Heritage Centre in Zeehan'
  },
  {
    venue:'MyState Bank Arena',town:'Glenorchy',
    url:'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/bc/MyState_Bank_Arena_2022_06.jpg/1280px-MyState_Bank_Arena_2022_06.jpg?utm_campaign=index&utm_content=thumbnail&utm_source=commons.wikimedia.org',
    sourceUrl:'https://commons.wikimedia.org/wiki/File:MyState_Bank_Arena_2022_06.jpg',
    attribution:'DaHuzyBru',license:'CC BY-SA 4.0',
    licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',
    locationEvidence:'Commons describes MyState Bank Arena in Glenorchy, Tasmania; photo dated 27 September 2022'
  },
  {
    venue:'Albert Hall',town:'Launceston',
    url:'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Launceston_Albert_Hall_001.JPG/1280px-Launceston_Albert_Hall_001.JPG',
    sourceUrl:'https://commons.wikimedia.org/wiki/File:Launceston_Albert_Hall_001.JPG',
    attribution:'Mattinbgn',license:'CC BY 3.0',
    licenseUrl:'https://creativecommons.org/licenses/by/3.0/',
    locationEvidence:'Commons explicitly identifies Albert Hall in Launceston, Tasmania; photo dated 30 August 2015'
  }
];

export function applyVerifiedEventVenueImages(events) {
  let added=0;
  for(const event of events){
    if(event.status!=='active'||imageIsPublishable(event.image))continue;
    const identity=verifiedEventVenues.find(venue=>{
      if(event.town!==venue.town)return false;
      const observed=event.venue?.trim()||'';
      if(observed===venue.venue || observed.startsWith(venue.venue+', '))return true;
      // Some verified ticket records include the venue in their full event title
      // rather than populating the venue field.
      return new RegExp('\\b'+venue.venue.replace(/\s+/g,'\\s+')+'\\b','i').test(event.name||'');
    });
    if(!identity)continue;
    const image={
      url:identity.url,sourceUrl:identity.sourceUrl,
      attribution:identity.attribution,license:identity.license,licenseUrl:identity.licenseUrl,
      alt:`${identity.subject||identity.venue} in ${identity.town} — context only, not a picture of ${event.name}`,
      mediaType:'contextual',caption:`${identity.subject?identity.subject+' (venue context)': 'Venue photograph: '+identity.venue}, ${identity.town}. This does not depict the advertised event.`,
      sourceMethod:'verified-event-venue',isFallback:false,
      matchEvidence:{verified:true,verifiedType:'contextual',venue:identity.venue,
        town:identity.town,eventName:event.name,sourceFilePage:identity.sourceUrl,
        locationEvidence:identity.locationEvidence,checkedAt:'2026-10-11'}
    };
    if(!imageIsPublishable(image))continue;
    event.image=image;added++;
  }
  return added;
}
