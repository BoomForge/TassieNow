import { createSession, sessionCookie, validOwnerCredentials, sameOrigin } from '../../_lib/auth.js';
import { verifyTurnstile } from '../../_lib/turnstile.js';

export async function onRequestPost(context) {
  if (!sameOrigin(context.request)) return Response.json({ error: 'Invalid request origin' }, { status: 403 });
  let body;
  try { body = await context.request.json(); } catch { return Response.json({ error: 'Invalid request' }, { status: 400 }); }
  const verification = await verifyTurnstile(context, body['cf-turnstile-response'] || body.turnstileToken);
  if (!verification.ok) return Response.json({ error: verification.error }, { status: 400 });
  if (!validOwnerCredentials(context.env, body.username, body.password)) {
    await new Promise((resolve) => setTimeout(resolve, 350));
    return Response.json({ error: 'Invalid username or password' }, { status: 401 });
  }
  try {
    const token = await createSession(context.env);
    return Response.json({ ok: true }, { headers: { 'Set-Cookie': sessionCookie(token), 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 503 });
  }
}
