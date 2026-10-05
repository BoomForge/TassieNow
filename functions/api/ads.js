import { db } from '../_lib/db.js';

const ALLOWED = new Set(['homepage-top', 'homepage-inline', 'site-footer']);

export async function onRequestGet(context) {
  const placement = new URL(context.request.url).searchParams.get('placement') || '';
  if (!ALLOWED.has(placement) || !context.env.DB) return Response.json({ ad: null }, { headers: { 'Cache-Control': 'no-store' } });
  try {
    const database = await db(context.env);
    const now = new Date().toISOString();
    const { results = [] } = await database.prepare(`SELECT id, sponsor_name, image_url, alt_text, placement, weight FROM ads WHERE status='scheduled' AND placement=? AND start_at<=? AND (end_at IS NULL OR end_at='' OR end_at>?) ORDER BY weight DESC, id DESC LIMIT 20`).bind(placement, now, now).all();
    if (!results.length) return Response.json({ ad: null }, { headers: { 'Cache-Control': 'no-store' } });
    const total = results.reduce((sum, ad) => sum + Math.max(1, Number(ad.weight) || 1), 0);
    let pick = Math.random() * total, ad = results[0];
    for (const candidate of results) { pick -= Math.max(1, Number(candidate.weight) || 1); if (pick <= 0) { ad = candidate; break; } }
    context.waitUntil(database.prepare('UPDATE ads SET impressions=impressions+1 WHERE id=?').bind(ad.id).run());
    return Response.json({ ad: { id: ad.id, sponsor_name: ad.sponsor_name, image_url: ad.image_url, alt_text: ad.alt_text, click_url: `/api/ad-click?id=${ad.id}` } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ ad: null }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
