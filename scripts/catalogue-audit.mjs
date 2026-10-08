import fs from 'node:fs/promises';

const PLACES = new URL('../src/data/places.json', import.meta.url);
const EVENTS = new URL('../src/data/events.json', import.meta.url);
const OUT = new URL('../src/data/catalogue-audit.json', import.meta.url);
function pct(value,total){return total?Math.round((value/total)*1000)/10:0;}
function countBy(items,keyFn){const out={};for(const item of items){const key=keyFn(item)||'unknown';out[key]=(out[key]||0)+1;}return Object.fromEntries(Object.entries(out).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])));}
function tasDate(date=new Date()){const p=new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Hobart',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);const g=(t)=>p.find((x)=>x.type===t)?.value;return`${g('year')}-${g('month')}-${g('day')}`;}
function coverage(items,predicate){const count=items.filter(predicate).length;return{count,percent:pct(count,items.length)};}
function mediaCount(place){
  const keys=new Set();
  if(place.image&&!place.image.isFallback)keys.add(place.image.sourceUrl||place.image.url);
  for(const image of place.gallery||[])if(image&&!image.isFallback)keys.add(image.sourceUrl||image.url);
  keys.delete(undefined);keys.delete(null);keys.delete('');
  return keys.size;
}
const today=tasDate();
const places=JSON.parse(await fs.readFile(PLACES,'utf8'));
const events=JSON.parse(await fs.readFile(EVENTS,'utf8'));
const publicPlaces=places.filter((p)=>p.status==='active'&&p.visibility!=='suppressed');
const foodPlaces=publicPlaces.filter(p=>(p.categories||[]).includes('Food & Drink'));
const foodKinds=['Restaurant','Café','Takeaway','Bakery','Pub Food','Food Van','Desserts','Mobile Vendor','Local Produce'];
const activeEvents=events.filter((e)=>e.status==='active'&&e.endDate>=today);
const imageCounts=publicPlaces.map(mediaCount);
const totalLicensedImages=imageCounts.reduce((sum,count)=>sum+count,0);
const officialVerified=(p)=>p.officialSourceCheck?.status==='ok'||p.officialSource?.source==='wikidata:P856'||p.officialSource?.type==='government'||p.sourceType==='parks-tasmania';
const ticketReady=activeEvents.filter((e)=>e.ticketUrl);
const priced=activeEvents.filter((e)=>e.priceFrom!==undefined||e.priceTo!==undefined);
const allRegions=['Hobart & South','Launceston & North','North West','East Coast','West Coast','Central Tasmania','Flinders Island','King Island'];
const eventsByRegion=countBy(activeEvents,(e)=>e.region);
const fullRegionCoverage=Object.fromEntries(allRegions.map(region=>[region,eventsByRegion[region]||0]));
const categoryMembership=countBy(publicPlaces.flatMap(p=>[...new Set(p.categories||[])].map(category=>({category}))),(p)=>p.category);
const ticketStale=activeEvents.filter(e=>e.ticketUrl&&(!e.ticketLastChecked || e.ticketLastChecked < new Date(Date.parse(today+'T00:00:00Z')-30*86400000).toISOString().slice(0,10)));
const audit={
  generatedAt:today,
  places:{
    total:places.length,
    public:publicPlaces.length,
    suppressed:places.length-publicPlaces.length,
    media:{
      realHeroCoverage:coverage(publicPlaces,(p)=>p.image&&!p.image.isFallback),
      twoPlusImages:coverage(publicPlaces,(p)=>mediaCount(p)>=2),
      fourPlusImages:coverage(publicPlaces,(p)=>mediaCount(p)>=4),
      sixPlusImages:coverage(publicPlaces,(p)=>mediaCount(p)>=6),
      totalLicensedImages,
      averageImagesPerPublicListing:publicPlaces.length?Math.round((totalLicensedImages/publicPlaces.length)*100)/100:0
    },
    sources:{
      websiteCoverage:coverage(publicPlaces,(p)=>Boolean(p.website)),
      officialSourceCoverage:coverage(publicPlaces,(p)=>Boolean(p.officialSource?.url)),
      verifiedOfficialSourceCoverage:coverage(publicPlaces,officialVerified),
      wikidataLinkage:coverage(publicPlaces,(p)=>/^Q\d+$/.test(String(p.wikidata||((p.sourceType==='wikidata'&&p.sourceId)||''))))
    },
    details:{
      openingHours:coverage(publicPlaces,(p)=>Boolean(p.openingHours)),
      recurringSchedule:coverage(publicPlaces,(p)=>Boolean(p.schedule?.summary)),
      phone:coverage(publicPlaces,(p)=>Boolean(p.phone)),
      email:coverage(publicPlaces,(p)=>Boolean(p.email)),
      address:coverage(publicPlaces,(p)=>Boolean(p.address)),
      bookingUrl:coverage(publicPlaces,(p)=>Boolean(p.bookingUrl)),
      fee:coverage(publicPlaces,(p)=>p.fee!==undefined&&p.fee!==null&&p.fee!==''),
      wheelchair:coverage(publicPlaces,(p)=>Boolean(p.wheelchair)),
      operator:coverage(publicPlaces,(p)=>Boolean(p.operator)),
      reviewLinks:coverage(publicPlaces,(p)=>Boolean(p.reviewLinks?.length))
    },
    sourceTypes:countBy(publicPlaces,(p)=>p.sourceType),
    qualityTiers:countBy(publicPlaces,(p)=>p.qualityTier),
    regions:countBy(publicPlaces,(p)=>p.region),
    towns:Object.keys(countBy(publicPlaces,(p)=>p.town)).length,
    categories:countBy(publicPlaces,(p)=>(p.categories||[])[0]),
    categoryMembership,
    foodDiscovery:{
      listings:foodPlaces.length,
      types:Object.fromEntries(foodKinds.map(kind=>[kind,foodPlaces.filter(p=>(p.categories||[]).includes(kind)).length])),
      regions:Object.fromEntries(allRegions.map(region=>[region,foodPlaces.filter(p=>p.region===region).length])),
      missingRealPhoto:foodPlaces.filter(p=>!p.image||p.image.isFallback).length,
      media:{
        realHeroCoverage:coverage(foodPlaces,p=>p.image&&!p.image.isFallback),
        twoPlusImages:coverage(foodPlaces,p=>mediaCount(p)>=2)
      },
      details:{
        website:coverage(foodPlaces,p=>Boolean(p.website)),
        openingHours:coverage(foodPlaces,p=>Boolean(p.openingHours)),
        address:coverage(foodPlaces,p=>Boolean(p.address))
      },
      sourceTypes:countBy(foodPlaces,p=>p.sourceType)
    }
  },
  events:{
    active:activeEvents.length,
    ticketCoverage:{count:ticketReady.length,percent:pct(ticketReady.length,activeEvents.length)},
    priceCoverage:{count:priced.length,percent:pct(priced.length,activeEvents.length)},
    providers:countBy(ticketReady,(e)=>e.ticketProvider),
    sources:countBy(activeEvents,(e)=>e.sourceName),
    regions:fullRegionCoverage,
    regionsWithNoEvents:allRegions.filter(region=>!fullRegionCoverage[region]),
    ticketLinkChecks:{missingOrOlderThan30Days:ticketStale.length},
    sourceRegionalMix:countBy(activeEvents,(e)=>`${e.region} / ${e.sourceName||'unknown'}`)
  }
};
await fs.writeFile(OUT,`${JSON.stringify(audit,null,2)}\n`);
console.log(`Catalogue audit: ${audit.places.public} public places across ${audit.places.towns} towns; ${audit.places.media.realHeroCoverage.percent}% real heroes; ${audit.places.media.fourPlusImages.percent}% with 4+ licensed images; ${audit.places.sources.verifiedOfficialSourceCoverage.percent}% verified official sources.`);
console.log(`Detail coverage: hours ${audit.places.details.openingHours.percent}%, phone ${audit.places.details.phone.percent}%, email ${audit.places.details.email.percent}%, address ${audit.places.details.address.percent}%, booking ${audit.places.details.bookingUrl.percent}%, accessibility ${audit.places.details.wheelchair.percent}%.`);
console.log(`Events audit: ${audit.events.active} active; ${audit.events.ticketCoverage.percent}% with direct ticket/booking links; ${audit.events.priceCoverage.percent}% with price data.`);
console.log(`Place source mix: ${JSON.stringify(audit.places.sourceTypes)}.`);

console.log(`Event regional gaps: ${audit.events.regionsWithNoEvents.join(', ')||'none'}; ticket links with stale/absent check dates: ${ticketStale.length}.`);
console.log(`History category membership (any position): ${categoryMembership.History||0}; first-category count: ${audit.places.categories.History||0}.`);

console.log(`Food discovery audit: ${audit.places.foodDiscovery.listings} listings; ${audit.places.foodDiscovery.media.realHeroCoverage.percent}% photographed; ${audit.places.foodDiscovery.missingRealPhoto} still using category artwork; ${JSON.stringify(audit.places.foodDiscovery.types)}.`);
