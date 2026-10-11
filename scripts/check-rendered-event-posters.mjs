import fs from 'node:fs/promises';
import path from 'node:path';
import events from '../src/data/events.json' with {type:'json'};
const fallback=events.filter(e=>e.slug&&(!e.image||e.image.isFallback));
let missing=[];
for(const e of fallback){
 const target=path.join('dist','images','event-posters',e.slug+'.svg');
 try {
  const svg=await fs.readFile(target,'utf8');
  if(!svg.includes('<svg ')||!svg.includes('</svg>')||
     !svg.includes('TASSIENOW'))missing.push(e.slug+' (corrupt)');
 }catch{missing.push(e.slug+' (not built)');}
}
console.log('Original event poster coverage: '+(fallback.length-missing.length)+'/'+fallback.length);
if(missing.length){
 console.error('Missing original art:',missing.slice(0,12).join(', '));
 process.exitCode=1;
}
