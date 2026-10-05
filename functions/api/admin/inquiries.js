import { requireAdmin, sameOrigin } from '../../_lib/auth.js';
import { db, cleanText, jsonError } from '../../_lib/db.js';

const STATUSES = new Set(['new', 'contacted', 'closed']);

function packageLabel(row) {
  if (!row.package_code || !row.price_aud || !row.duration_days) return null;
  const placement = row.placement === 'homepage-top' ? 'Homepage top' : row.placement === 'homepage-inline' ? 'Homepage inline' : row.placement === 'site-footer' ? 'Site footer' : row.placement;
  return `${placement} · ${row.duration_days} days · $${row.price_aud} AUD · PayPal transfer`;
}

export async function onRequestGet(context) {
  const auth = await requireAdmin(context); if (auth) return auth;
  try {
    const database = await db(context.env);
    const { results = [] } = await database.prepare('SELECT * FROM ad_inquiries ORDER BY created_at DESC, id DESC').all();
    const inquiries = results.map((row) => {
      const summary = packageLabel(row);
      return summary ? { ...row, message: `${summary}\n\n${row.message}` } : row;
    });
    return Response.json({ inquiries }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return jsonError(error, 503); }
}

export async function onRequestPatch(context) {
  const auth = await requireAdmin(context); if (auth) return auth;
  if (!sameOrigin(context.request)) return Response.json({ error: 'Invalid request origin' }, { status: 403 });
  try {
    const body = await context.request.json();
    const id = Number.parseInt(body.id, 10);
    const status = cleanText(body.status, 20);
    if (!Number.isInteger(id) || id < 1 || !STATUSES.has(status)) return Response.json({ error: 'Invalid inquiry update' }, { status: 400 });
    const database = await db(context.env);
    await database.prepare('UPDATE ad_inquiries SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(status, id).run();
    return Response.json({ ok: true });
  } catch (error) { return jsonError(error, 400); }
}
