import { isAdmin } from '../../_lib/auth.js';

export async function onRequestGet(context) {
  return Response.json({ authenticated: await isAdmin(context.request, context.env) }, { headers: { 'Cache-Control': 'no-store' } });
}
