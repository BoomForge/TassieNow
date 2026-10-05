const COOKIE = 'tn_admin';
const enc = new TextEncoder();

function cookieValue(request, name) {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

function base64url(bytes) {
  let binary = '';
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return base64url(await crypto.subtle.sign('HMAC', key, enc.encode(value)));
}

function safeEqual(a = '', b = '') {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSession(env) {
  if (!env.SESSION_SECRET) throw new Error('SESSION_SECRET is not configured');
  const expires = Date.now() + 12 * 60 * 60 * 1000;
  const payload = `owner.${expires}`;
  return `${payload}.${await hmac(env.SESSION_SECRET, payload)}`;
}

export async function isAdmin(request, env) {
  if (!env.SESSION_SECRET) return false;
  const token = cookieValue(request, COOKIE);
  if (!token) return false;
  const match = token.match(/^owner\.(\d+)\.([A-Za-z0-9_-]+)$/);
  if (!match || Number(match[1]) < Date.now()) return false;
  const payload = `owner.${match[1]}`;
  return safeEqual(match[2], await hmac(env.SESSION_SECRET, payload));
}

export async function requireAdmin(context) {
  if (!(await isAdmin(context.request, context.env))) return Response.json({ error: 'Authentication required' }, { status: 401 });
  return null;
}

export function sessionCookie(token) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`;
}

export function clearSessionCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export function validOwnerCredentials(env, username, password) {
  const expectedUser = env.ADMIN_USERNAME || 'admin';
  return safeEqual(String(username || ''), expectedUser) && safeEqual(String(password || ''), String(env.ADMIN_PASSWORD || '')) && Boolean(env.ADMIN_PASSWORD);
}

export function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}
