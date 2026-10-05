const SCHEMA = `
CREATE TABLE IF NOT EXISTS ads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sponsor_name TEXT NOT NULL,
  client_name TEXT,
  image_url TEXT NOT NULL,
  alt_text TEXT NOT NULL,
  destination_url TEXT NOT NULL,
  placement TEXT NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  weight INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ads_schedule ON ads (placement, status, start_at, end_at);
CREATE TABLE IF NOT EXISTS ad_inquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  business TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  website TEXT,
  placement TEXT,
  desired_start TEXT,
  desired_end TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON ad_inquiries (status, created_at);
`;

export async function db(env) {
  if (!env.DB) throw new Error('Cloudflare D1 binding DB is not configured');
  await env.DB.exec(SCHEMA);
  return env.DB;
}

export function jsonError(error, status = 500) {
  const message = error instanceof Error ? error.message : String(error);
  return Response.json({ error: message }, { status });
}

export function cleanText(value, max = 500) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function httpsUrl(value, { optional = false } = {}) {
  const v = String(value || '').trim();
  if (!v && optional) return null;
  try {
    const u = new URL(v);
    if (u.protocol !== 'https:') throw new Error('HTTPS URL required');
    return u.href;
  } catch {
    if (optional && !v) return null;
    throw new Error('A valid HTTPS URL is required');
  }
}
