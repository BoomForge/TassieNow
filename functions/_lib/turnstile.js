export async function verifyTurnstile(context, token) {
  const secret = context.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: true, configured: false };

  const responseToken = String(token || '').trim();
  if (!responseToken) return { ok: false, configured: true, error: 'Human verification is required.' };

  const body = new FormData();
  body.append('secret', secret);
  body.append('response', responseToken);
  const remoteIp = context.request.headers.get('CF-Connecting-IP');
  if (remoteIp) body.append('remoteip', remoteIp);

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) return { ok: false, configured: true, error: 'Verification service unavailable.' };
    const result = await response.json();
    if (!result?.success) return { ok: false, configured: true, error: 'Human verification failed.' };

    const expectedHost = context.env.TURNSTILE_EXPECTED_HOSTNAME || new URL(context.request.url).hostname;
    if (result.hostname && expectedHost && result.hostname !== expectedHost) {
      return { ok: false, configured: true, error: 'Verification host mismatch.' };
    }

    return { ok: true, configured: true };
  } catch {
    return { ok: false, configured: true, error: 'Verification service unavailable.' };
  }
}
