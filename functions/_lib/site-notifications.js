// Durable, owner-only submission notifications. Public requests never choose a recipient.
// Email sends use Cloudflare Email Service REST from Pages Functions (no mail binding needed).
const DESTINATION = 'theevansorrell@gmail.com';
const OUTBOX = `CREATE TABLE IF NOT EXISTS site_notification_outbox (
  kind TEXT NOT NULL,
  source_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  locked_at TEXT,
  retry_after TEXT,
  last_error TEXT,
  provider_message_id TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(kind,source_key)
)`;

export async function ensureNotificationOutbox(database) {
  await database.prepare(OUTBOX).run();
}

export async function queueOwnerNotification(database, kind, sourceKey) {
  if (!['advertising','correction','report'].includes(kind)) throw new Error('Unsupported notification kind');
  const key = String(sourceKey || '');
  if (!key || key.length > 250) throw new Error('Invalid notification source');
  await ensureNotificationOutbox(database);
  await database.prepare(
    'INSERT OR IGNORE INTO site_notification_outbox(kind,source_key) VALUES(?,?)'
  ).bind(kind,key).run();
}

function safe(value, max=1500) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0,max);
}

export function formatOwnerNotification(kind, record) {
  const id = safe(record.id ?? record.target_id ?? '',100);
  if (kind === 'advertising') {
    return {
      subject: `[TassieNow] Advertising enquiry #${id}`,
      text: [
        'New advertising enquiry on TassieNow',
        `Reference: advertising #${id}`,
        `Received: ${safe(record.created_at,80)} UTC`,
        `Name: ${safe(record.name,120)}`,
        `Business: ${safe(record.business,160)}`,
        `Contact email: ${safe(record.email,180)}`,
        `Phone: ${safe(record.phone,80) || 'Not provided'}`,
        `Package: ${safe(record.package_code,80)}`,
        `Desired start: ${safe(record.desired_start,40) || 'Not provided'}`,
        `Message: ${safe(record.message,2000)}`,
        'Review and respond from: https://tassienow.com/admin/',
        'This is an automated notification. No payment has been taken.'
      ].join('\n')
    };
  }
  if (kind === 'correction') {
    return {
      subject: `[TassieNow] Listing correction #${id}`,
      text: [
        'New listing correction awaiting owner review',
        `Reference: correction #${id}`,
        `Received: ${safe(record.submitted_at,80)} UTC`,
        `Place: ${safe(record.place_name,180)}`,
        `Listing: ${safe(record.place_slug,100)}`,
        `Submitted by: ${safe(record.requester_name,100)}`,
        `Contact email: ${safe(record.requester_email,180)}`,
        `Field: ${safe(record.field,40)}`,
        `Suggested value: ${safe(record.suggested_value,1200)}`,
        `Reason: ${safe(record.reason,700) || 'Not provided'}`,
        'Review from: https://tassienow.com/admin/',
        'No listing information was changed automatically.'
      ].join('\n')
    };
  }
  if (kind === 'report') {
    return {
      subject: '[TassieNow] New community report',
      text: [
        'A member reported a community contribution for owner review',
        `Content type: ${safe(record.kind,40)}`,
        `Target: ${safe(record.target_id,100)}`,
        `Reported by: ${safe(record.name,100)}`,
        `Received: ${new Date(Number(record.created_at)).toISOString()}`,
        `Reason: ${safe(record.reason,700)}`,
        'Review from: https://tassienow.com/community-admin/',
        'No moderation action was taken automatically.'
      ].join('\n')
    };
  }
  throw new Error('Unsupported notification kind');
}

async function loadSource(database, kind, sourceKey) {
  if (kind === 'advertising') {
    return database.prepare('SELECT * FROM ad_inquiries WHERE id=?').bind(Number(sourceKey)).first();
  }
  if (kind === 'correction') {
    return database.prepare('SELECT * FROM listing_corrections WHERE id=?').bind(Number(sourceKey)).first();
  }
  if (kind === 'report') {
    const [reportKind, targetId, userId] = JSON.parse(sourceKey);
    return database.prepare(
      'SELECT r.*, m.name FROM member_reports r JOIN members m ON m.id=r.user_id WHERE r.kind=? AND r.target_id=? AND r.user_id=?'
    ).bind(reportKind,targetId,userId).first();
  }
  return null;
}

