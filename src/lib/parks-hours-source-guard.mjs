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
