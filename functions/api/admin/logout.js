import { clearSessionCookie, sameOrigin } from '../../_lib/auth.js';

export async function onRequestPost(context) {
  if (!sameOrigin(context.request)) return Response.json({ error: 'Invalid request origin' }, { status: 403 });
  return Response.json({ ok: true }, { headers: { 'Set-Cookie': clearSessionCookie(), 'Cache-Control': 'no-store' } });
}
