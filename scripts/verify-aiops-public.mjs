import fs from 'node:fs/promises';
const base='https://tassienow.com';
const specs=JSON.parse(await fs.readFile(new URL('../src/data/aiops-verification-manifest.json',import.meta.url)));
const events=JSON.parse(await fs.readFile(new URL('../src/data/events.json',import.meta.url)));
const places=JSON.parse(await fs.readFile(new URL('../src/data/places.json',import.meta.url)));
const quarantined=JSON.parse(await fs.readFile(new URL('../src/data/booking-quarantine.json',import.meta.url))).slugs;
const cache=new Map();
const textOf=s=>s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&#39;|&apos;/gi,"'").replace(/\s+/g,' ').trim();
const linkList=html=>[...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map(x=>({href:x[1],label:textOf(x[2])}));
async function get(url){
 if(cache.has(url))return cache.get(url);
 const promise=(async()=>{
  for(let i=0;i<2;i++){
   try{
    const r=await fetch(url,{redirect:'manual',headers:{'user-agent':'Mozilla/5.0 (TassieNow independent AI Ops public QA)','cache-control':'no-cache'},signal:AbortSignal.timeout(10000)});
    const html=await r.text();
    return {status:r.status,html,location:r.headers.get('location'),text:textOf(html),links:linkList(html)};
   }catch(e){if(i===1)return {status:0,html:'',text:'',links:[],error:String(e?.message||e)}}
  }
 })();
 cache.set(url,promise);return promise;
}
const normalize=s=>String(s||'').toLowerCase().replace(/\s+/g,' ');
async function check(url,rule){
 const p=await get(url);const failures=[];
 if(rule.legacy){
  if(p.status===404||p.status===410)return {status:'pass',url,proof:'Retired HTTP '+p.status};
  if(p.status>=300&&p.status<400){
   if(!rule.redirectTo||String(p.location||'').includes(rule.redirectTo))return {status:'pass',url,proof:'HTTP '+p.status+' Location: '+p.location};
   return {status:'fail',url,proof:'Unexpected redirect '+p.location};
  }
  if(p.status===200&&/noindex/i.test(p.html))return {status:'pass',url,proof:'Legacy 200 with robots noindex'};
  return {status:p.status?'fail':'inaccessible',url,proof:'Legacy URL HTTP '+p.status+' no confirmed noindex'};
 }
 if(p.status!==200)return {status:'inaccessible',url,proof:'HTTP '+p.status+' '+(p.error||'')};
 const body=normalize(p.text),html=normalize(p.html);
 for(const v of rule.contains||[])if(!body.includes(normalize(v))&&!html.includes(normalize(v)))failures.push('missing '+v);
 for(const v of rule.absent||[])if(body.includes(normalize(v))||html.includes(normalize(v)))failures.push('forbidden '+v);
 if(rule.image&&!p.html.includes(rule.image))failures.push('image '+rule.image+' missing');
 if(rule.imageAbsent&&p.html.includes(rule.imageAbsent))failures.push('image '+rule.imageAbsent+' still shown');
 if(rule.href&&!p.links.some(x=>x.href.includes(rule.href)))failures.push('href '+rule.href+' missing');
 if(rule.phone){
  const phones=p.links.filter(x=>x.href.startsWith('tel:')).map(x=>x.href.replace(/\D/g,''));
  if(!phones.includes(rule.phone)&&!phones.includes('0'+rule.phone.slice(2)))failures.push('phone tel: link mismatch found '+phones.join(','));
 }
 if(rule.noBooking&&p.links.some(x=>/\bbook\s*\/?\s*tickets?\b/i.test(x.label)))failures.push('booking button present');
 if(rule.noHastings&&p.links.some(x=>/\bbook\s*\/?\s*tickets?\b/i.test(x.label)&&/hastings.*caves|\/https(%3a|:|&#58;)/i.test(x.href)))failures.push('unrelated Hastings booking link');
 if(rule.kind==='event'&&(rule.start||rule.end)){
  const match=[...p.html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  let data=null;for(const m of match)try{const d=JSON.parse(m[1]);for(const item of Array.isArray(d)?d:[d])if(item['@type']==='Event')data=item}catch{}
  if(!data)failures.push('Event JSON-LD missing');
  else{
   if(rule.start&&!String(data.startDate||'').startsWith(rule.start))failures.push('startDate '+data.startDate+' expected '+rule.start);
   if(rule.end&&!String(data.endDate||'').startsWith(rule.end))failures.push('endDate '+data.endDate+' expected '+rule.end);
  }
 }
 return {status:failures.length?'fail':'pass',url,proof:failures.length?failures.join(' | '):'HTTP 200; all explicit assertions matched'};
}
async function one(spec){
 let paths=spec.paths||[];
 if(spec.scope==='quarantine')paths=quarantined.map(x=>'/place/'+x+'/');
 if(spec.scope==='narawntapu')paths=['archers-knob','bird-hide','point-vision','springlawn-bird-hide-lookout'].map(x=>'/place/'+x+'/');
 if(spec.scope==='southwest')paths=places.filter(x=>/southwest-national-park/.test(x.slug||'')).map(x=>'/place/'+x.slug+'/');
 if(spec.scope==='parks')paths=places.filter(x=>x.status==='active'&&/Parks Tasmania|Parks & Wildlife/i.test(x.summary||x.officialSource?.name||'')&&!/hastings-caves/.test(x.slug||'')).slice(0,65).map(x=>'/place/'+x.slug+'/');
 if(spec.scope==='burnie')paths=events.filter(x=>x.status==='active'&&x.sourceName==='Burnie City Council').slice(0,25).map(x=>'/event/'+x.slug+'/');
 if(!paths.length)return {id:spec.id,status:'needs_scope',detail:'No applicable source pages or original expected facts',pages:[]};
 const output=await Promise.all(paths.map(path=>check(base+path,{...spec,kind:path.startsWith('/event/')?'event':'place'})));
 const bad=output.filter(x=>x.status==='fail'),unknown=output.filter(x=>x.status==='inaccessible');
 const status=bad.length?'fail':unknown.length?'inaccessible':'pass';
 return {id:spec.id,status,pages:output,detail:paths.length+' checked; '+bad.length+' failed; '+unknown.length+' inaccessible'};
}
const out=new Array(specs.length);let next=0;
await Promise.all(Array.from({length:6},async()=>{while(next<specs.length){const i=next++;try{out[i]=await one(specs[i])}catch(e){out[i]={id:specs[i].id,status:'inaccessible',detail:String(e),pages:[]}}}}));
const summary=out.reduce((a,x)=>(a[x.status]=(a[x.status]||0)+1,a),{});
const report={schema:'pixelwolf-aiops-public-verification-v1',generatedAt:new Date().toISOString(),commit:process.env.GITHUB_SHA||'',total:out.length,summary,results:out};
await fs.mkdir('artifacts',{recursive:true});await fs.writeFile('artifacts/ai-ops-public-verification.json',JSON.stringify(report,null,2)+'\n');
for(const r of out)console.log('[AI-OPS] '+r.status.toUpperCase()+' '+r.id+' '+r.detail+' '+(r.pages||[]).filter(x=>x.status!=='pass').slice(0,2).map(x=>x.url+' '+x.proof).join(' | ').slice(0,250));
console.log('[AI-OPS] SUMMARY '+JSON.stringify({total:out.length,...summary}));
console.log('[AI-OPS] No card closed automatically; independent host import and all original acceptance requirements remain mandatory.');
