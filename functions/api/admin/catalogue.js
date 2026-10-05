import { requireAdmin, sameOrigin } from '../../_lib/auth.js';
import { readCatalogue, writeCatalogue, slugify, hobartDate } from '../../_lib/github.js';
import { cleanText, httpsUrl, jsonError } from '../../_lib/db.js';

function imageFrom(body, current) {
  if (!body.image_url) return current || { url: '/images/categories/discover.svg', alt: 'TassieNow category image', attribution: 'TassieNow', license: 'Site artwork', licenseUrl: null, sourceUrl: null, isFallback: true };
  return {
    url: httpsUrl(body.image_url),
    alt: cleanText(body.image_alt || body.name, 180),
    attribution: cleanText(body.image_attribution, 180) || 'Provided by site owner',
    license: cleanText(body.image_license, 120) || 'Owner supplied',
    licenseUrl: body.image_license_url ? httpsUrl(body.image_license_url, { optional: true }) : null,
    sourceUrl: body.image_source_url ? httpsUrl(body.image_source_url, { optional: true }) : null,
    isFallback: false,
    sourceMethod: 'manual'
  };
}

function numeric(value, name) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`${name} must be a number`);
  return n;
}

function categories(value) {
  const items = Array.isArray(value) ? value : String(value || '').split(',');
  const cleaned = [...new Set(items.map((v) => cleanText(v, 60)).filter(Boolean))];
  return cleaned.length ? cleaned : ['Things to Do'];
}

function applyChanges(place, body) {
  const original = place.sourceType;
  if (body.name !== undefined) place.name = cleanText(body.name, 160);
  if (body.town !== undefined) place.town = cleanText(body.town, 120);
  if (body.region !== undefined) place.region = cleanText(body.region, 120);
  if (body.latitude !== undefined) place.latitude = numeric(body.latitude, 'Latitude');
  if (body.longitude !== undefined) place.longitude = numeric(body.longitude, 'Longitude');
  if (body.categories !== undefined) place.categories = categories(body.categories);
  if (body.summary !== undefined) place.summary = cleanText(body.summary, 800);
  if (body.website !== undefined) place.website = body.website ? httpsUrl(body.website, { optional: true }) : null;
  if (body.visibility !== undefined) place.visibility = body.visibility === 'suppressed' ? 'suppressed' : 'public';
  if (body.featured !== undefined) place.featured = Boolean(body.featured);
  if (body.image_url) place.image = imageFrom(body, place.image);
  place.originalSourceType = place.originalSourceType || original || 'unknown';
  place.sourceType = 'manual';
  place.managedManually = true;
  place.status = place.status || 'active';
  place.lastChecked = hobartDate();
  return place;
}

export async function onRequestGet(context) {
  const auth = await requireAdmin(context); if (auth) return auth;
  try {
    const { places } = await readCatalogue(context);
    return Response.json({ places: places.map((p) => ({ slug: p.slug, name: p.name, town: p.town, region: p.region, latitude: p.latitude, longitude: p.longitude, categories: p.categories, summary: p.summary, website: p.website, visibility: p.visibility || 'public', featured: Boolean(p.featured), qualityScore: p.qualityScore || 0, sourceType: p.sourceType, image: p.image })) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return jsonError(error, 503); }
}

export async function onRequestPost(context) {
  const auth = await requireAdmin(context); if (auth) return auth;
  if (!sameOrigin(context.request)) return Response.json({ error: 'Invalid request origin' }, { status: 403 });
  try {
    const body = await context.request.json();
    const { sha, places } = await readCatalogue(context);
    if (body.action === 'update') {
      const place = places.find((p) => p.slug === body.slug);
      if (!place) return Response.json({ error: 'Listing not found' }, { status: 404 });
      applyChanges(place, body);
      await writeCatalogue(context, places, sha, `admin: update ${place.name}`);
      return Response.json({ ok: true, slug: place.slug });
    }
    if (body.action === 'add') {
      const name = cleanText(body.name, 160), town = cleanText(body.town, 120), region = cleanText(body.region, 120);
      if (!name || !town || !region) return Response.json({ error: 'Name, town and region are required' }, { status: 400 });
      const slug = slugify(name);
      if (!slug || places.some((p) => p.slug === slug)) return Response.json({ error: 'A listing with that slug already exists' }, { status: 409 });
      const latitude = numeric(body.latitude, 'Latitude'), longitude = numeric(body.longitude, 'Longitude');
      if (latitude < -44.5 || latitude > -39 || longitude < 143 || longitude > 149.5) throw new Error('Coordinates must be in Tasmania');
      const place = applyChanges({ slug, name, town, region, latitude, longitude, categories: categories(body.categories), summary: cleanText(body.summary, 800), website: null, sourceUrl: null, sourceType: 'manual', status: 'active', lastChecked: hobartDate(), image: null }, body);
      if (!place.image) place.image = imageFrom(body, null);
      places.push(place);
      places.sort((a, b) => a.region.localeCompare(b.region) || a.town.localeCompare(b.town) || a.name.localeCompare(b.name));
      await writeCatalogue(context, places, sha, `admin: add ${place.name}`);
      return Response.json({ ok: true, slug }, { status: 201 });
    }
    return Response.json({ error: 'Unsupported catalogue action' }, { status: 400 });
  } catch (error) { return jsonError(error, error?.message?.includes('GitHub') ? 503 : 400); }
}
