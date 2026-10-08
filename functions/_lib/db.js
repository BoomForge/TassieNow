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
  package_code TEXT,
  duration_days INTEGER,
  price_aud INTEGER,
  payment_method TEXT NOT NULL DEFAULT 'paypal-transfer',
  desired_start TEXT,
  desired_end TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON ad_inquiries (status, created_at);
CREATE TABLE IF NOT EXISTS listing_corrections (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 place_slug TEXT NOT NULL,
 place_name TEXT NOT NULL,
 requester_name TEXT NOT NULL,
 requester_email TEXT NOT NULL,
 relationship TEXT NOT NULL DEFAULT 'visitor',
 field TEXT NOT NULL,
 suggested_value TEXT NOT NULL,
 reason TEXT,
 source_url TEXT,
 status TEXT NOT NULL DEFAULT 'pending',
 submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 reviewed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_listing_corrections_queue ON listing_corrections (status, submitted_at);
CREATE INDEX IF NOT EXISTS idx_listing_corrections_slug ON listing_corrections (place_slug, submitted_at);
CREATE TABLE IF NOT EXISTS discovery_metrics (
 day TEXT NOT NULL,
 event_type TEXT NOT NULL,
 page_path TEXT NOT NULL,
 detail TEXT NOT NULL DEFAULT '',
 hits INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(day,event_type,page_path,detail)
);
CREATE INDEX IF NOT EXISTS idx_discovery_metrics_day ON discovery_metrics (day,event_type);


`;

const INQUIRY_COLUMNS = [
  ['package_code', 'TEXT'],
  ['duration_days', 'INTEGER'],
  ['price_aud', 'INTEGER'],
  ['payment_method', "TEXT NOT NULL DEFAULT 'paypal-transfer'"]
];

async function migrateInquiryColumns(database) {
  const { results = [] } = await database.prepare('PRAGMA table_info(ad_inquiries)').all();
  const existing = new Set(results.map((column) => column.name));
  for (const [name, definition] of INQUIRY_COLUMNS) {
    if (!existing.has(name)) await database.prepare(`ALTER TABLE ad_inquiries ADD COLUMN ${name} ${definition}`).run();
  }
}

export async function db(env) {
  if (!env.DB) throw new Error('Cloudflare D1 binding DB is not configured');
  await env.DB.exec(SCHEMA);
  await migrateInquiryColumns(env.DB);
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
