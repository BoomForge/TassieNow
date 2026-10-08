import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../../functions/api/listing-corrections.js';

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
  return {context:{request,env:{DB:database}},sql};
}
const valid={place_slug:'sample-cafe',place_name:'Sample Cafe',requester_name:'Visitor',requester_email:'visitor@example.com',relationship:'visitor',field:'opening-hours',suggested_value:'Open Tuesdays 10am to 3pm'};

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
