import fs from 'node:fs/promises';
import { addCampaignParams, getDailyPromotion } from '../src/lib/promotion.js';

const places = JSON.parse(await fs.readFile(new URL('../src/data/places.json', import.meta.url), 'utf8'));
const events = JSON.parse(await fs.readFile(new URL('../src/data/events.json', import.meta.url), 'utf8'));

const handle = process.env.BLUESKY_HANDLE || '';
const appPassword = process.env.BLUESKY_APP_PASSWORD || '';
const service = (process.env.BLUESKY_SERVICE || 'https://bsky.social').replace(/\/$/, '');
const base = (process.env.SITE_URL || 'https://tassienow.com').replace(/\/$/, '');
const dryRun = process.env.DRY_RUN === '1';

const promo = getDailyPromotion({ places, events, base });
const targetUrl = addCampaignParams(promo.url, {
  source: 'bluesky',
  medium: 'social',
  campaign: 'daily-promotion',
  content: promo.date
});

const postText = promo.socialText.length <= 300
  ? promo.socialText
  : `${promo.socialText.slice(0, 299).trimEnd()}…`;

if (dryRun) {
  console.log(JSON.stringify({ ...promo, targetUrl, postText }, null, 2));
  process.exit(0);
}

if (!handle || !appPassword) {
  console.log('Bluesky promotion skipped: BLUESKY_HANDLE or BLUESKY_APP_PASSWORD is not configured.');
  process.exit(0);
}

async function jsonFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(options.timeout || 20000)
  });

  const text = await response.text();
  let body = {};
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text.slice(0, 1000) };
    }
  }

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${JSON.stringify(body).slice(0, 1200)}`);
  }

  return body;
}

const session = await jsonFetch(`${service}/xrpc/com.atproto.server.createSession`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ identifier: handle, password: appPassword })
});

const authHeaders = {
  authorization: `Bearer ${session.accessJwt}`
};

const recent = await jsonFetch(
  `${service}/xrpc/com.atproto.repo.listRecords?repo=${encodeURIComponent(session.did)}&collection=app.bsky.feed.post&limit=100`,
  { headers: authHeaders }
);

const alreadyPosted = (recent.records || []).some((entry) => {
  const value = entry?.value || {};
  if (value?.embed?.external?.uri === targetUrl) return true;
  return typeof value.text === 'string' && value.text.includes(targetUrl);
});

if (alreadyPosted) {
  console.log(`Bluesky promotion already exists for ${promo.date}; skipping duplicate.`);
  process.exit(0);
}

async function uploadThumb() {
  const imageUrl = promo.imageUrl;
  if (!imageUrl) return null;

  try {
    const imageResponse = await fetch(imageUrl, {
      signal: AbortSignal.timeout(15000)
    });
    if (!imageResponse.ok) return null;

    const contentType = (imageResponse.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) return null;

    const buffer = Buffer.from(await imageResponse.arrayBuffer());
    if (!buffer.length || buffer.length > 900000) return null;

    const uploadResponse = await fetch(`${service}/xrpc/com.atproto.repo.uploadBlob`, {
      method: 'POST',
      headers: {
        ...authHeaders,
        'content-type': contentType
      },
      body: buffer,
      signal: AbortSignal.timeout(20000)
    });

    if (!uploadResponse.ok) return null;
    const uploaded = await uploadResponse.json();
    return uploaded.blob || null;
  } catch {
    return null;
  }
}

const thumb = await uploadThumb();
const external = {
  uri: targetUrl,
  title: promo.title,
  description: promo.summary
};
if (thumb) external.thumb = thumb;

const record = {
  $type: 'app.bsky.feed.post',
  text: postText,
  createdAt: new Date().toISOString(),
  langs: ['en'],
  embed: {
    $type: 'app.bsky.embed.external',
    external
  }
};

const created = await jsonFetch(`${service}/xrpc/com.atproto.repo.createRecord`, {
  method: 'POST',
  headers: {
    ...authHeaders,
    'content-type': 'application/json'
  },
  body: JSON.stringify({
    repo: session.did,
    collection: 'app.bsky.feed.post',
    record
  })
});

console.log(`Bluesky promotion posted: ${created.uri || promo.title}`);
