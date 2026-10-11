import fs from 'node:fs/promises';
import {mergePlacePhotoReview} from './discover/lib/openverse-photo-candidates.mjs';

const savedPath=process.argv[2];
if(!savedPath)throw Error('Usage: node scripts/reapply-place-photo-review.mjs SAVED_QUEUE.json');
const path=new URL('../src/data/place-media-review.json',import.meta.url);
const [saved,current]=await Promise.all([
  fs.readFile(savedPath,'utf8').then(JSON.parse),
  fs.readFile(path,'utf8').then(JSON.parse)
]);
const {queue,added,placesAdded}=mergePlacePhotoReview(current,saved);
if(added)await fs.writeFile(path,JSON.stringify(queue,null,2)+'\n');
console.log('Durable Openverse research: '+JSON.stringify({added,placesAdded,queuedPlaces:Object.keys(queue).length}));
