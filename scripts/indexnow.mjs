import fs from 'node:fs/promises';

const places = JSON.parse(await fs.readFile(new URL('../src/data/places.json', import.meta.url), 'utf8'));
const events = JSON.parse(await fs.readFile(new URL('../src/data/events.json', import.meta.url), 'utf8'));

const BASE = (process.env.SITE_URL || 'https://tassienow.com').replace(/\/$/, '');
const FULL_SUBMIT = process.env.FULL_SUBMIT === '1';
const KEY = '30516139ed96092d5fbd7676d4852aa2';
const KEY_LOCATION = `${BASE}/${KEY}.txt`;
const HOST = new URL(BASE).host;
const FEED_URL = `${BASE}/feed.xml`;

const slugify = (value) => String(value)
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

const changed = (value) => FULL_SUBMIT || (/^\d{4}-\d{2}-\d{2}$/.test(value || '') && value >= cutoff);
const placeChanged = (place) => FULL_SUBMIT || [
  place.lastChecked,
  place.lastDetailsChecked,
  place.lastWikidataChecked,
  place.rankedAt
].some(changed);
const eventChanged = (event) => FULL_SUBMIT || [event.lastChecked, event.updatedAt, event.startDate].some(changed);

const urls = new Set([
  `${BASE}/`,
  `${BASE}/about/`,
  `${BASE}/advertise/`,
  `${BASE}/sitemap.xml`,
  FEED_URL
]);

for (const mode of ['kids', 'free', 'rainy-day', 'today', 'this-weekend', 'markets', 'nature', 'food']) {
  urls.add(`${BASE}/discover/${mode}/`);
}

for (const place of places) {
  if (place.status !== 'active' || place.visibility === 'suppressed' || !placeChanged(place)) continue;
  urls.add(`${BASE}/place/${place.slug}/`);
  urls.add(`${BASE}/town/${slugify(place.town)}/`);
  urls.add(`${BASE}/region/${slugify(place.region)}/`);
}

for (const event of events) {
  if (event.status !== 'active' || !eventChanged(event)) continue;
  urls.add(`${BASE}/event/${event.slug}/`);
}

let liveKey = '';
try {
  const response = await fetch(KEY_LOCATION, { signal: AbortSignal.timeout(10000) });
  if (response.ok) liveKey = (await response.text()).trim();
} catch {
  // Deployment can briefly lag a GitHub push. Scheduled runs will retry automatically.
}

if (liveKey !== KEY) {
  console.warn(`IndexNow key is not live yet at ${KEY_LOCATION}; skipping IndexNow for this run.`);
} else {
  const list = [...urls];
  for (let i = 0; i < list.length; i += 1000) {
    const batch = list.slice(i, i + 1000);
    const response = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: HOST,
        key: KEY,
        keyLocation: KEY_LOCATION,
        urlList: batch
      }),
      signal: AbortSignal.timeout(20000)
    });

    if (![200, 202].includes(response.status)) {
      const message = (await response.text()).slice(0, 500);
      if (response.status === 429) {
        console.warn(`IndexNow rate-limited this batch: ${message}`);
        break;
      }
      if (response.status === 403 && /SiteVerificationNotCompleted|verification/i.test(message)) {
        console.warn(`IndexNow is still verifying ${HOST}; the scheduled/content-change run will retry automatically.`);
        break;
      }
      throw new Error(`IndexNow ${response.status}: ${message}`);
    }

    console.log(`IndexNow accepted ${batch.length} ${FULL_SUBMIT ? 'site' : 'recently changed'} URL(s).`);
  }
}

try {
  const feedResponse = await fetch(FEED_URL, {
    headers: { accept: 'application/atom+xml,application/xml;q=0.9,*/*;q=0.5' },
    signal: AbortSignal.timeout(10000)
  });

  if (feedResponse.ok) {
    const body = new URLSearchParams({
      'hub.mode': 'publish',
      'hub.url': FEED_URL
    });
    const hubResponse = await fetch('https://pubsubhubbub.appspot.com/', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(15000)
    });

    if ([200, 202, 204].includes(hubResponse.status)) {
      console.log(`Google WebSub hub accepted an update notification for ${FEED_URL}.`);
    } else {
      console.warn(`Google WebSub hub returned ${hubResponse.status}; the next scheduled run will retry.`);
    }
  } else {
    console.warn(`Atom feed is not live yet at ${FEED_URL}; skipping WebSub for this run.`);
  }
} catch (error) {
  console.warn(`WebSub notification skipped: ${error.message}`);
}

console.log(`Search discovery submission complete for ${BASE}. Full submit: ${FULL_SUBMIT ? 'yes' : 'no'}.`);
