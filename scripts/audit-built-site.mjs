import fs from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve('dist');
const results={generatedAt:new Date().toISOString(),htmlCount:0,imageCount:0,scriptCount:0,totalBytes:0,issues:[],largestAssets:[],oversizeImages:[]};
const files=[];
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
   const schemas=[...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
   if(!schemas.length)results.issues.push('Missing structured data: '+relative);
 }
}
for(const required of ['index.html','food/index.html','privacy/index.html','terms/index.html','sitemap.xml','robots.txt']){
 if(!files.some(file=>path.relative(root,file).replaceAll(path.sep,'/')===required))results.issues.push('Missing expected build output: '+required);
}
results.largestAssets=sizes.sort((a,b)=>b.bytes-a.bytes).slice(0,15);
await fs.mkdir('reports',{recursive:true});
await fs.writeFile('reports/launch-build-audit.json',JSON.stringify(results,null,2)+'\n');
console.log('Static build audit: '+results.htmlCount+' HTML pages, '+results.imageCount+' images, '+results.scriptCount+' JavaScript assets; '+results.issues.length+' issues; '+results.oversizeImages.length+' large images.');
for(const issue of results.issues.slice(0,30))console.error('- '+issue);
if(results.issues.length)process.exitCode=1;
