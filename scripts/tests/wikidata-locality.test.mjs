import test from 'node:test';
import assert from 'node:assert/strict';
import {verifiedWikidataLocality} from '../discover/lib/wikidata-locality.mjs';
import {readFileSync} from 'node:fs';

test('genuine settlement labels survive Wikidata locality validation',()=>{
 for(const name of ['Mole Creek','George Town','Port Sorell','St Helens','O\'Connor','Cygnet']){
  assert.equal(verifiedWikidataLocality(name),name);
 }
});
test('state, council and uncertain administrative labels are not invented as towns',()=>{
 for(const name of ['Tasmania','TAS','Australia','George Town Council','Kingborough Council',
   'City Council','Huon Valley Municipal Area','Q123456','Northern Tasmania','','   ','Launceston Local Government Area']){
  assert.equal(verifiedWikidataLocality(name),null,name);
 }
});
test('Wikidata importer must use the validated locality and skip unsupported settlements',()=>{
 const source=readFileSync(new URL('../discover/wikidata-import.mjs',import.meta.url),'utf8');
 assert.match(source,/verifiedWikidataLocality\(clean\(binding\.adminLabel\?\.value\)\)/);
 assert.match(source,/if \(!town\) continue/);
 assert.doesNotMatch(source,/town\s*=\s*'Tasmania'/);
});
