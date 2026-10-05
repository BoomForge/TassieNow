import { requireAdmin, sameOrigin } from '../../_lib/auth.js';
import { db, cleanText, jsonError } from '../../_lib/db.js';

const STATUSES = new Set(['new', 'contacted', 'closed']);

export async function onRequestGet(context) {
  const auth = await requireAdmin(context); if (auth) return auth;
  try {
    const database = await db(context.env);
    const { results = [] } = await database.prepare('SELECT * FROM ad_inquiries ORDER BY created_at DESC, id DESC').all();
    return Response.json({ inquiries: results }, { headers: { 'Cache-Control': 'no-store' } });
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
