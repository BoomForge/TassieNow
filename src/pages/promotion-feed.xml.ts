import places from '../data/places.json';
import events from '../data/events.json';
import { addCampaignParams, getDailyPromotion } from '../lib/promotion.js';

const xml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

export async function GET({ site }: { site: URL }) {
  const base = site?.href || 'https://tassienow.com/';
  const promo = getDailyPromotion({ places, events, base });
  const feedUrl = new URL('/promotion-feed.xml', base).href;
  const homeUrl = new URL('/', base).href;
  const link = addCampaignParams(promo.url, {
    source: 'promotion_feed',
    medium: 'syndication',
    campaign: 'daily-promotion',
    content: promo.date
  });
  const updated = `${promo.date}T00:00:00Z`;

  return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>TassieNow daily promotion</title>
  <id>${xml(feedUrl)}</id>
  <link rel="self" href="${xml(feedUrl)}" />
  <link rel="alternate" href="${xml(homeUrl)}" />
  <updated>${updated}</updated>
  <subtitle>One useful TassieNow discovery, place or event selected each day for syndication.</subtitle>
  <entry>
    <title>${xml(promo.title)}</title>
    <id>urn:tassienow:promotion:${xml(promo.id)}</id>
    <link href="${xml(link)}" />
    <updated>${updated}</updated>
    <published>${updated}</published>
    <summary>${xml(promo.summary)}</summary>
    <content type="text">${xml(promo.socialText)}</content>
    <category term="${xml(promo.type)}" />
    <author><name>TassieNow</name></author>
  </entry>
</feed>`, {
    headers: {
      'Content-Type': 'application/atom+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=900'
    }
  });
}
