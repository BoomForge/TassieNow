/**
 * Merge only the known West Coast Wilderness Railway duplicate into its
 * established, evidence-rich attraction listing. Strahan's Regatta Point is
 * still an official station, but not a second identical railway operator.
 */
const officialRailway=place=>{
 const urls=[place.website,place.officialSource?.url,place.bookingUrl].filter(Boolean);
 return urls.some(raw=>{try{return /(^|\.)wcwr\.com\.au$/i.test(new URL(raw).hostname);}catch{return false;}});
};
export function dedupeWestCoastRailwayPlaces(places){
 const parent=places.find(p=>p.slug==='west-coast-wilderness-railway');
 const alias=places.find(p=>p.slug==='west-coast-wilderness-railway-strahan');
 if(!parent||!alias||alias.managedManually)return{places,removed:0};
 if(parent.name!=='West Coast Wilderness Railway'||alias.name!=='West Coast Wilderness Railway')return{places,removed:0};
 if(!officialRailway(parent)||!parent.phone)return{places,removed:0};
 // Do not merge a separate operator, curated station, or rich source record.
 if(alias.website||alias.phone||alias.bookingUrl||alias.officialSource?.url||
    (alias.sourceType&&alias.sourceType!=='openstreetmap'))return{places,removed:0};
 return{places:places.filter(p=>p!==alias),removed:1};
}
