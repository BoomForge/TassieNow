import fs from 'node:fs/promises';

const places = JSON.parse(await fs.readFile(new URL('../src/data/places.json', import.meta.url), 'utf8'));
const events = JSON.parse(await fs.readFile(new URL('../src/data/events.json', import.meta.url), 'utf8'));

const BASE = (process.env.SITE_URL || 'https://tassienow.com').replace(/\/$/, '');
const FULL_SUBMIT = process.env.FULL_SUBMIT === '1';
const DRY_RUN = process.env.WAYBACK_DRY_RUN === '1';
const MAX_URLS = Math.max(1, Math.min(Number(process.env.MAX_WAYBACK_URLS || 4), 8));
const RECENT_CAPTURE_HOURS = 12;
const REQUEST_DELAY_MS = 22000;

const slugify = (value) => String(value || '')
  .toLowerCase()
  .replace(/&/g, 'and')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

function tasDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Hobart',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

const today = tasDate();
const cutoffDate = new Date(`${today}T00:00:00Z`);
cutoffDate.setUTCDate(cutoffDate.getUTCDate() - 2);
const cutoff = cutoffDate.toISOString().slice(0, 10);

const changed = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && value >= cutoff;
const placeChanged = (place) => [
  place.lastChecked,
  place.lastDetailsChecked,
  place.lastWikidataChecked,
  place.rankedAt
].some(changed);
const eventChanged = (event) => [event.lastChecked, event.updatedAt, event.startDate].some(changed);

const urls = [];
const seen = new Set();
const add = (path) => {
  const url = new URL(path, `${BASE}/`).href;
  if (!seen.has(url)) {
    seen.add(url);
    urls.push(url);
  }
};

if (FULL_SUBMIT) {
  add('/');
  add('/sitemap.xml');
  add('/feed.xml');
  add('/about/');
  add('/discover/today/');
  add('/discover/this-weekend/');
  add('/discover/kids/');
  add('/discover/free/');
} else {
  for (const place of places) {
    if (place.status !== 'active' || place.visibility === 'suppressed' || !placeChanged(place)) continue;
    add(`/place/${place.slug}/`);
    if (place.town) add(`/town/${slugify(place.town)}/`);
    if (place.region) add(`/region/${slugify(place.region)}/`);
  }

  for (const event of events) {
    if (event.status !== 'active' || !eventChanged(event)) continue;
    add(`/event/${event.slug}/`);
  }

  add('/');
  add('/feed.xml');
  add('/sitemap.xml');
}

const targets = urls.slice(0, MAX_URLS);

function parseWaybackTimestamp(value) {
  if (!/^\d{14}$/.test(value || '')) return null;
  const year = value.slice(0, 4);
  const month = value.slice(4, 6);
  const day = value.slice(6, 8);
  const hour = value.slice(8, 10);
  const minute = value.slice(10, 12);
  const second = value.slice(12, 14);
  const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function capturedRecently(url) {
  try {
    const endpoint = new URL('https://archive.org/wayback/available');
    endpoint.searchParams.set('url', url);
    endpoint.searchParams.set('timestamp', new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14));

    const response = await fetch(endpoint, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) return false;

    const data = await response.json();
    const closest = data?.archived_snapshots?.closest;
    if (!closest?.available || closest.status !== '200') return false;

    const capturedAt = parseWaybackTimestamp(closest.timestamp);
    if (!capturedAt) return false;

    return Date.now() - capturedAt.getTime() < RECENT_CAPTURE_HOURS * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

async function savePage(url) {
  const body = new URLSearchParams({ url });
  const response = await fetch('https://web.archive.org/save/', {
    method: 'POST',
    headers: {
      accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.5',
      'content-type': 'application/x-www-form-urlencoded',
      'user-agent': 'TassieNow/1.0 (+https://tassienow.com/)'
    },
    body,
    redirect: 'manual',
    signal: AbortSignal.timeout(30000)
  });

  if ([200, 201, 202, 301, 302, 303, 307, 308].includes(response.status)) {
    console.log(`Wayback accepted ${url} (HTTP ${response.status}).`);
    return 'accepted';
  }

  const message = (await response.text()).replace(/\s+/g, ' ').slice(0, 240);

  if ([401, 403].includes(response.status)) {
    console.warn(`Wayback anonymous capture is unavailable from this runner (HTTP ${response.status}). ${message}`);
    return 'blocked';
  }

  if ([429, 503, 509].includes(response.status)) {
    console.warn(`Wayback throttled this run (HTTP ${response.status}). ${message}`);
    return 'throttled';
  }

  console.warn(`Wayback returned HTTP ${response.status} for ${url}. ${message}`);
  return 'failed';
}

if (!targets.length) {
  console.log('No public URLs need Wayback preservation on this run.');
  process.exit(0);
}

if (DRY_RUN) {
  console.log(`Wayback dry run: ${targets.length} URL(s).`);
  for (const url of targets) console.log(url);
  process.exit(0);
}

let submitted = 0;
let skipped = 0;

for (let index = 0; index < targets.length; index += 1) {
  const url = targets[index];

  if (await capturedRecently(url)) {
    console.log(`Wayback already has a recent capture for ${url}; skipping.`);
    skipped += 1;
    continue;
  }

  try {
    const result = await savePage(url);
    if (result === 'blocked' || result === 'throttled') break;
    if (result === 'accepted') submitted += 1;
  } catch (error) {
    console.warn(`Wayback capture failed for ${url}: ${error.message}`);
  }

  if (index < targets.length - 1) {
    await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
  }
}

console.log(`Wayback preservation finished. Submitted: ${submitted}. Recently captured: ${skipped}. Requested: ${targets.length}.`);
