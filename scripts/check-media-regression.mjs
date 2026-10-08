import fs from 'node:fs/promises';

// Fail the import before publication if routine refreshes discard a material
// number of previously available real-photo heroes.
const prior=process.argv[2];
if(!prior)throw Error('Usage: node scripts/check-media-regression.mjs <previous-places.json>');
const currentFile=new URL('../src/data/places.json',import.meta.url);
const [before,after]=await Promise.all([fs.readFile(prior,'utf8').then(JSON.parse),fs.readFile(currentFile,'utf8').then(JSON.parse)]);
const publicReal=(records)=>records.filter(p=>p.status==='active'&&p.visibility!=='suppressed'&&p.image&&!p.image.isFallback).length;
const previous=publicReal(before),current=publicReal(after),drop=previous-current;
const allowable=Math.max(8,Math.ceil(previous*0.05));
console.log('Verified public hero count: '+previous+' before → '+current+' after; drop '+Math.max(0,drop)+'; safety threshold '+allowable+'.');
if(drop>allowable)throw Error('Refusing automated media regression. Investigate importer/source churn and intentionally removed photographs; do not weaken the guard.');
