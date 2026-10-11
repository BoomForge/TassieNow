import fs from 'node:fs/promises';
import {permittedLicence} from './discover/lib/event-media.mjs';
import {isMarketPlace,selectPhotoEnrichmentTargets} from './discover/lib/image-enrichment-targets.mjs';

const FILE = new URL('../src/data/places.json', import.meta.url);
const UA = 'TassieNow/1.2 (+https://tassienow.com)';
const MAX_PER_RUN = Math.max(1, Math.min(80, Number.parseInt(process.env.MAX_IMAGE_ENRICH || '90', 10) || 90));
const GALLERY_SIZE = Math.max(1, Math.min(12, Number.parseInt(process.env.GALLERY_SIZE || '3', 10) || 3));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const stats={requests:0,failures:0,rateLimited:0,retries:0,searchResults:0,identityRejected:0,licenceRejected:0,eligible:0,matchingPlaces:0,errorSamples:[]};
const MIN_REQUEST_INTERVAL_MS=1200;
let lastRequestAt=0;
const clean = (value = '') => String(value).replace(/<[^>]*>/g, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/\s+/g, ' ').trim();
const GENERIC_IMAGE_TOKENS = new Set(['tasmania','tasmanian','the','park','walk','lookout','museum','gallery','falls','fall','beach','bay','mount','mountain','river','lake','cliffs','cliff','point','rock','reserve','trail','track','island','wildlife','nature']);
const tokens = (value = '') => clean(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length >= 4 && !GENERIC_IMAGE_TOKENS.has(token));

function candidateScore(place, page, info) {
  const title = clean(page.title).toLowerCase();
  const meta = info.extmetadata || {};
  const blob = clean(`${meta.ObjectName?.value || ''} ${meta.ImageDescription?.value || ''} ${meta.Categories?.value || ''} ${meta.Credit?.value || ''}`).toLowerCase();
  if (/\b(logo|map|diagram|coat of arms|flag|icon|signage|sign|poster|brochure|floor plan|locator map)\b/.test(title)) return 0;
  const placeTokens = tokens(place.name);
  const titleTokens = tokens(title);
  const titleHits = placeTokens.filter((token) => titleTokens.includes(token)).length;
  const blobHits = placeTokens.filter((token) => blob.includes(token)).length;
  const natureLike = place.categories?.some((category) => /nature|walk|outdoor/i.test(category));
  let score = 0;
  const normalizedName = clean(place.name).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const normalizedTitle = title.replace(/[^a-z0-9]+/g,' ');
  const exactName = normalizedName.length>=8 && normalizedTitle.includes(normalizedName);
  const placeContext = `${title} ${blob}`;
  const correctTown = place.town && placeContext.includes(String(place.town).toLowerCase());
  const tasmaniaContext = /tasmania|tasmanian/.test(placeContext);
  if((place.categories||[]).includes('Food & Drink') && !correctTown) return 0;
  // A complete named-place match is much stronger than an isolated keyword.
  // Food/business names still need their town to avoid same-name collisions.
  if(exactName && ((place.categories||[]).includes('Food & Drink') ? correctTown : (correctTown || tasmaniaContext)))score += 48;
  score += titleHits * 24;
  if (blob.includes('tasmania')) score += 14;
  if (place.town && (`${title} ${blob}`).includes(String(place.town).toLowerCase())) score += 10;
  score += Math.min(18, blobHits * 9);
  if (/\.(?:jpe?g|webp)$/i.test(title)) score += 4;
  if (place.categories?.some((category) => /museum|wildlife|nature|walk|attraction|food|market/i.test(category)) && blob.includes(String(place.categories[0] || '').toLowerCase())) score += 3;
  // Search results are heuristic. For nature destinations in particular, a generic
  // Tasmania/town match is not enough evidence that the photo depicts this place.
  if (natureLike && placeTokens.length && titleHits === 0 && blobHits < 2) return 0;
  if (placeTokens.length && titleHits === 0 && blobHits === 0) return 0;
  return score;
}

function imageFromCandidate(place, page, info, score) {
  const meta = info.extmetadata || {};
  const license = clean(meta.LicenseShortName?.value || meta.UsageTerms?.value || '');
  if (!permittedLicence(license,meta.LicenseUrl?.value)) { stats.licenceRejected++; return null; }
  return {
    url: info.thumburl || info.url,
    alt: `${place.name}, Tasmania`,
    attribution: clean(meta.Artist?.value || meta.Credit?.value || '') || 'Wikimedia Commons contributor',
    license,
    licenseUrl: meta.LicenseUrl?.value || null,
    sourceUrl: info.descriptionurl || null,
    isFallback: false,
    sourceMethod: 'commons-search',
    confidence: score >= 58 ? 'high' : 'medium'
  };
}

