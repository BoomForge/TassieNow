// A calendar-day checkpoint makes a static website refresh even when no events change.
// Run from GitHub Actions after midnight in Tasmania, accounting for AEST/AEDT.
import fs from 'node:fs/promises';
import { tasmaniaDate } from '../src/lib/market-seo.mjs';

const output = new URL('../public/data/site-build-date.json', import.meta.url);
const content = JSON.stringify({date:tasmaniaDate(),timezone:'Australia/Hobart'},null,2) + '\n';
const previous = await fs.readFile(output,'utf8').catch(()=>null);
if (previous === content) {
  console.log('TassieNow calendar checkpoint already current.');
} else {
  await fs.mkdir(new URL('../public/data/', import.meta.url),{recursive:true});
  await fs.writeFile(output,content);
  console.log('TassieNow calendar checkpoint advanced to '+tasmaniaDate());
}
