import { requireAdmin, sameOrigin } from '../../_lib/auth.js';
import { db } from '../../_lib/db.js';
import { ensureNotificationOutbox, dispatchPendingOwnerNotifications, emailServiceConfigured } from '../../_lib/site-notifications.js';

const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};

async function status(database,env) {
  await ensureNotificationOutbox(database);
  const {results=[]}=await database.prepare(
    "SELECT status,COUNT(*) AS total FROM site_notification_outbox GROUP BY status"
  ).all();
  const counts={pending:0,sending:0,sent:0,failed:0};
  for(const row of results) if(Object.hasOwn(counts,row.status)) counts[row.status]=Number(row.total)||0;
  const {results:pending=[]}=await database.prepare(
    "SELECT kind,source_key,attempts,last_error,created_at FROM site_notification_outbox WHERE status!='sent' ORDER BY created_at DESC LIMIT 30"
  ).all();
  return {configured:emailServiceConfigured(env),counts,pending};
}

export async function onRequestGet(context) {
  const auth=await requireAdmin(context);if(auth)return auth;
  try{
    const database=await db(context.env);
    return Response.json(await status(database,context.env),{headers});
  }catch{
    return Response.json({error:'Notification status is temporarily unavailable.'},{status:503,headers});
  }
}

export async function onRequestPost(context) {
  const auth=await requireAdmin(context);if(auth)return auth;
  if(!sameOrigin(context.request))return Response.json({error:'Invalid request origin'},{status:403,headers});
  try {
    const database=await db(context.env);
    const dispatch=await dispatchPendingOwnerNotifications(database,context.env,8);
    const current=await status(database,context.env);
    return Response.json({dispatch,...current},{status:dispatch.configured?200:503,headers});
  }catch{
    return Response.json({error:'Could not retry notifications. Existing messages remain saved.'},{status:503,headers});
  }
}