async function fetchCommonsWithBackoff(url){
  for(let attempt=0;attempt<3;attempt++){
    const wait=Math.max(0,lastRequestAt+MIN_REQUEST_INTERVAL_MS-Date.now());
    if(wait)await sleep(wait);
    lastRequestAt=Date.now();
    stats.requests++;
    const response=await fetch(url,{headers:{'user-agent':UA,accept:'application/json'},signal:AbortSignal.timeout(12000)});
    if(response.status===429 || response.status===503){
      stats.rateLimited++;
      if(attempt===2)throw Error('Wikimedia search HTTP '+response.status+' after retries');
      stats.retries++;
      const retryAfter=Number(response.headers.get('retry-after'));
      await sleep(Math.min(20000,Math.max(2500,Number.isFinite(retryAfter)&&retryAfter>0?retryAfter*1000:3500*(attempt+1))));
      continue;
    }
    if(!response.ok)throw Error('Wikimedia search HTTP '+response.status);
    return response.json();
  }
  throw Error('Wikimedia image search exhausted retry budget');
}
async function queryCommons(place, searchText) {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('format', 'json');
  url.searchParams.set('generator', 'search');
  url.searchParams.set('gsrnamespace', '6');
  url.searchParams.set('gsrlimit', '14');
  url.searchParams.set('gsrsearch', searchText);
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('iiprop', 'url|extmetadata');
  url.searchParams.set('iiurlwidth', '1400');
  try {
    const data = await fetchCommonsWithBackoff(url);
    const candidates = [];
    const pages=Object.values(data.query?.pages || {});
    stats.searchResults+=pages.length;
    for (const page of pages) {
      const info = page.imageinfo?.[0];
      if (!info) continue;
      const score = candidateScore(place, page, info);
      if (score < 55) { stats.identityRejected++; continue; }
      const image = imageFromCandidate(place, page, info, score);
      if (image) { candidates.push({ image, score }); stats.eligible++; }
    }
    return candidates.sort((a, b) => b.score - a.score);
  } catch (error) {
    stats.failures++;
    if(stats.errorSamples.length<5)stats.errorSamples.push(String(error.message));
    return [];
  }
}

function commonsFilename(image) {
  if (!image?.sourceUrl || !/commons\.wikimedia\.org\/wiki\/File:/i.test(image.sourceUrl)) return null;
  try { return decodeURIComponent(new URL(image.sourceUrl).pathname.replace(/^\/wiki\/File:/i, '')).replace(/_/g, ' '); } catch { return null; }
}
function fallbackImage(place) {
  const value = (place.categories || []).join('|').toLowerCase();
  let name = 'discover';
  if (/rainy day|indoor/.test(value)) name = 'indoor';
  else if (/market/.test(value)) name = 'markets';
  else if (/museum|gallery|heritage|art & culture|culture/.test(value)) name = 'culture';
  else if (/wildlife|zoo|animal|sanctuary/.test(value)) name = 'wildlife';
  else if (/family|kids|children/.test(value)) name = 'family';
  else if (/food|local produce|farm|brewery|winery/.test(value)) name = 'food';
  else if (/nature|walk|outdoor|beach|lookout|park|reserve/.test(value)) name = 'nature';
  return { url: `/images/categories/${name}.svg`, alt: `${place.name} category artwork`, attribution: 'TassieNow', license: 'Site artwork', licenseUrl: null, sourceUrl: null, isFallback: true };
}
async function existingCommonsMetadata(filenames) {
  const out = new Map();
  const unique = [...new Set(filenames.filter(Boolean))];
  for (let i = 0; i < unique.length; i += 30) {
    const batch = unique.slice(i, i + 30);
    const url = new URL('https://commons.wikimedia.org/w/api.php');
    url.searchParams.set('action', 'query');
    url.searchParams.set('format', 'json');
    url.searchParams.set('prop', 'imageinfo');
    url.searchParams.set('iiprop', 'url|extmetadata');
    url.searchParams.set('iiurlwidth', '1400');
    url.searchParams.set('titles', batch.map((name) => `File:${name}`).join('|'));
    try {
      const response = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
      if (!response.ok) continue;
      const data = await response.json();
      for (const page of Object.values(data.query?.pages || {})) {
        const info = page.imageinfo?.[0]; if (!info) continue;
        out.set(String(page.title || '').replace(/^File:/i, '').replace(/_/g, ' '), { page, info });
      }
    } catch { /* keep existing media if Commons is temporarily unavailable */ }
  }
  return out;
}

async function searchImages(place) {
  // A single broad query avoids spending the Wikimedia rate limit on
  // duplicate quoted and unquoted requests for the same place.
  const found=await queryCommons(place,`${place.name} ${place.town||''} Tasmania`);
  return found.map(entry=>entry.image);
}

function imageKey(image) { return image?.sourceUrl || image?.url || ''; }

