import { requireAdmin, sameOrigin } from '../../../_lib/auth.js';
import { db, cleanText, httpsUrl, jsonError } from '../../../_lib/db.js';

const PLACEMENTS = new Set(['homepage-top', 'homepage-inline', 'site-footer']);
const STATUSES = new Set(['draft', 'scheduled', 'paused']);

function normalize(body) {
  const placement = cleanText(body.placement, 40);
  const status = cleanText(body.status, 20) || 'draft';
  if (!PLACEMENTS.has(placement)) throw new Error('Invalid ad placement');
  if (!STATUSES.has(status)) throw new Error('Invalid ad status');
  const startAt = new Date(body.start_at);
  if (Number.isNaN(startAt.valueOf())) throw new Error('A valid start date/time is required');
  const endAt = body.end_at ? new Date(body.end_at) : null;
  if (endAt && Number.isNaN(endAt.valueOf())) throw new Error('Invalid end date/time');
  if (endAt && endAt <= startAt) throw new Error('End date/time must be after start');
  return {
    sponsor_name: cleanText(body.sponsor_name, 120),
    client_name: cleanText(body.client_name, 120) || null,
    image_url: httpsUrl(body.image_url),
    alt_text: cleanText(body.alt_text, 180),
    destination_url: httpsUrl(body.destination_url),
    placement,
    start_at: startAt.toISOString(),
    end_at: endAt ? endAt.toISOString() : null,
    status,
    weight: Math.max(1, Math.min(100, Number.parseInt(body.weight, 10) || 1)),
    notes: cleanText(body.notes, 1000) || null
  };
}

export async function onRequestGet(context) {
  const auth = await requireAdmin(context); if (auth) return auth;
  try {
    const database = await db(context.env);
    const { results = [] } = await database.prepare('SELECT * FROM ads ORDER BY created_at DESC, id DESC').all();
    return Response.json({ ads: results }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return jsonError(error, 503); }
}

export async function onRequestPost(context) {
  const auth = await requireAdmin(context); if (auth) return auth;
  if (!sameOrigin(context.request)) return Response.json({ error: 'Invalid request origin' }, { status: 403 });
  try {
    const body = normalize(await context.request.json());
    if (!body.sponsor_name || !body.alt_text) return Response.json({ error: 'Sponsor name and image alt text are required' }, { status: 400 });
    const database = await db(context.env);
    const result = await database.prepare(`INSERT INTO ads (sponsor_name, client_name, image_url, alt_text, destination_url, placement, start_at, end_at, status, weight, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(body.sponsor_name, body.client_name, body.image_url, body.alt_text, body.destination_url, body.placement, body.start_at, body.end_at, body.status, body.weight, body.notes).run();
    return Response.json({ ok: true, id: result.meta.last_row_id }, { status: 201 });
  } catch (error) { return jsonError(error, 400); }
}
