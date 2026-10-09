import fs from 'node:fs/promises';
import {verifiedMedia} from './discover/lib/preserve-media.mjs';

const beforePath=process.argv[2], afterPath=process.argv[3];
if(!beforePath||!afterPath)throw new Error('Usage: node scripts/reapply-image-upgrades.mjs BEFORE.json AFTER.json');
const file=new URL('../src/data/places.json',import.meta.url);
const [before,after,current]=await Promise.all([beforePath,afterPath,file].map(f=>fs.readFile(f,'utf8').then(JSON.parse)));
const index=arr=>new Map(arr.filter(p=>p.sourceType&&p.sourceId).map(p=>[p.sourceType+':'+p.sourceId,p]));
const baselines=index(before),prior=index(after);
const key=image=>image?.sourceUrl||image?.url||'';
let hero=0,gallery=0,missing=0,skipped=0;
for(const p of current){
 const id=p.sourceType+':'+p.sourceId;
 const older=baselines.get(id),enriched=prior.get(id);
 if(!older||!enriched){missing++;continue;}
 // Apply only media improvements actually made by this run, not old catalog
 // values, so a concurrent owner correction or newly verified image survives.
 const improved=verifiedMedia(enriched.image)&&(!verifiedMedia(older.image)||key(enriched.image)!==key(older.image));
 if(improved&&!verifiedMedia(p.image)){
   p.image=structuredClone(enriched.image);hero++;
 }else if(improved)skipped++;
 const beforeKeys=new Set((older.gallery||[]).filter(verifiedMedia).map(key));
 const nowKeys=new Set([key(p.image),...(p.gallery||[]).filter(verifiedMedia).map(key)]);
 const added=(enriched.gallery||[]).filter(img=>verifiedMedia(img)&&!beforeKeys.has(key(img))&&!nowKeys.has(key(img)));
 const output=[...(p.gallery||[]).filter(verifiedMedia)];
 for(const img of added){if(output.length>=12)break;output.push(structuredClone(img));nowKeys.add(key(img));gallery++;}
 if(output.length)p.gallery=output;
}
await fs.writeFile(file,JSON.stringify(current,null,2)+'\n');
console.log('Rebased image upgrades onto fresh catalogue: '+JSON.stringify({heroes:hero,gallery,missingSourceIds:missing,concurrentRealImagesProtected:skipped,publicPlaces:current.filter(p=>p.status==='active'&&p.visibility!=='suppressed').length}));
