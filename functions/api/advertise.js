import { db, cleanText, httpsUrl, jsonError } from '../_lib/db.js';

function emailOk(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim()); }

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    if (body.company_url) return Response.json({ ok: true });
    const name = cleanText(body.name, 120), business = cleanText(body.business, 160), email = cleanText(body.email, 180), phone = cleanText(body.phone, 80) || null;
    const placement = cleanText(body.placement, 80) || null, desiredStart = cleanText(body.desired_start, 40) || null, desiredEnd = cleanText(body.desired_end, 40) || null, message = cleanText(body.message, 2500);
    let website = null;
    if (body.website) website = httpsUrl(body.website, { optional: true });
    if (!name || !business || !emailOk(email) || !message) return Response.json({ error: 'Name, business, valid email and message are required' }, { status: 400 });
    const database = await db(context.env);
    await database.prepare(`INSERT INTO ad_inquiries (name, business, email, phone, website, placement, desired_start, desired_end, message) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(name, business, email, phone, website, placement, desiredStart, desiredEnd, message).run();
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) { return jsonError(error, error?.message?.includes('not configured') ? 503 : 400); }
}
