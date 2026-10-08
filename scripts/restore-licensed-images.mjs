import fs from 'node:fs/promises';
import { retainVerifiedMedia, verifiedMedia } from './discover/lib/preserve-media.mjs';

// One-time, conservative recovery from a known-good Git snapshot.
// Usage: node scripts/restore-licensed-images.mjs <old-places.json>
const previousPath=process.argv[2];
if(!previousPath) throw Error('Pass a known-good previous places.json path');
const target=new URL('../src/data/places.json',import.meta.url);
const [current,previous]=await Promise.all([
  fs.readFile(target,'utf8').then(JSON.parse),
  fs.readFile(previousPath,'utf8').then(JSON.parse)
]);
const key=(p)=>p.sourceId && p.sourceType? p.sourceType+':'+p.sourceId:null;
const originals=new Map(previous.filter(p=>key(p)).map(p=>[key(p),p]));
const seen=new Set();
const result={previous:previous.length,current:current.length,matched:0,restoredHeroes:0,restoredGalleryImages:0,unmatchedEarlierHeroes:0,skippedIdentity:0};
for(const place of current) {
  const id=key(place),old=id&&originals.get(id);
  if(!old) continue;
  seen.add(id);
  if(place.status!=='active'||place.visibility==='suppressed'||old.status!=='active')continue;
  const latDifference=Math.abs(Number(place.latitude)-Number(old.latitude));
  const lonDifference=Math.abs(Number(place.longitude)-Number(old.longitude));
  if(!Number.isFinite(latDifference)||!Number.isFinite(lonDifference)||
      latDifference>0.02||lonDifference>0.02){result.skippedIdentity++;continue;}
  result.matched++;
  const heroWasVerified=verifiedMedia(place.image);
  const galleryBefore=(place.gallery||[]).length;
  retainVerifiedMedia(place,old);
  if(!heroWasVerified&&verifiedMedia(place.image))result.restoredHeroes++;
  result.restoredGalleryImages+=Math.max(0,(place.gallery||[]).length-galleryBefore);
}
for(const old of previous)if(verifiedMedia(old.image)&&(!key(old)||!seen.has(key(old))))result.unmatchedEarlierHeroes++;
await fs.writeFile(target,JSON.stringify(current,null,2)+'\n');
console.log('Verified historical media restoration: '+JSON.stringify(result));
