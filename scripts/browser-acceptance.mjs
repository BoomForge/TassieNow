import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const BASE='https://tassienow.com';
const widths=[320,375,390,430,768,820,1024,1440];
const paths=['/','/food/','/discover/markets/','/discover/this-weekend/','/region/hobart-and-south/','/suggest-update/','/advertise/'];
const report={at:new Date().toISOString(),scope:'Live Chromium: viewport overflow, navigation, keyboard, denied geolocation, food filters and WCAG 2.1 AA axe-core checks',checks:[],failures:[]};
await fs.mkdir('reports/browser-screenshots',{recursive:true});
const browser=await chromium.launch({headless:true});
const add=(name,ok,detail={},failedScreenshot=null)=>{
 const entry={name,status:ok?'pass':'fail',...detail};
 report.checks.push(entry);
 if(!ok)report.failures.push(entry);
 return entry;
};
try{
 for(const width of widths){
  const context=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:1,isMobile:width<=430,hasTouch:width<=430});
  await context.addInitScript(()=>{
    try{Object.defineProperty(navigator,'doNotTrack',{configurable:true,get:()=> '1'});}catch{}
    try{Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition(ok,fail){fail({code:1,message:'Permission denied'});}}});}catch{}
  });
  const page=await context.newPage();
  for(const path of paths){
   try{
    const response=await page.goto(BASE+path,{waitUntil:'domcontentloaded',timeout:30000});
    if(response?.status()!==200){add('Page load',false,{width,path,httpCode:response?.status()});continue;}
    await page.waitForTimeout(140);
    const geometry=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth,h1:document.querySelectorAll('h1').length,main:!!document.querySelector('main')}));
    const noOverflow=geometry.scrollWidth<=geometry.viewport+2;
    add('Viewport overflow',noOverflow,{width,path,...geometry});
    if(!noOverflow) await page.screenshot({path:'reports/browser-screenshots/overflow-'+width+'-'+path.replace(/[^a-z0-9]+/gi,'-')+'.png',fullPage:false});
    add('Heading and main landmark',geometry.h1===1&&geometry.main,{width,path,h1:geometry.h1,main:geometry.main});
    if(path==='/'&&width<=430){
      const toggle=page.locator('#nav-toggle');
      const visible=await toggle.isVisible();
      if(visible){
        await toggle.click();
        const expanded=await toggle.getAttribute('aria-expanded');
        const navVisible=await page.locator('#primary-nav').isVisible();
        add('Mobile navigation opens',expanded==='true'&&navVisible,{width,path,expanded,navVisible});
        await toggle.click();
        add('Mobile navigation closes',(await toggle.getAttribute('aria-expanded'))==='false',{width,path});
      }else add('Mobile navigation toggle present',false,{width,path});
      await page.locator('#hero-near-me').click();
      await page.waitForTimeout(180);
      const status=(await page.locator('#hero-location-status').innerText()).trim();
      add('Denied geolocation is explained',/denied|unavailable|location|permission|town|region|access/i.test(status)&&status.length>18,{width,path,message:status.slice(0,250)});
      await page.keyboard.press('Tab');
      const focused=await page.evaluate(()=>document.activeElement?.tagName||'');
      add('Keyboard Tab moves focus',!['','BODY','HTML'].includes(focused),{width,path,tag:focused});
    }
    if(path==='/advertise/'){
      const layout=await page.evaluate(()=>{
        const bound=selector=>document.querySelector(selector)?.getBoundingClientRect();
        const shell=bound('.advertise-page');
        const sections=['.advertise-grid','.rate-note','.guidelines-panel','.payment-note','.form-panel'].map(bound);
        const form=bound('#advertise-form');
        const inputs=[...document.querySelectorAll('#advertise-form input:not(.honeypot input),#advertise-form select,#advertise-form textarea')].map(el=>el.getBoundingClientRect());
        const prices=[...document.querySelectorAll('.info-card h2')].map(el=>el.getBoundingClientRect().top);
        const aligned=Boolean(shell&&sections.every(rect=>rect&&Math.abs(rect.left-(shell.left+parseFloat(getComputedStyle(document.querySelector('.advertise-page')).paddingLeft)))<=3));
        const bounded=Boolean(shell&&shell.width<=1182&&shell.left>=-1&&shell.right<=innerWidth+1);
        const formFits=Boolean(form&&inputs.every(rect=>rect.left>=-1&&rect.right<=innerWidth+1));
        const priceAligned=innerWidth<1000||prices.length<3||Math.max(...prices)-Math.min(...prices)<=3;
        return {aligned,bounded,formFits,priceAligned,shellX:shell?.left,sectionX:sections.map(rect=>rect?.left),inputRightMax:Math.max(0,...inputs.map(rect=>rect.right)),viewport:innerWidth};
      });
      add('Advertising page column alignment',layout.aligned&&layout.bounded&&layout.priceAligned,{width,path,...layout});
      add('Advertising form inputs fit viewport',layout.formFits,{width,path,...layout});
      if(!layout.aligned||!layout.bounded||!layout.formFits||!layout.priceAligned)await page.screenshot({path:'reports/browser-screenshots/advertise-'+width+'.png',fullPage:true});
    }
    if(path==='/food/'&&(width===375||width===1440)){
      await page.locator('#eat-search').fill('zzzz-no-such-tasmanian-venue-999');
      const empty=await page.locator('#eat-empty').isVisible();
      add('Food search shows no-results state',empty,{width,path});
      await page.locator('#eat-clear').click();
      const cleared=(await page.locator('#eat-search').inputValue())===''&&!(await page.locator('#eat-empty').isVisible());
      add('Food clear filters restores results',cleared,{width,path});
    }
    if((width===375||width===1440)&&['/','/food/','/discover/markets/','/suggest-update/','/advertise/'].includes(path)){
      const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
      const problems=axe.violations.map(v=>({id:v.id,impact:v.impact,description:v.description,affected:v.nodes.length,examples:v.nodes.slice(0,3).map(n=>n.target.join(' '))}));
      add('Automated WCAG 2.1 AA',!problems.length,{width,path,violations:problems});
      if(problems.length)await page.screenshot({path:'reports/browser-screenshots/a11y-'+width+'-'+path.replace(/[^a-z0-9]+/gi,'-')+'.png',fullPage:false});
    }
   }catch(error){add('Browser inspection',false,{width,path,error:String(error?.message||error).slice(0,500)});}
  }
  await context.close();
 }
}finally{await browser.close();}
report.summary={passed:report.checks.filter(c=>c.status==='pass').length,failed:report.failures.length,total:report.checks.length};
await fs.writeFile('reports/browser-acceptance.json',JSON.stringify(report,null,2)+'\n');
if(process.env.GITHUB_STEP_SUMMARY){
 const lines=['## TassieNow Chromium mobile / accessibility sweep',report.summary.passed+'/'+report.summary.total+' passed; '+report.summary.failed+' failed',
 'Automated results only; manual screen-reader and genuine visitor acceptance remain necessary.'];
 for(const failure of report.failures.slice(0,60))lines.push('- '+failure.name+' '+failure.width+'px '+failure.path+': '+JSON.stringify(failure.violations||failure.message||failure.error||failure.geometry||'check failed').slice(0,400));
 await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,lines.join('\n')+'\n');
}
console.log('Chromium browser sweep: '+JSON.stringify(report.summary));
if(report.summary.failed)process.exitCode=1;
