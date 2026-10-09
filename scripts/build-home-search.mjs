import fs from 'node:fs/promises';

const source=new URL('../src/data/places.json',import.meta.url);
const destination=new URL('../public/data/home-search.json',import.meta.url);
const places=JSON.parse(await fs.readFile(source,'utf8'));
const records=places.filter(p=>p.status==='active'&&p.visibility!=='suppressed').sort((a,b)=>
  Number(Boolean(b.featured))-Number(Boolean(a.featured))||
  (b.qualityScore||0)-(a.qualityScore||0)||a.name.localeCompare(b.name)
).map(p=>({
  slug:p.slug,name:p.name,town:p.town,region:p.region,
  categories:p.categories||[],latitude:p.latitude,longitude:p.longitude,
  image:p.image?.url||'/images/categories/discover.svg',
  alt:p.image?.alt||p.name,summary:p.summary||''
}));
const out=JSON.stringify({version:1,count:records.length,places:records});
if(Buffer.byteLength(out)>1600000)throw new Error('Compact homepage search index is too large');
await fs.mkdir(new URL('../public/data/',import.meta.url),{recursive:true});
await fs.writeFile(destination,out+'\n');
console.log('Homepage search index: '+records.length+' places, '+Buffer.byteLength(out)+' bytes. HTML renders only the first 18.');
