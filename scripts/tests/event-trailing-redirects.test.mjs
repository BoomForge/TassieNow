import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const lines=fs.readFileSync(new URL('../../public/_redirects',import.meta.url),'utf8').split(/\r?\n/);
const pairs=lines.map(x=>x.trim()).filter(x=>x.startsWith('/')&&!x.startsWith('//')).map(x=>x.split(/\s+/));
const bySource=new Map();
for(const [from,to,status] of pairs){
  if(!from||!to||status!=='301')throw new Error('Invalid static redirect '+[from,to,status]);
  assert.ok(!bySource.has(from),'Duplicate source '+from);
  bySource.set(from,{to,status});
}
test('every old event path has a trailing-slash variant for Astro and Cloudflare Pages',()=>{
  for(const [from,{to}] of bySource){
    if(from.endsWith('/'))continue;
    const redirected=bySource.get(from+'/');
    assert.ok(redirected,'missing trailing variant for '+from);
    assert.equal(redirected.to,to.replace(/\/?$/,'/'));
  }
});
test('redirect definitions are safely within Cloudflare Pages static rule cap',()=>{
  assert.ok(pairs.length>50);
  assert.ok(pairs.length<=2000);
  assert.ok(pairs.every(p=>p.length===3));
});