export function emailServiceConfigured(env) {
  return Boolean(
    /^[a-f0-9]{32}$/i.test(String(env.NOTIFY_CF_ACCOUNT_ID || '')) &&
    String(env.NOTIFY_CF_EMAIL_TOKEN || '').length >= 12 &&
    // Never send until the fixed Gmail destination is verified in Cloudflare Email Routing.
    // Verified-destination sends are $0 on Cloudflare Free and Paid plans.
    String(env.NOTIFY_VERIFIED_DESTINATION || '').toLowerCase() === DESTINATION &&
    /^[^\s@]+@(?:[a-z0-9-]+\.)?tassienow\.com$/i.test(String(env.NOTIFY_FROM_EMAIL || ''))
  );
}

export async function sendOwnerEmail(env, kind, record, fetchImpl=fetch) {
  if (!emailServiceConfigured(env)) throw new Error('Email service not configured');
  const {subject,text} = formatOwnerNotification(kind,record);
  const response = await fetchImpl(
    `https://api.cloudflare.com/client/v4/accounts/${env.NOTIFY_CF_ACCOUNT_ID}/email/sending/send`, {
      method: 'POST',
      headers: {'Authorization': `Bearer ${env.NOTIFY_CF_EMAIL_TOKEN}`, 'Content-Type':'application/json'},
      body: JSON.stringify({from:env.NOTIFY_FROM_EMAIL,to:DESTINATION,subject,text}),
      signal: AbortSignal.timeout(8500)
    }
  );
  const data = await response.json().catch(()=>null);
  const delivered = [...(data?.result?.delivered || []),...(data?.result?.queued || [])]
    .some(address => String(address).toLowerCase() === DESTINATION);
  if (!response.ok || data?.success !== true || !delivered || (data?.result?.permanent_bounces || []).length) {
    throw new Error(`Email service rejected notification (HTTP ${response.status})`);
  }
  return String(data.result?.message_id || 'accepted');
}

export async function dispatchPendingOwnerNotifications(database, env, limit=4) {
  await ensureNotificationOutbox(database);
  if (!emailServiceConfigured(env)) return {configured:false,attempted:0,sent:0};
  const max = Math.max(1,Math.min(8,Math.floor(Number(limit)||4)));
  const candidates = await database.prepare(`
    SELECT kind,source_key FROM site_notification_outbox
    WHERE attempts < 5
      AND (status='pending' OR (status='sending' AND locked_at < datetime('now','-15 minutes')))
      AND (retry_after IS NULL OR retry_after <= CURRENT_TIMESTAMP)
    ORDER BY created_at ASC LIMIT ?
  `).bind(max).all();
  let attempted=0,sent=0;
  for (const row of candidates.results || []) {
    const claim = await database.prepare(`
      UPDATE site_notification_outbox SET status='sending',locked_at=CURRENT_TIMESTAMP,attempts=attempts+1
      WHERE kind=? AND source_key=? AND attempts<5
        AND (status='pending' OR (status='sending' AND locked_at < datetime('now','-15 minutes')))
        AND (retry_after IS NULL OR retry_after <= CURRENT_TIMESTAMP)
    `).bind(row.kind,row.source_key).run();
    if (Number(claim.meta?.changes || 0) !== 1) continue;
    attempted++;
    try {
      const record=await loadSource(database,row.kind,row.source_key);
      if (!record) throw new Error('Original submission no longer exists');
      const messageId=await sendOwnerEmail(env,row.kind,record);
      await database.prepare(`
        UPDATE site_notification_outbox
        SET status='sent',sent_at=CURRENT_TIMESTAMP,provider_message_id=?,last_error=NULL,locked_at=NULL,retry_after=NULL
        WHERE kind=? AND source_key=? AND status='sending'
      `).bind(messageId,row.kind,row.source_key).run();
      sent++;
    } catch (error) {
      const reason = safe(error?.message || 'Delivery failed',140);
      await database.prepare(`
        UPDATE site_notification_outbox SET status='pending',last_error=?,locked_at=NULL,
        retry_after=datetime('now','+15 minutes') WHERE kind=? AND source_key=? AND status='sending'
      `).bind(reason,row.kind,row.source_key).run();
    }
  }
  return {configured:true,attempted,sent};
}

export async function queueAndTryNotify(database, env, kind, sourceKey) {
  await queueOwnerNotification(database,kind,sourceKey);
  return dispatchPendingOwnerNotifications(database,env);
}
