import fs from 'node:fs/promises';
// Merge discovered public organiser-image candidates onto the newest commit,
// without accepting them as licensed or overwriting another editor's review.
const savedPath=process.argv[2];
if(!savedPath)throw Error('Usage: node scripts/reapply-event-review.mjs queue-after-run.json');
const file=new URL('../src/data/event-media-review.json',import.meta.url);
const [saved,current]=await Promise.all([savedPath,file].map(p=>fs.readFile(p,'utf8').then(JSON.parse)));
let added=0;
for(const [slug,entry] of Object.entries(saved)){
 if(!entry?.name||!Array.isArray(entry.candidates))continue;
 if(current[slug])continue;
 current[slug]=entry;added++;
}
if(added)await fs.writeFile(file,JSON.stringify(current,null,2)+'\n');
console.log('Preserved new organiser photo review queue records across GitHub changes: '+added);
