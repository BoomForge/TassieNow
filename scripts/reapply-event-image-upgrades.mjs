import fs from 'node:fs/promises';
import {sameEvent,imageIsPublishable,shouldUpgradeEventImage} from './discover/lib/event-media.mjs';
const [beforePath,afterPath]=process.argv.slice(2);
if(!beforePath||!afterPath)throw Error('Usage: node scripts/reapply-event-image-upgrades.mjs before.json after.json');
const file=new URL('../src/data/events.json',import.meta.url);
const [before,after,current]=await Promise.all([beforePath,afterPath,file].map(p=>fs.readFile(p,'utf8').then(JSON.parse)));
let added=0,skipped=0;
for(const e of current){
 const old=before.find(p=>sameEvent(p,e)),newer=after.find(p=>sameEvent(p,e));
 if(!newer||!imageIsPublishable(newer.image))continue;
 if(old&&imageIsPublishable(old.image)&&old.image.url===newer.image.url)continue;
 if(!shouldUpgradeEventImage(e.image,newer.image)){skipped++;continue;}
 e.image=structuredClone(newer.image);added++;
}
if(added)await fs.writeFile(file,JSON.stringify(current,null,2)+'\n');
console.log('Reapplied event photo upgrades onto newest main: '+JSON.stringify({added,concurrentMediaPreserved:skipped}));
