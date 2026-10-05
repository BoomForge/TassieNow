import { db } from '../_lib/db.js';

export async function onRequestGet(context) {
  const id = Number.parseInt(new URL(context.request.url).searchParams.get('id'), 10);
  if (!Number.isInteger(id) || id < 1 || !context.env.DB) return new Response('Advertisement not found', { status: 404 });
  try {
    const database = await db(context.env);
    const ad = await database.prepare('SELECT destination_url FROM ads WHERE id=?').bind(id).first();
    if (!ad?.destination_url) return new Response('Advertisement not found', { status: 404 });
    context.waitUntil(database.prepare('UPDATE ads SET clicks=clicks+1 WHERE id=?').bind(id).run());
    return Response.redirect(ad.destination_url, 302);
  } catch {
    return new Response('Advertisement unavailable', { status: 503 });
  }
}
