// Never copy/rehost/cache Google Maps photos. Resolve live Places imagery
// only after a user asks to view it, and preserve Google's native attribution.
export function googleMarketSearchUrl(name,town){
 const query=[String(name||'').trim(),String(town||'').trim(),'Tasmania Australia']
  .filter(Boolean).join(' ');
 return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(query);
}
const normalized=value=>String(value||'').normalize('NFKD').toLowerCase()
 .replace(/[\u0300-\u036f]/g,'').replace(/^the /,'').replace(/[^a-z0-9]+/g,' ').trim();
function distanceKm(a,b){
 if(!Number.isFinite(a.lat)||!Number.isFinite(a.lng)||
    !Number.isFinite(b.lat)||!Number.isFinite(b.lng))return Infinity;
 const toRad=x=>x*Math.PI/180;
 const dLat=toRad(b.lat-a.lat),dLon=toRad(b.lng-a.lng);
 const v=Math.sin(dLat/2)**2+Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*
  Math.sin(dLon/2)**2;
 return 12742*Math.asin(Math.min(1,Math.sqrt(v)));
}
export function chooseExactGoogleMarket(results,listing){
 const name=normalized(listing?.name),town=normalized(listing?.town);
 if(name.length<7||town.length<3)return null;
 const coords={lat:Number(listing.latitude),lng:Number(listing.longitude)};
 const matches=(results||[]).filter(result=>{
  if(!result?.id || normalized(result.displayName)!==name)return false;
  const address=normalized(result.formattedAddress);
  const point=result.location||{};
  const location={lat:typeof point.lat==='function'?point.lat():Number(point.lat),
    lng:typeof point.lng==='function'?point.lng():Number(point.lng)};
  // A verified name plus correct town/state OR a very close mapped position
  // is required. Never silently attach similarly named markets elsewhere.
  return (address.includes(town)&&/\btas(?:mania)?\b/.test(address))||
   (Number.isFinite(coords.lat)&&Number.isFinite(coords.lng)&&
    distanceKm(coords,location)<=3.5);
 });
 return matches.length===1?matches[0]:null;
}
