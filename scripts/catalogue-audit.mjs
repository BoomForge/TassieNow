import fs from 'node:fs/promises';

const PLACES = new URL('../src/data/places.json', import.meta.url);
const EVENTS = new URL('../src/data/events.json', import.meta.url);
const OUT = new URL('../src/data/catalogue-audit.json', import.meta.url);
function pct(value,total){return total?Math.round((value/total)*1000)/10:0;}
function countBy(items,keyFn){const out={};for(const item of items){const key=keyFn(item)||'unknown';out[key]=(out[key]||0)+1;}return Object.fromEntries(Object.entries(out).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])));}
function tasDate(date=new Date()){const p=new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Hobart',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);const g=(t)=>p.find((x)=>x.type===t)?.value;return`${g('year')}-${g('month')}-${g('day')}`;}
const today=tasDate();
const places=JSON.parse(await fs.readFile(PLACES,'utf8'));
const events=JSON.parse(await fs.readFile(EVENTS,'utf8'));
const publicPlaces=places.filter((p)=>p.status==='active'&&p.visibility!=='suppressed');
const activeEvents=events.filter((e)=>e.status==='active'&&e.endDate>=today);
const imageReady=publicPlaces.filter((p)=>p.image&&!p.image.isFallback);
const galleryReady=publicPlaces.filter((p)=>Array.isArray(p.gallery)&&p.gallery.length>1);
const websiteReady=publicPlaces.filter((p)=>p.website);
const scheduleReady=publicPlaces.filter((p)=>p.schedule?.summary);
const officialReady=publicPlaces.filter((p)=>p.officialSource?.url);
const ticketReady=activeEvents.filter((e)=>e.ticketUrl);
const priced=activeEvents.filter((e)=>e.priceFrom!==undefined||e.priceTo!==undefined);
const audit={
  generatedAt:today,
  places:{
    total:places.length,public:publicPlaces.length,suppressed:places.length-publicPlaces.length,
    imageCoverage:{count:imageReady.length,percent:pct(imageReady.length,publicPlaces.length)},
    galleryCoverage:{count:galleryReady.length,percent:pct(galleryReady.length,publicPlaces.length)},
    websiteCoverage:{count:websiteReady.length,percent:pct(websiteReady.length,publicPlaces.length)},
    scheduleCoverage:{count:scheduleReady.length,percent:pct(scheduleReady.length,publicPlaces.length)},
    officialSourceCoverage:{count:officialReady.length,percent:pct(officialReady.length,publicPlaces.length)},
    sourceTypes:countBy(publicPlaces,(p)=>p.sourceType),regions:countBy(publicPlaces,(p)=>p.region),towns:Object.keys(countBy(publicPlaces,(p)=>p.town)).length,
    categories:countBy(publicPlaces,(p)=>(p.categories||[])[0])
  },
  events:{
    active:activeEvents.length,
    ticketCoverage:{count:ticketReady.length,percent:pct(ticketReady.length,activeEvents.length)},
    priceCoverage:{count:priced.length,percent:pct(priced.length,activeEvents.length)},
    providers:countBy(ticketReady,(e)=>e.ticketProvider),sources:countBy(activeEvents,(e)=>e.sourceName),regions:countBy(activeEvents,(e)=>e.region)
  }
};
await fs.writeFile(OUT,`${JSON.stringify(audit,null,2)}\n`);
console.log(`Catalogue audit: ${audit.places.public} public places across ${audit.places.towns} towns; ${audit.places.imageCoverage.percent}% with licensed/non-fallback hero images.`);
console.log(`Events audit: ${audit.events.active} active; ${audit.events.ticketCoverage.percent}% with direct ticket/booking links; ${audit.events.priceCoverage.percent}% with price data.`);
console.log(`Place source mix: ${JSON.stringify(audit.places.sourceTypes)}.`);
