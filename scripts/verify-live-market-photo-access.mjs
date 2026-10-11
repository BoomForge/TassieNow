import fs from 'node:fs/promises';
const base=process.env.MARKET_PHOTO_SITE||'https://tassienow.com';
const pages=[
 {path:'/discover/markets/',checks:['Google visitor photos','Markets in Tasmania']},
 {path:'/place/salamanca-market/',checks:['Visitor photos & Google reviews','View visitor photos on Google Maps','Search Google Images','Submit an official photo or permission evidence']}
];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let results=[];
for(let attempt=1;attempt<=12;attempt++){
 results=await Promise.all(pages.map(async page=>{
  try{
   const res=await fetch(base+page.path+'?market-photo-check='+Date.now()+'-'+attempt,{
    headers:{'user-agent':'TassieNow-Market-Photo-Publication-Check/1.0',
      'cache-control':'no-cache'},
    signal:AbortSignal.timeout(12000)
   });
   const html=await res.text();
   const missing=page.checks.filter(token=>!html.includes(token));
   if(html.includes('maps.googleapis.com/maps/api/js')||html.includes('<gmp-place-details'))
     missing.push('unexpected billable Google Maps widget');
   return {path:page.path,http:res.status,verified:res.ok&&missing.length===0,
     missing,attempt};
  }catch(e){return {path:page.path,verified:false,error:String(e.message),attempt};}
 }));
 if(results.every(x=>x.verified))break;
 if(attempt<12)await sleep(10000);
}
const report={checkedAt:new Date().toISOString(),verified:results.filter(x=>x.verified).length,
 checked:results.length,results};
await fs.mkdir(new URL('../reports/',import.meta.url),{recursive:true});
await fs.writeFile(new URL('../reports/live-market-photo-access.json',import.meta.url),
 JSON.stringify(report,null,2)+'\n');
console.log('Market photo access production verification '+JSON.stringify(report));
if(process.env.GITHUB_STEP_SUMMARY){
 await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,
  '## Market photo access production\n'+report.verified+'/'+report.checked+
  ' page checks passed.\n');
}
if(report.verified!==report.checked)process.exitCode=1;
