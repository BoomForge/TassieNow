import fs from 'node:fs/promises';

const FILE = new URL('../src/data/places.json', import.meta.url);
const UA = 'TassieNow/1.2 (+https://tassienow.com)';
const MAX_PER_RUN = Math.max(1, Math.min(2000, Number.parseInt(process.env.MAX_IMAGE_ENRICH || '90', 10) || 90));
const GALLERY_SIZE = Math.max(1, Math.min(12, Number.parseInt(process.env.GALLERY_SIZE || '3', 10) || 3));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
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
  if (!license) return null;
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
    const response = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(12000) });
    if (!response.ok) return [];
    const data = await response.json();
    const candidates = [];
    for (const page of Object.values(data.query?.pages || {})) {
      const info = page.imageinfo?.[0];
      if (!info) continue;
      const score = candidateScore(place, page, info);
      if (score < 55) continue;
      const image = imageFromCandidate(place, page, info, score);
      if (image) candidates.push({ image, score });
    }
    return candidates.sort((a, b) => b.score - a.score);
  } catch {
    return [];
  }
}

async function searchImages(place) {
  const exact = await queryCommons(place, `"${place.name}" "${place.town || 'Tasmania'}" Tasmania`);
  await sleep(60);
  const broad = await queryCommons(place, `${place.name} ${place.town || ''} Tasmania`);
  const deduped = new Map();
  for (const candidate of [...exact, ...broad]) {
    const key = candidate.image.sourceUrl || candidate.image.url;
    const previous = deduped.get(key);
    if (!previous || candidate.score > previous.score) deduped.set(key, candidate);
  }
  return [...deduped.values()].sort((a, b) => b.score - a.score).map((entry) => entry.image);
}

function imageKey(image) { return image?.sourceUrl || image?.url || ''; }

const places = JSON.parse(await fs.readFile(FILE, 'utf8'));
const incomplete = places
  .filter((place) => place.status === 'active' && place.visibility !== 'suppressed' && (place.image?.isFallback || (place.gallery?.length || 0) < GALLERY_SIZE))
  .sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0) || a.name.localeCompare(b.name));
const day = Math.floor(Date.now() / 86400000);
const offset = incomplete.length ? (day * MAX_PER_RUN) % incomplete.length : 0;
const rotated = incomplete.length ? [...incomplete.slice(offset), ...incomplete.slice(0, offset)] : [];
const targets = rotated.slice(0, MAX_PER_RUN);
let heroUpgraded = 0;
let galleryAdded = 0;

for (const place of targets) {
  const found = await searchImages(place);
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
    if (gallery.length >= GALLERY_SIZE) break;
    const key = imageKey(image);
    if (!key || used.has(key)) continue;
    gallery.push(image);
    used.add(key);
    galleryAdded++;
  }
  if (gallery.length) place.gallery = gallery.slice(0, GALLERY_SIZE);
  await sleep(80);
}

await fs.writeFile(FILE, `${JSON.stringify(places, null, 2)}\n`);
const publicPlaces = places.filter((place) => place.status === 'active' && place.visibility !== 'suppressed');
const realHeroes = publicPlaces.filter((place) => place.image && !place.image.isFallback).length;
const galleries = publicPlaces.filter((place) => place.gallery?.length).length;
console.log(`Image enrichment: checked ${targets.length} incomplete listings from rotating offset ${offset}; upgraded ${heroUpgraded} hero image(s); added ${galleryAdded} gallery image(s).`);
console.log(`Image coverage: real hero images ${realHeroes}/${publicPlaces.length}; multi-image galleries ${galleries}/${publicPlaces.length}. ${Math.max(0, incomplete.length - targets.length)} incomplete listing(s) remain for future passes.`);
