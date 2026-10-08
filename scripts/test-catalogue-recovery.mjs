import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const files=['src/data/places.json','src/data/events.json','src/data/place-overrides.json'];
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'tassienow-restore-'));
try {
 for(const file of files){
   const snapshot=execFileSync('git',['show','HEAD:'+file],{encoding:'utf8',maxBuffer:32*1024*1024});
   const expected=JSON.parse(snapshot);
   assert.ok(expected && typeof expected==='object','snapshot must be JSON data');
   const target=path.join(temp,path.basename(file));
   await fs.writeFile(target,'{ CORRUPT }');
   await fs.writeFile(target,snapshot);
   assert.deepEqual(JSON.parse(await fs.readFile(target,'utf8')),expected,'restored temporary copy must match git snapshot');
   console.log('Restore simulation passed: '+file);
 }
 console.log('Restore drill PASS: corruption and Git snapshot restoration of temporary files; no production or working catalogue modified.');
}finally{await fs.rm(temp,{recursive:true,force:true});}
