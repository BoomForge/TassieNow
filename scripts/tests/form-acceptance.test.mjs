import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestPost as correct} from '../../functions/api/listing-corrections.js';
import {onRequestPost as advertise} from '../../functions/api/advertise.js';
import {onRequestGet as viewCorrections} from '../../functions/api/admin/listing-corrections.js';
import {onRequestGet as viewInquiries} from '../../functions/api/admin/inquiries.js';
import {createSession} from '../../functions/_lib/auth.js';

const oldFetch=globalThis.fetch;
globalThis.fetch=async (url,options)=>String(url).includes('challenges.cloudflare.com/turnstile/')
  ? new Response(JSON.stringify({success:options?.body?.get('response')==='valid-test-response',hostname:'tassienow.com'}),{status:200,headers:{'content-type':'application/json'}})
  : oldFetch(url,options);
const data={corrections:[],inquiries:[]};
const db={
  async exec(){},
  prepare(sql){
    let binds=[];
    const statement={
      bind(...values){binds=values;return statement;},
      async run(){
        if(sql.includes('INSERT INTO listing_corrections')){
          data.corrections.push({id:data.corrections.length+1,place_slug:binds[0],place_name:binds[1],requester_name:binds[2],requester_email:binds[3],status:'pending'});
        }else if(sql.includes('INSERT INTO ad_inquiries')){
          data.inquiries.push({id:data.inquiries.length+1,name:binds[0],business:binds[1],email:binds[2],placement:binds[5],package_code:binds[6],duration_days:binds[7],price_aud:binds[8],message:binds[12],status:'new'});
        }
        return{success:true};
      },
      async first(){return{count:0};},
      async all(){
        if(sql.startsWith('PRAGMA table_info('))return{results:[]};
        if(sql.includes('FROM listing_corrections'))return{results:data.corrections};
        if(sql.includes('FROM ad_inquiries'))return{results:data.inquiries};
        return{results:[]};
      }
    };
    return statement;
  }
};
const env={DB:db,TURNSTILE_SECRET_KEY:'mock-private-secret',TURNSTILE_EXPECTED_HOSTNAME:'tassienow.com',SESSION_SECRET:'mock-session-secret'};
const corrections={place_slug:'test-cafe',place_name:'Test Cafe',requester_name:'QA Test',requester_email:'qa@example.invalid',relationship:'visitor',field:'opening-hours',suggested_value:'Open after noon'};
const ad={name:'QA Test',business:'Test Venue',email:'qa@example.invalid',package_code:'homepage-inline-7',message:'Testing the mocked advertising queue'};

function context(path,body,extraEnv=env,headers={}){
 return {env:extraEnv,request:new Request('https://tassienow.com'+path,{
  method:'POST',headers:{'content-type':'application/json',origin:'https://tassienow.com',...headers},
  body:JSON.stringify(body)
 })};
}
test('invalid or missing Turnstile blocks BOTH queues without inserting anything',async()=>{
 const before=[data.corrections.length,data.inquiries.length];
 for(const [path,handler,body] of [
   ['/api/listing-corrections',correct,corrections],['/api/advertise',advertise,ad]
 ]){
   assert.equal((await handler(context(path,body))).status,400);
   assert.equal((await handler(context(path,{...body,'cf-turnstile-response':'fake-token'}))).status,400);
   assert.equal((await handler(context(path,{...body,'cf-turnstile-response':'valid-test-response'},{DB:db}))).status,503);
   assert.equal((await handler(context(path,{...body,'cf-turnstile-response':'valid-test-response'},env,{origin:'https://evil.invalid'}))).status,403);
 }
 assert.deepEqual([data.corrections.length,data.inquiries.length],before);
});
test('valid mock Turnstile saves each type; authenticated dashboard reads submitted rows',async()=>{
 assert.equal((await correct(context('/api/listing-corrections',{...corrections,'cf-turnstile-response':'valid-test-response'}))).status,201);
 assert.equal((await advertise(context('/api/advertise',{...ad,'cf-turnstile-response':'valid-test-response'}))).status,201);
 assert.equal(data.corrections.length,1);
 assert.equal(data.inquiries.length,1);
 const token=await createSession(env);
 for(const [path,handler,key] of [
   ['/api/admin/listing-corrections',viewCorrections,'corrections'],
   ['/api/admin/inquiries',viewInquiries,'inquiries']
 ]){
  const out=await handler({env,request:new Request('https://tassienow.com'+path,{headers:{cookie:'tn_admin='+token}})});
  assert.equal(out.status,200);
  const json=await out.json();
  assert.equal(json[key].length,1);
 }
});
