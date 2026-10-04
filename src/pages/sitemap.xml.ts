import places from '../data/places.json';

export function GET({ site }: { site: URL | undefined }) {
  const base = site ?? new URL('https://tassienow.pages.dev');
  const paths = ['/', '/about/', ...places.filter((place) => place.status === 'active').map((place) => `/place/${place.slug}/`)];
  const urls = paths.map((path) => `<url><loc>${new URL(path, base).href}</loc></url>`).join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
