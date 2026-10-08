import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../../functions/api/listing-corrections.js';
import { onRequestGet, onRequestPatch } from '../../functions/api/admin/listing-corrections.js';
import { createSession } from '../../functions/_lib/auth.js';
const realFetch=globalThis.fetch;
globalThis.fetch=async (url,opts) => String(url).includes('challenges.cloudflare.com/turnstile/')
  ? new Response(JSON.stringify({success:true,hostname:'tassienow.com'}),{status:200,headers:{'content-type':'application/json'}})
  : realFetch(url,opts);

function makeContext(body, count = 0) {
  const sql=[];
  const database={
    async exec(query){sql.push(query);},
    prepare(query){
      sql.push(query);
      const statement={ bind(...values){sql.push(values);return statement;}, async all(){return{results:[]};},async first(){return{count};},async run(){return{success:true};} };
      return statement;
    }
  };
  const request=new Request('https://tassienow.com/api/listing-corrections',{method:'POST',headers:{'content-type':'application/json',origin:'https://tassienow.com'},body:JSON.stringify(body)});
  return {context:{request,env:{DB:database,TURNSTILE_SECRET_KEY:'test-key'}},sql};
}
const valid={place_slug:'sample-cafe',place_name:'Sample Cafe',requester_name:'Visitor',requester_email:'visitor@example.com',relationship:'visitor',field:'opening-hours',suggested_value:'Open Tuesdays 10am to 3pm','cf-turnstile-response':'test-token'};

test('free correction is queued for moderation and never published directly',async()=>{
 const {context,sql}=makeContext(valid);
 const response=await onRequestPost(context);
 assert.equal(response.status,201);
 const body=await response.json();
 assert.equal(body.ok,true);
 assert.match(body.message,/review/i);
 assert.ok(sql.some(row=>typeof row==='string'&&row.includes('INSERT INTO listing_corrections')));
 assert.ok(!sql.some(row=>typeof row==='string'&&/UPDATE places|UPDATE events/i.test(row)));
});
test('invalid fields are rejected before insertion',async()=>{
 const {context,sql}=makeContext({...valid,field:'billing'});
 const response=await onRequestPost(context);
 assert.equal(response.status,400);
 assert.ok(!sql.some(row=>typeof row==='string'&&row.includes('INSERT INTO listing_corrections')));
});
test('per-email limits block a sixth request',async()=>{
 const {context,sql}=makeContext(valid,5);
 const response=await onRequestPost(context);
 assert.equal(response.status,429);
 assert.ok(!sql.some(row=>typeof row==='string'&&row.includes('INSERT INTO listing_corrections')));
});
test('cross-origin correction submissions are rejected',async()=>{
 const {context}=makeContext(valid);
 context.request=new Request('https://tassienow.com/api/listing-corrections',{method:'POST',headers:{origin:'https://evil.example','content-type':'application/json'},body:JSON.stringify(valid)});
 const response=await onRequestPost(context);
 assert.equal(response.status,403);
});

test('missing Turnstile secret fails closed instead of silently accepting unverified corrections',async()=>{
 const {context,sql}=makeContext(valid);
 delete context.env.TURNSTILE_SECRET_KEY;
 const response=await onRequestPost(context);
 assert.equal(response.status,503);
 assert.ok(!sql.some(row=>typeof row==='string'&&row.includes('INSERT INTO listing_corrections')));
});
test('owner correction queue is protected and review requires same-origin request',async()=>{
 const {context}=makeContext(valid);
 context.request=new Request('https://tassienow.com/api/admin/listing-corrections');
 assert.equal((await onRequestGet(context)).status,401);
 context.env.SESSION_SECRET='test-secret';
 const token=await createSession(context.env);
 context.request=new Request('https://tassienow.com/api/admin/listing-corrections',{headers:{cookie:'tn_admin='+token}});
 assert.equal((await onRequestGet(context)).status,200);
 context.request=new Request('https://tassienow.com/api/admin/listing-corrections',{method:'PATCH',headers:{cookie:'tn_admin='+token,origin:'https://evil.example','content-type':'application/json'},body:JSON.stringify({id:1,status:'approved'})});
 assert.equal((await onRequestPatch(context)).status,403);
});
