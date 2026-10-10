import fs from 'node:fs/promises';
import {applyVerifiedPhotoPicks} from './discover/lib/verified-photo-picks.mjs';
const path=new URL('../src/data/places.json',import.meta.url);
const places=JSON.parse(await fs.readFile(path,'utf8'));
const added=applyVerifiedPhotoPicks(places);
if(added)await fs.writeFile(path,JSON.stringify(places,null,2)+'\n');
console.log('Independently verified Commons image improvements: '+added);
