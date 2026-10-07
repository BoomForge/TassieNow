import { requireAdmin } from '../../_lib/auth.js';
import { readDiscovery } from '../../_lib/github.js';

export async function onRequestGet(context) {
  const auth = await requireAdmin(context); if (auth) return auth;
  try {
    return Response.json(await readDiscovery(context), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
