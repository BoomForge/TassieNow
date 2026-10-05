import fs from 'node:fs/promises';

const FILE = new URL('../src/data/places.json', import.meta.url);
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Hobart' }).format(new Date());
const genericExact = new Set(['lookout','viewpoint','information','information sign','sign','interpretive sign','noticeboard','car park','carpark','parking','rest area','toilets','toilet','picnic area','memorial','monument','photo point','scenic view']);
const hardNoise = /\b(car\s*(?:rentals?|hire)|rental\s*cars?|avis|budget\s*(?:rent|car)|hertz|europcar|thrifty|sixt|bargain car rentals?|airport shuttle|taxi rank)\b/i;
const weakNoise = /\b(sign|marker|noticeboard|information board|parking|car ?park|toilets?)\b/i;
const weakFeature = /\b(?:walker registration|registration point|beach entrance|access point|signpost|highest point on road|animal enclosure|monkey enclosure)\b/i;
const corporateOnly = /\b(?:pty\.?\s*ltd|proprietary limited)\b/i;
const recognised = new Set(['Things to Do','Museums','Art & Culture','Wildlife','Family','Markets','Food & Drink','Local Produce','Nature & Walks','Outdoor','Rainy Day','Free']);

function properName(name='') {
  const clean=String(name).trim();
  if(clean.length<4 || /^\d+$/.test(clean)) return false;
  if(genericExact.has(clean.toLowerCase())) return false;
  if(/^[^a-z0-9]+$/i.test(clean)) return false;
  return /[a-z]{3}/i.test(clean);
}
function sourceWeight(place) {
  if(place.managedManually || place.sourceType==='manual') return 24;
  if(place.sourceType==='curated') return 28;
  if(place.officialSource?.type==='government' || place.sourceType==='parks-tasmania') return 24;
  if(place.sourceType==='openstreetmap') return 8;
  return 14;
}
function score(place) {
  let s=sourceWeight(place);
  const signals=[];
  if(place.managedManually || place.sourceType==='manual') signals.push('owner-managed');
  if(place.managedManually && place.featured){s+=18;signals.push('owner-featured');}
  if(properName(place.name)){s+=8;signals.push('proper-name');} else {s-=12;signals.push('weak-name');}
  if(place.website){s+=10;signals.push('website');}
  if(place.websiteCheck?.status==='ok'){s+=4;signals.push('verified-website');}
  if(place.wikidata){s+=7;signals.push('wikidata');}
  if(place.officialSource?.type==='government'){s+=14;signals.push('government-source');}
  if(place.walk?.grade){s+=7;signals.push('official-walk-data');}
  if(place.image && !place.image.isFallback){s+=16;signals.push('real-image');} else s-=2;
  if(place.openingHours){s+=6;signals.push('opening-hours');}
  if(place.address){s+=3;signals.push('address');}
  if(place.phone || place.email){s+=3;signals.push('contact-details');}
  if(place.bookingUrl){s+=2;signals.push('booking-link');}
  if(place.reviewLinks?.length){s+=2;signals.push('review-link');}
  if(place.lastDetailsChecked){s+=2;signals.push('details-checked');}
  const usefulCats=(place.categories||[]).filter(c=>recognised.has(c));
  s+=Math.min(10,usefulCats.length*2);
  if((place.categories||[]).includes('Things to Do')) s+=5;
  if((place.categories||[]).includes('Nature & Walks')) s+=4;
  if((place.categories||[]).includes('Museums') || (place.categories||[]).includes('Wildlife')) s+=5;
  if((place.categories||[]).includes('Markets') || (place.categories||[]).includes('Local Produce') || (place.categories||[]).includes('Food & Drink')) s+=4;
  if((place.categories||[]).includes('Family')) s+=3;
  if(hardNoise.test(place.name||'')){s-=60;signals.push('commercial-noise');}
  if(weakNoise.test(place.name||'') && !/historic|museum|heritage/i.test(place.name||'')){s-=15;signals.push('weak-object');}
  if(weakFeature.test(place.name||'') && !place.website && !place.wikidata && !place.officialSource){s-=20;signals.push('minor-feature');}
  if(corporateOnly.test(place.name||'') && !place.website && !place.wikidata){s-=12;signals.push('weak-commercial-name');}
  if(/^lookout\b/i.test(place.name||'') && !place.website && !place.wikidata && !place.officialSource) s-=8;
  if((place.name||'').split(/\s+/).length===1 && !place.website && !place.wikidata && place.sourceType==='openstreetmap') s-=7;
  if(/[.!?]$/.test(place.name||'') && !place.website && !place.wikidata) s-=3;
  return { value: Math.max(0,Math.min(100,Math.round(s))), signals };
}

const places=JSON.parse(await fs.readFile(FILE,'utf8'));
let suppressed=0,featured=0;
const ranked=places.map(place=>{
  const result=score(place);
  const hard=hardNoise.test(place.name||'') || genericExact.has(String(place.name||'').trim().toLowerCase());
  const ownerManaged=Boolean(place.managedManually || place.sourceType==='manual');
  const keep=ownerManaged || place.sourceType==='curated' || place.officialSource?.type==='government' || place.sourceType==='parks-tasmania';
  const visibility=ownerManaged ? (place.visibility==='suppressed'?'suppressed':'public') : ((!keep && (hard || result.value<18)) ? 'suppressed' : 'public');
  if(visibility==='suppressed') suppressed++;
  const qualityTier=(ownerManaged&&place.featured)||result.value>=55?'featured':result.value>=40?'strong':result.value>=25?'standard':'low';
  if(qualityTier==='featured' && visibility==='public') featured++;
  return {...place,qualityScore:result.value,qualityTier,visibility,qualitySignals:result.signals,rankedAt:today};
}).sort((a,b)=>{
  if(a.visibility!==b.visibility) return a.visibility==='public'?-1:1;
  if(Boolean(a.featured)!==Boolean(b.featured)) return a.featured?-1:1;
  return (b.qualityScore||0)-(a.qualityScore||0) || a.name.localeCompare(b.name);
});
await fs.writeFile(FILE,`${JSON.stringify(ranked,null,2)}\n`);
console.log(`Ranked ${ranked.length} places: ${ranked.length-suppressed} public, ${suppressed} suppressed, ${featured} featured.`);
