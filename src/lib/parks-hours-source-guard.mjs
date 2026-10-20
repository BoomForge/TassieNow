/**
 * Parks Tasmania pages frequently contain office or visitor-centre contacts.
 * Those business hours do NOT describe a park, lookout, track, beach or cafe.
 * Import hours only if the listing is actually for that named staffed facility.
 */
export function parksTasHoursAreForListing(placeName='',sourceUrl=''){
 let host='';
 try{host=new URL(sourceUrl).hostname.toLowerCase().replace(/^www\./,'');}catch{return true;}
 if(host!=='parks.tas.gov.au')return true;
 const target=String(placeName||'').toLowerCase();
 return /\b(?:visitor|information)\s+cent(?:re|er)\b|\boffice\b/.test(target);
}

const affectedNames=new Set([
 'southwest national park','arve falls lookout','waratah lookout',
 'tahune airwalk cafe','wineglass bay lookout','hazards beach',
 'sleepy bay lookout','cape tourville lookout','friendly beaches',
 'freycinet national park'
]);
/** Remove ONLY the known contaminated historical Parks-contact hours on build. */
export function shouldRemoveParksContactHours(place={}){
 const name=String(place.name||'').toLowerCase().trim();
 if(!affectedNames.has(name)||!place.openingHours||place.managedManually)return false;
 if(place.detailSources?.openingHours?.type==='manual')return false;
 const hours=String(place.openingHours);
 const matchesKnownOfficeHours=/\b(?:09:00-16:00|10:00-16:00)\b/.test(hours);
 if(!matchesKnownOfficeHours)return false;
 const source=String(place.detailSources?.openingHours?.url||'');
 return source ? !parksTasHoursAreForListing(place.name,source)
   : /(?:Tue,Wed\s+10:00-16:00|Mo-Su\s+09:00-16:00)/i.test(hours);
}
