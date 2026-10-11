import fs from 'node:fs/promises';
import {mergePhotoLinkResearch} from './discover/lib/automatic-photo-sources.mjs';

const snapshot=process.argv[2];
if(!snapshot)throw Error('Usage: node scripts/reapply-auto-photo-sources.mjs <scanned-snapshot.json>');
const target=new URL('../src/data/auto-photo-source-links.json',import.meta.url);
const [before,scanned]=await Promise.all([
  fs.readFile(target,'utf8').then(JSON.parse),
  fs.readFile(snapshot,'utf8').then(JSON.parse)
]);
const merged=mergePhotoLinkResearch(before,scanned);
if(JSON.stringify(merged)!==JSON.stringify(before)){
  await fs.writeFile(target,JSON.stringify(merged,null,2)+'\n');
  console.log('Retained '+Object.keys(merged.places).length+' place and '+
    Object.keys(merged.events).length+' event original-source links, '+Object.keys(merged.scans).length+' scan records.');
} else console.log('No additional original source links to reapply.');
