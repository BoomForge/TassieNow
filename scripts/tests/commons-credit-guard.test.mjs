import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {usableCommonsCreator} from '../discover/lib/commons-credit-guard.mjs';

test('Commons attribution licences require a real credited author',()=>{
 assert.equal(usableCommonsCreator({},'CC BY-SA 4.0','https://creativecommons.org/licenses/by-sa/4.0/'),null);
 assert.equal(usableCommonsCreator({Artist:{value:'Wikimedia Commons contributor'}},'CC BY 4.0'),null);
 assert.equal(usableCommonsCreator({Artist:{value:'<a>Dysprosia</a>'}},'CC BY-SA 4.0'),'Dysprosia');
 assert.equal(usableCommonsCreator({Credit:{value:'Jane Smith'}},'CC BY 4.0'),'Jane Smith');
 assert.equal(usableCommonsCreator({},'CC0','https://creativecommons.org/publicdomain/zero/1.0/'),'Public domain contributor');
 assert.equal(usableCommonsCreator({},'Public domain'),'Public domain contributor');
});
test('both existing image enrichment routes consult the Commons creator guard',()=>{
 for(const path of ['../enrich-images.mjs','../enrich-wikidata-images.mjs']){
  const source=readFileSync(new URL(path,import.meta.url),'utf8');
  assert.match(source,/usableCommonsCreator\(meta,license,meta\.LicenseUrl\?\.value\)/);
  assert.doesNotMatch(source,/attribution:\s*clean\(meta\.Artist/);
 }
});
