import fs from 'node:fs/promises';
import {preserveEventImages} from './discover/lib/event-media.mjs';
const prior=process.argv[2];
if(!prior)throw new Error('Usage: node scripts/preserve-event-images.mjs previous-events.json');
const file=new URL('../src/data/events.json',import.meta.url);
const [old,current]=await Promise.all([fs.readFile(prior,'utf8').then(JSON.parse),fs.readFile(file,'utf8').then(JSON.parse)]);
const kept=preserveEventImages(current,old);
if(kept)await fs.writeFile(file,JSON.stringify(current,null,2)+'\n');
console.log('Event imagery preserved across fresh discovery: '+kept);
