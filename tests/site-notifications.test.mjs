import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  queueOwnerNotification, dispatchPendingOwnerNotifications, sendOwnerEmail,
  emailServiceConfigured, formatOwnerNotification, ensureNotificationOutbox
} from '../functions/_lib/site-notifications.js';

const owner='theevansorrell@gmail.com';
const configured={
  NOTIFY_CF_ACCOUNT_ID:'a'.repeat(32),
  NOTIFY_CF_EMAIL_TOKEN:'unit-test-token-not-real',
  NOTIFY_VERIFIED_DESTINATION:'theevansorrell@gmail.com',
  NOTIFY_FROM_EMAIL:'notifications@tassienow.com'
};

class D1 {
  constructor(){this.sqlite=new DatabaseSync(':memory:');}
  prepare(sql){
    const sqlite=this.sqlite;let params=[];
    const statement={
      bind(...args){params=args;return statement;},
      async first(){return sqlite.prepare(sql).get(...params)||null;},
      async all(){return {results:sqlite.prepare(sql).all(...params)};},
      async run(){
        const result=sqlite.prepare(sql).run(...params);
        return {meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)}};
      }
    };
    return statement;
  }
}
function fixture(){
  const db=new D1();
  db.sqlite.exec(`CREATE TABLE ad_inquiries(id INTEGER PRIMARY KEY,name TEXT,business TEXT,email TEXT,phone TEXT,package_code TEXT,desired_start TEXT,message TEXT,created_at TEXT);
    CREATE TABLE listing_corrections(id INTEGER PRIMARY KEY,place_name TEXT,place_slug TEXT,requester_name TEXT,requester_email TEXT,field TEXT,suggested_value TEXT,reason TEXT,submitted_at TEXT);
    CREATE TABLE members(id TEXT PRIMARY KEY,name TEXT);
    CREATE TABLE member_reports(kind TEXT,target_id TEXT,user_id TEXT,reason TEXT,created_at INTEGER);`);
  db.sqlite.prepare('INSERT INTO ad_inquiries VALUES(1,?,?,?,?,?,?,?,?)')
    .run('Visitor','Business','visitor@example.org','','site-footer-7','','A message about the ad','2026-11-22 10:00:00');
  return db;
}
function mockAccepted(){
  return async (url,options) => {
    assert.equal(String(url),`https://api.cloudflare.com/client/v4/accounts/${configured.NOTIFY_CF_ACCOUNT_ID}/email/sending/send`);
    assert.equal(options.headers.Authorization,`Bearer ${configured.NOTIFY_CF_EMAIL_TOKEN}`);
    const payload=JSON.parse(options.body);
    assert.equal(payload.to,owner);
    assert.equal(payload.from,'notifications@tassienow.com');
    assert.equal(payload.html,undefined);
    assert.match(payload.text,/Review and respond from: https:\/\/tassienow.com\/admin\//);
    return {ok:true,status:200,json:async()=>({success:true,result:{queued:[owner],delivered:[],permanent_bounces:[],message_id:'provider-id'}})};
  };
}

test('only fixed owner recipient and fixed subject are used, not visitor content',async()=>{
  assert.equal(emailServiceConfigured(configured),true);
  assert.equal(emailServiceConfigured({...configured,NOTIFY_FROM_EMAIL:'spoof@example.org'}),false);
  assert.equal(emailServiceConfigured({...configured,NOTIFY_VERIFIED_DESTINATION:''}),false);
  assert.equal(emailServiceConfigured({...configured,NOTIFY_VERIFIED_DESTINATION:'other@example.com'}),false);
  const crafted=formatOwnerNotification('advertising',{id:7,name:'Visitor\r\nBcc: attacker@example.org',message:'<script>alert(1)</script>'});
  assert.equal(crafted.subject,'[TassieNow] Advertising enquiry #7');
  assert.ok(!crafted.subject.includes('attacker'));
  assert.ok(crafted.text.includes('<script>')); // Plain text only, not executable HTML.
  const sender={...configured,NOTIFY_CF_EMAIL_TOKEN:''};
  await assert.rejects(()=>sendOwnerEmail(sender,'advertising',{id:7}),/not configured/);
});

test('successful send accepts only Cloudflare-confirmed fixed destination',async()=>{
  const messageId=await sendOwnerEmail(configured,'advertising',{
    id:1,name:'Visitor',business:'Business',email:'visitor@example.org',created_at:'2026-11-22',message:'Hi'
  },mockAccepted());
  assert.equal(messageId,'provider-id');
  await assert.rejects(()=>sendOwnerEmail(configured,'advertising',{id:1},async()=>({
    ok:true,status:200,json:async()=>({success:true,result:{queued:['other@example.org'],delivered:[]}})
  })),/rejected/);
});

test('D1 outbox deduplicates, saves on unconfigured provider and delivers after setup',async()=>{
  const db=fixture();
  await queueOwnerNotification(db,'advertising','1');
  await queueOwnerNotification(db,'advertising','1');
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM site_notification_outbox').get().n,1);
  assert.deepEqual(await dispatchPendingOwnerNotifications(db,{}),{configured:false,attempted:0,sent:0});
  assert.equal(db.sqlite.prepare('SELECT status FROM site_notification_outbox').get().status,'pending');
  const original=globalThis.fetch;
  globalThis.fetch=mockAccepted();
  try{
    const done=await dispatchPendingOwnerNotifications(db,configured);
    assert.deepEqual(done,{configured:true,attempted:1,sent:1});
  }finally{globalThis.fetch=original}
  const state=db.sqlite.prepare('SELECT status,attempts,provider_message_id FROM site_notification_outbox').get();
  assert.equal(state.status,'sent');
  assert.equal(state.attempts,1);
  assert.equal(state.provider_message_id,'provider-id');
  assert.deepEqual(await dispatchPendingOwnerNotifications(db,configured),{configured:true,attempted:0,sent:0});
});

test('email service error leaves the submission queued with bounded retry, not sent',async()=>{
  const db=fixture();
  await queueOwnerNotification(db,'advertising','1');
  const original=globalThis.fetch;
  globalThis.fetch=async()=>({ok:false,status:403,json:async()=>({success:false,errors:[{message:'error'}]})});
  try{
    const result=await dispatchPendingOwnerNotifications(db,configured);
    assert.deepEqual(result,{configured:true,attempted:1,sent:0});
  }finally{globalThis.fetch=original}
  const state=db.sqlite.prepare('SELECT status,attempts,retry_after,last_error FROM site_notification_outbox').get();
  assert.equal(state.status,'pending');
  assert.equal(state.attempts,1);
  assert.ok(state.retry_after);
  assert.match(state.last_error,/HTTP 403/);
});
