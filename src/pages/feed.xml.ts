import places from '../data/places.json';
import events from '../data/events.json';

const xml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const dateOnly = (value: string | undefined) => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value! : '2026-01-01';
const atomDate = (value: string | undefined) => `${dateOnly(value)}T00:00:00Z`;
const latestDate = (values: (string | undefined)[]) => values.filter((value): value is string => /^\d{4}-\d{2}-\d{2}$/.test(value || '')).sort().at(-1) || new Date().toISOString().slice(0, 10);
const placeDate = (place: any) => latestDate([place.lastDetailsChecked, place.lastWikidataChecked, place.lastChecked]);
const eventDate = (event: any) => latestDate([event.lastChecked, event.updatedAt, event.startDate]);

export async function GET({ site }: { site: URL }) {
  const base = site?.href || 'https://tassienow.com/';
  const feedUrl = new URL('/feed.xml', base).href;
  const homeUrl = new URL('/', base).href;

  const placeItems = places
    .filter((place: any) => place.status === 'active' && place.visibility !== 'suppressed')
    .map((place: any) => ({
      type: 'place',
      title: place.name,
      summary: place.summary,
      path: `/place/${place.slug}/`,
      updated: placeDate(place)
    }));

  const eventItems = events
    .filter((event: any) => event.status === 'active')
    .map((event: any) => ({
      type: 'event',
      title: event.name || event.title,
      summary: event.summary || event.description || `Tasmanian event in ${event.town || event.region || 'Tasmania'}.`,
      path: `/event/${event.slug}/`,
      updated: eventDate(event)
    }));

  const items = [...placeItems, ...eventItems]
    .sort((a, b) => b.updated.localeCompare(a.updated) || a.title.localeCompare(b.title))
    .slice(0, 150);

  const updated = atomDate(latestDate(items.map((item) => item.updated)));
  const entries = items.map((item) => {
    const url = new URL(item.path, base).href;
    return `  <entry>
    <title>${xml(item.title)}</title>
    <id>${xml(url)}</id>
    <link href="${xml(url)}" />
    <updated>${atomDate(item.updated)}</updated>
    <summary>${xml(item.summary)}</summary>
    <category term="${item.type}" />
  </entry>`;
  }).join('\n');

  return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>TassieNow updates</title>
  <id>${xml(homeUrl)}</id>
  <link rel="self" href="${xml(feedUrl)}" />
  <link rel="alternate" href="${xml(homeUrl)}" />
  <link rel="hub" href="https://pubsubhubbub.appspot.com/" />
  <updated>${updated}</updated>
  <subtitle>Recently updated Tasmanian places, activities and events from TassieNow.</subtitle>
${entries}
</feed>`, {
    headers: {
      'Content-Type': 'application/atom+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=900'
    }
  });
}
