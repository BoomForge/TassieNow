import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../../functions/api/metrics.js';

function send(event,options={}){
 const statements=[];
 let tableExists=options.tableExists!==false;
 const database={prepare(sql){
   const values=[];
   const statement={bind(...args){values.push(...args);return statement;},async run(){statements.push({sql,values});if(sql.startsWith('INSERT')&&!tableExists)throw Error('no such table: discovery_metrics');if(sql.startsWith('CREATE TABLE'))tableExists=true;return{success:true};}};
   return statement;
 }};
 const request=new Request('https://tassienow.com/api/metrics',{method:'POST',headers:{origin:options.origin||'https://tassienow.com','content-type':'text/plain'},body:JSON.stringify(event)});
 return {context:{request,env:{DB:database}},statements};
}
test('Records anonymous aggregated page visit',async()=>{
 const {context,statements}=send({type:'view',path:'/town/hobart/',detail:''});
 const response=await onRequestPost(context);
 assert.equal(response.status,204);
 assert.ok(statements.some(s=>s.sql.startsWith('INSERT')));
 assert.equal(statements.some(s=>s.values.includes('Hobart resident')) , false);
});
test('Avoids storing search queries or arbitrary destination URLs',async()=>{
 const {context,statements}=send({type:'search',path:'/food/',detail:'my personal search'});
 const response=await onRequestPost(context);
 assert.equal(response.status,400);
 assert.equal(statements.length,0);
});
test('Rejects external origins and fabricated route paths',async()=>{
 const badOrigin=send({type:'view',path:'/'},{origin:'https://example.com'});
 assert.equal((await onRequestPost(badOrigin.context)).status,403);
 const badRoute=send({type:'view',path:'/admin/private/',detail:''});
 assert.equal((await onRequestPost(badRoute.context)).status,400);
});
test('First real event can initialise absent metrics table',async()=>{
 const {context,statements}=send({type:'outbound',path:'/place/example/',detail:'booking'},{tableExists:false});
 assert.equal((await onRequestPost(context)).status,204);
 assert.ok(statements.some(s=>s.sql.startsWith('CREATE TABLE')));
});
