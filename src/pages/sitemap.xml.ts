import places from '../data/places.json';
import events from '../data/events.json';
import { collections, slugify } from '../lib/catalogue.js';
export function GET({ site }: { site: URL | undefined }) {
  const base = site ?? new URL('https://tassienow.pages.dev'); const activePlaces = places.filter((p) => p.status === 'active'); const activeEvents = events.filter((e) => e.status === 'active');
  const regions = [...new Set(activePlaces.map((p) => p.region))]; const towns = [...new Set(activePlaces.map((p) => p.town))];
  const paths = ['/', '/about/', ...Object.keys(collections).map((slug) => `/${slug}/`), ...regions.map((r) => `/region/${slugify(r)}/`), ...towns.map((t) => `/town/${slugify(t)}/`), ...activePlaces.map((p) => `/place/${p.slug}/`), ...activeEvents.map((e) => `/event/${e.slug}/`)];
  const urls = paths.map((path) => `<url><loc>${new URL(path, base).href}</loc></url>`).join(''); const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
