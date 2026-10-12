import fs from 'node:fs/promises';
import path from 'node:path';
import { marketCopy, tasmaniaDate } from '../src/lib/market-seo.mjs';

const root=path.resolve('dist');
const results={generatedAt:new Date().toISOString(),htmlCount:0,imageCount:0,scriptCount:0,totalBytes:0,issues:[],largestAssets:[],oversizeImages:[]};
const files=[];
const today=tasmaniaDate();
const validDay=(value)=>/^\d{4}-\d{2}-\d{2}$/.test(value||'') && !Number.isNaN(Date.parse(value+'T12:00:00Z'));
const absoluteUrl=(value)=>typeof value==='string' && /^https:\/\//.test(value);
async function walk(dir){
 for(const item of await fs.readdir(dir,{withFileTypes:true})){
  const full=path.join(dir,item.name);
  if(item.isDirectory())await walk(full);else if(item.isFile())files.push(full);
 }
}
await walk(root);
const sizes=[];
for(const file of files){
 const relative=path.relative(root,file).replaceAll(path.sep,'/');
 const stat=await fs.stat(file);
 results.totalBytes+=stat.size;
 sizes.push({path:relative,bytes:stat.size});
 if(/\.(?:png|jpe?g|webp|avif)$/i.test(file)){results.imageCount++;if(stat.size>4*1024*1024)results.oversizeImages.push({path:relative,bytes:stat.size});}
 if(/\.(?:m?js)$/i.test(file)){results.scriptCount++;if(stat.size>850000)results.issues.push('Large JavaScript asset: '+relative);}
 if(!relative.endsWith('.html'))continue;
 results.htmlCount++;
 const html=await fs.readFile(file,'utf8');
 const is404=relative==='404.html';
 if(!/<meta[^>]+name=["']description["']/i.test(html)&&!is404)results.issues.push('Missing description: '+relative);
 if(!/<link[^>]+rel=["']canonical["']/i.test(html)&&!is404)results.issues.push('Missing canonical: '+relative);
 if(!/<h1[\s>]/i.test(html)&&!is404)results.issues.push('Missing h1: '+relative);
 if(stat.size>3000000)results.issues.push('Oversized HTML: '+relative);
 if(/^(?:place|event|town|region)\//.test(relative)){
   const scripts=[...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
   if(!scripts.length)results.issues.push('Missing structured data: '+relative);
   if(relative.startsWith('event/')){
     let nodes=[];
     for(const [,json] of scripts){
       try{
         const value=JSON.parse(json);
         nodes.push(...(Array.isArray(value)?value:[value]));
       }catch{results.issues.push('Invalid JSON-LD: '+relative);}
     }
     const event=nodes.find(node=>node['@type']==='Event');
     if(!event)results.issues.push('Missing Event schema: '+relative);
     else{
       if(!event.name || !validDay(event.startDate) || !validDay(event.endDate) || event.endDate<event.startDate)
         results.issues.push('Invalid Event name or dates: '+relative);
       if(!event.location?.address?.addressLocality || event.location.address.addressCountry!=='AU')
         results.issues.push('Invalid Event location: '+relative);
       if(!absoluteUrl(event.url))results.issues.push('Missing absolute Event URL: '+relative);
       if(event.image && (!Array.isArray(event.image)||!event.image.every(absoluteUrl)))
         results.issues.push('Invalid Event image URLs: '+relative);
       if(event.endDate<today)results.issues.push('Expired Event still built: '+relative);
     }
   }
 }
 if(/^(?:place|discover|town|region)\//.test(relative) && marketCopy(html,today)!==html)
   results.issues.push('Expired next-session claim in rendered HTML: '+relative);
}
for(const required of ['index.html','food/index.html','privacy/index.html','terms/index.html','sitemap.xml','robots.txt','data/site-build-date.json']){
 if(!files.some(file=>path.relative(root,file).replaceAll(path.sep,'/')===required))results.issues.push('Missing expected build output: '+required);
}
results.largestAssets=sizes.sort((a,b)=>b.bytes-a.bytes).slice(0,15);
await fs.mkdir('reports',{recursive:true});
await fs.writeFile('reports/launch-build-audit.json',JSON.stringify(results,null,2)+'\n');
console.log('Static build audit: '+results.htmlCount+' HTML pages, '+results.imageCount+' images, '+results.scriptCount+' JavaScript assets; '+results.issues.length+' issues; '+results.oversizeImages.length+' large images.');
for(const issue of results.issues.slice(0,30))console.error('- '+issue);
if(results.issues.length)process.exitCode=1;
