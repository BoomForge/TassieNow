import fs from 'node:fs/promises';
import path from 'node:path';

const places=JSON.parse(await fs.readFile('src/data/places.json','utf8'));
const markets=places.filter(p=>p.status==='active' &&
 p.visibility!=='suppressed' && (p.categories||[]).includes('Markets'));
const paidMarkers=[
 'maps.googleapis.com/maps/api/js',
 'gmp-place-details',
 'gmp-place-all-content',
 'PUBLIC_GOOGLE_MAPS_API_KEY',
 'google.maps.importLibrary('
];
const failures=[];
for(const market of markets){
 const file=path.join('dist','place',market.slug,'index.html');
 try{
  const html=await fs.readFile(file,'utf8');
  const banned=paidMarkers.filter(text=>html.includes(text));
  if(banned.length)failures.push(market.slug+': paid Maps/Places code '+banned.join(','));
  if(!html.includes('View visitor photos on Google Maps'))failures.push(market.slug+': missing free Google Maps link');
  if(!html.includes('/suggest-update/?'))failures.push(market.slug+': missing organiser photo submission');
 }catch(error){failures.push(market.slug+': missing built page ('+error.code+')');}
}
console.log('Zero-cost market pages verified: '+(markets.length-failures.length)+'/'+markets.length);
if(failures.length){
 for(const failure of failures.slice(0,30))console.error(failure);
 process.exitCode=1;
}
