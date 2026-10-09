import { db, cleanText, httpsUrl, jsonError } from '../_lib/db.js';
import { verifyTurnstile } from '../_lib/turnstile.js';

const PACKAGES = new Map([
  ['homepage-top-7', { placement: 'homepage-top', durationDays: 7, priceAud: 50 }],
  ['homepage-top-30', { placement: 'homepage-top', durationDays: 30, priceAud: 149 }],
  ['homepage-inline-7', { placement: 'homepage-inline', durationDays: 7, priceAud: 35 }],
  ['homepage-inline-30', { placement: 'homepage-inline', durationDays: 30, priceAud: 99 }],
  ['site-footer-7', { placement: 'site-footer', durationDays: 7, priceAud: 20 }],
  ['site-footer-30', { placement: 'site-footer', durationDays: 30, priceAud: 49 }]
]);

function emailOk(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim()); }
function dateOk(value) { return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')); }
function addDays(date, days) {
  if (!dateOk(date)) return null;
  const value = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(value.getTime())) return null;
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    if (body.company_url) return Response.json({ ok: true });
    // Ad enquiries must fail closed just like public listing corrections.
    // A missing runtime secret is an outage, not permission to bypass Turnstile.
    const origin=context.request.headers.get('origin');
    if(origin&&origin!==new URL(context.request.url).origin)
      return Response.json({error:'Invalid request origin'},{status:403});
    const verification = await verifyTurnstile(context, body['cf-turnstile-response'] || body.turnstileToken,{required:true});
    if (!verification.ok) return Response.json({ error: verification.error }, { status: verification.configured?400:503 });

    const name = cleanText(body.name, 120);
    const business = cleanText(body.business, 160);
    const email = cleanText(body.email, 180);
    const phone = cleanText(body.phone, 80) || null;
    const packageCode = cleanText(body.package_code, 80);
    const selected = PACKAGES.get(packageCode);
    const desiredStart = cleanText(body.desired_start, 40) || null;
    const message = cleanText(body.message, 2500);
    let website = null;

    if (body.website) website = httpsUrl(body.website, { optional: true });
    if (!name || !business || !emailOk(email) || !message) return Response.json({ error: 'Name, business, valid email and message are required' }, { status: 400 });
    if (!selected) return Response.json({ error: 'Choose a valid advertising package' }, { status: 400 });
    if (desiredStart && !dateOk(desiredStart)) return Response.json({ error: 'Choose a valid preferred start date' }, { status: 400 });

    const desiredEnd = desiredStart ? addDays(desiredStart, selected.durationDays) : null;
    const database = await db(context.env);
    await database.prepare(`INSERT INTO ad_inquiries (
      name, business, email, phone, website, placement, package_code, duration_days, price_aud, payment_method, desired_start, desired_end, message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(name, business, email, phone, website, selected.placement, packageCode, selected.durationDays, selected.priceAud, 'paypal-transfer', desiredStart, desiredEnd, message)
      .run();

    return Response.json({ ok: true, package: { code: packageCode, placement: selected.placement, durationDays: selected.durationDays, priceAud: selected.priceAud, paymentMethod: 'paypal-transfer' } }, { status: 201 });
  } catch (error) { return jsonError(error, error?.message?.includes('not configured') ? 503 : 400); }
}
