import fs from 'node:fs/promises';

const FILE = new URL('../src/data/places.json', import.meta.url);
const USER_AGENT = 'TassieNow/1.4 (+https://tassienow.com)';

const clean = (value='') => String(value).replace(/<[^>]*>/g,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/\s+/g,' ').trim();

async function fetchJson(url, timeout=18000) {
  const response = await fetch(url, {
    headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
    signal: AbortSignal.timeout(timeout)
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

async function wikidataP18(ids) {
  const out = new Map();
  for (let i=0;i<ids.length;i+=50) {
    const batch=ids.slice(i,i+50);
    const url=new URL('https://www.wikidata.org/w/api.php');
    url.searchParams.set('action','wbgetentities');
    url.searchParams.set('format','json');
    url.searchParams.set('props','claims');
    url.searchParams.set('ids',batch.join('|'));
    try {
      const data=await fetchJson(url);
      for (const id of batch) {
        const filename=data.entities?.[id]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
        if (filename) out.set(id,String(filename));
      }
    } catch (error) {
      console.warn(`Wikidata image batch skipped: ${error.message}`);
    }
  }
  return out;
}

async function commonsMetadata(filenames) {
  const out=new Map();
  const unique=[...new Set(filenames.filter(Boolean))];
  for (let i=0;i<unique.length;i+=30) {
    const batch=unique.slice(i,i+30);
    const url=new URL('https://commons.wikimedia.org/w/api.php');
    url.searchParams.set('action','query');
    url.searchParams.set('format','json');
    url.searchParams.set('prop','imageinfo');
    url.searchParams.set('iiprop','url|extmetadata');
    url.searchParams.set('iiurlwidth','1400');
    url.searchParams.set('titles',batch.map((name)=>`File:${name}`).join('|'));
    try {
      const data=await fetchJson(url);
      for (const page of Object.values(data.query?.pages||{})) {
        const info=page.imageinfo?.[0];
        if (!info) continue;
        const filename=String(page.title||'').replace(/^File:/i,'');
        const meta=info.extmetadata||{};
        const license=clean(meta.LicenseShortName?.value||meta.UsageTerms?.value||'');
        if (!license) continue;
        out.set(filename,{
          url:info.thumburl||info.url,
          attribution:clean(meta.Artist?.value||meta.Credit?.value||'')||'Wikimedia Commons contributor',
          license,
          licenseUrl:meta.LicenseUrl?.value||null,
          sourceUrl:info.descriptionurl||null,
          isFallback:false,
          sourceMethod:'wikidata-p18',
          confidence:'high'
        });
      }
    } catch (error) {
      console.warn(`Commons metadata batch skipped: ${error.message}`);
    }
  }
  return out;
}

const places=JSON.parse(await fs.readFile(FILE,'utf8'));
const targets=places.filter((place)=>
  place.status==='active' &&
  place.visibility!=='suppressed' &&
  place.image?.isFallback &&
  /^Q\d+$/.test(String(place.wikidata||place.sourceId||''))
);

if (!targets.length) {
  console.log('Wikidata exact-image pass: no fallback Wikidata listings remain.');
  process.exit(0);
}

const ids=[...new Set(targets.map((place)=>String(place.wikidata||place.sourceId)))];
const p18=await wikidataP18(ids);
const metadata=await commonsMetadata([...p18.values()]);
let upgraded=0;

for (const place of targets) {
  const id=String(place.wikidata||place.sourceId);
  const filename=p18.get(id);
  const image=filename?metadata.get(filename):null;
  if (!image) continue;
  place.image={...image,alt:`${place.name}, Tasmania`};
  upgraded++;
}

await fs.writeFile(FILE,`${JSON.stringify(places,null,2)}\n`);
console.log(`Wikidata exact-image pass: upgraded ${upgraded}/${targets.length} fallback listing(s) from item-linked P18 images.`);