const places = JSON.parse(await fs.readFile(FILE, 'utf8'));
const generated = places.filter((place) => place.status === 'active' && place.visibility !== 'suppressed' && !place.managedManually && place.sourceType !== 'manual');
const heuristicFiles = generated.flatMap((place) => [place.image, ...(place.gallery || [])])
  .filter((image) => image?.sourceMethod === 'commons-search')
  .map(commonsFilename)
  .filter(Boolean);
const existingMeta = await existingCommonsMetadata(heuristicFiles);
let rejectedExisting = 0;
for (const place of generated) {
  if (place.image?.isFallback) place.image = fallbackImage(place);
  const validSearchImage = (image) => {
    if (!image || image.sourceMethod !== 'commons-search') return true;
    const filename = commonsFilename(image); if (!filename) return true;
    const meta = existingMeta.get(filename); if (!meta) return true;
    return candidateScore(place, meta.page, meta.info) >= 55;
  };
  if (place.image && !validSearchImage(place.image)) {
    place.image = fallbackImage(place);
    rejectedExisting++;
  }
  if (Array.isArray(place.gallery)) {
    const before = place.gallery.length;
    place.gallery = place.gallery.filter(validSearchImage);
    rejectedExisting += before - place.gallery.length;
    if (!place.gallery.length) delete place.gallery;
  }
}
const incomplete = places
  .filter(place=>place.status==='active' && place.visibility!=='suppressed' &&
    (place.image?.isFallback || (place.gallery?.length||0) <
       (isMarketPlace(place)?6:GALLERY_SIZE)))
  .sort((a,b)=>Number(Boolean(b.image?.isFallback))-Number(Boolean(a.image?.isFallback))||
    (b.qualityScore||0)-(a.qualityScore||0)||a.name.localeCompare(b.name));
const day=Math.floor(Date.now()/86400000);
const {targets,marketQuota,foodQuota,marketTargetCount}=
  selectPhotoEnrichmentTargets(incomplete,MAX_PER_RUN,day);
let heroUpgraded = 0;
let galleryAdded = 0;

for (const place of targets) {
  const found = await searchImages(place);
  if(found.length)stats.matchingPlaces++;
  const used = new Set();
  if (place.image && !place.image.isFallback) used.add(imageKey(place.image));
  for (const image of place.gallery || []) used.add(imageKey(image));
  let candidates = found.filter((image) => imageKey(image) && !used.has(imageKey(image)));

  if (place.image?.isFallback && candidates.length) {
    place.image = candidates.shift();
    used.add(imageKey(place.image));
    heroUpgraded++;
  }

  const gallery = Array.isArray(place.gallery) ? place.gallery.filter((image) => image && !image.isFallback) : [];
  for (const image of candidates) {
    if (gallery.length >= (isMarketPlace(place)?6:GALLERY_SIZE)) break;
    const key = imageKey(image);
    if (!key || used.has(key)) continue;
    gallery.push(image);
    used.add(key);
    galleryAdded++;
  }
  if (gallery.length) place.gallery = gallery.slice(0, isMarketPlace(place)?6:GALLERY_SIZE);
  await sleep(80);
}

await fs.writeFile(FILE, `${JSON.stringify(places, null, 2)}\n`);
const publicPlaces = places.filter((place) => place.status === 'active' && place.visibility !== 'suppressed');
const realHeroes = publicPlaces.filter((place) => place.image && !place.image.isFallback).length;
const galleries = publicPlaces.filter((place) => place.gallery?.length).length;
console.log(`Image enrichment: revalidated heuristic media and rejected ${rejectedExisting} weak match(es); checked ${targets.length} incomplete listings (${marketTargetCount} market, ${foodQuota} food-priority slot(s)); upgraded ${heroUpgraded} hero image(s); added ${galleryAdded} gallery image(s).`);
console.log(`Image coverage: real hero images ${realHeroes}/${publicPlaces.length}; multi-image galleries ${galleries}/${publicPlaces.length}. ${Math.max(0, incomplete.length - targets.length)} incomplete listing(s) remain for future passes.`);

await fs.mkdir(new URL('../reports/',import.meta.url),{recursive:true});
await fs.writeFile(new URL('../reports/place-image-discovery.json',import.meta.url),JSON.stringify({checkedAt:new Date().toISOString(),checked:targets.length,foodPriority:foodQuota,marketPriority:marketQuota,marketTargets:marketTargetCount,heroUpgraded,galleryAdded,...stats},null,2)+'\n');
console.log('Place photo source diagnostics: '+JSON.stringify(stats));
if(stats.requests>=10&&stats.failures>=Math.ceil(stats.requests*.75))throw Error('Wikimedia image source unhealthy: '+stats.failures+'/'+stats.requests+' queries failed; see place-image-discovery.json');
if(!heroUpgraded&&!galleryAdded)console.warn('No eligible new place photographs in this pass; see research diagnostics, not an image publication success.');
