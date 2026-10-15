export const esc = (value='') => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function api(path,options={}) {
  const attempts=(!options.method||options.method==='GET')?2:1;
  for(let attempt=0;attempt<attempts;attempt++){
    try{
      const response=await fetch(`/api/member/${path}`,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(10000),...options,headers:{Accept:'application/json',...(options.body&&!(options.body instanceof FormData)?{'Content-Type':'application/json'}:{}),...options.headers}});
      const data=await response.json().catch(()=>({}));
      if(!response.ok){const error=new Error(data.error||'Unable to connect. Please try again.');error.status=response.status;throw error;}return data;
    }catch(error){
      if(attempt+1>=attempts||(error.status&&error.status<500)){
        if(error.name==='TimeoutError'||error.name==='AbortError')throw new Error('The connection timed out. Please try again.');
        throw error;
      }
      await new Promise(resolve=>setTimeout(resolve,500));
    }
  }
}
export const send = (path,body={},method='POST') => api(path,{method,body:JSON.stringify(body)});
export function message(node,value,error=false){node.textContent=value;node.classList.toggle('member-error',error);}
export async function busy(form,action){const buttons=form.querySelectorAll('button');buttons.forEach(b=>b.disabled=true);try{return await action();}finally{buttons.forEach(b=>b.disabled=false);}}
let captchaPromise;const widgets=new WeakMap();
function captchaStatus(form,value,error=false){
  let status=form.querySelector('.member-captcha-status');
  if(!status){status=document.createElement('p');status.className='member-captcha-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');form.querySelector('.member-captcha').after(status);}
  message(status,value,error);
}
async function loadTurnstile(){
  if(window.turnstile?.render)return;
  if(!captchaPromise)captchaPromise=new Promise((resolve,reject)=>{
    let script=document.querySelector('script[data-member-turnstile]');
    const timeout=setTimeout(()=>reject(new Error('Security verification could not connect. Please retry.')),15000);
    const ready=()=>{clearTimeout(timeout);if(window.turnstile?.render)resolve();else reject(new Error('Security verification did not load. Please retry.'));};
    if(!script){script=document.createElement('script');script.setAttribute('data-cfasync','false');script.setAttribute('data-member-turnstile','');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;document.head.append(script);}
    script.addEventListener('load',ready,{once:true});
    script.addEventListener('error',()=>{clearTimeout(timeout);script.remove();reject(new Error('Unable to load security verification. Please retry.'));},{once:true});
    if(window.turnstile?.render)ready();
  }).catch(error=>{captchaPromise=undefined;throw error;});
  await captchaPromise;
}
export async function mountCaptcha(form){
  const box=form.querySelector('.member-captcha');if(!box||widgets.has(form))return;
  const key=(document.querySelector('[data-turnstile-key]')?.dataset.turnstileKey||'').trim();
  if(!key){captchaStatus(form,'Human verification is unavailable. Please try again later.',true);return;}
  let retry=form.querySelector('.member-captcha-retry');
  if(!retry){retry=document.createElement('button');retry.type='button';retry.className='member-secondary member-captcha-retry';retry.textContent='Retry security check';retry.hidden=true;box.after(retry);retry.addEventListener('click',()=>{removeCaptcha(form);mountCaptcha(form).catch(error=>{captchaStatus(form,error.message,true);retry.hidden=false;});});}
  captchaStatus(form,'Loading security check…');retry.hidden=true;
  try{
    await loadTurnstile();if(widgets.has(form)||!box.isConnected)return;
    const id=window.turnstile.render(box,{sitekey:key,theme:'auto',size:'flexible','response-field':false,retry:'never',
      callback:()=>{captchaStatus(form,'Security check complete.');retry.hidden=true;},
      'expired-callback':()=>{captchaStatus(form,'Security check expired. Please retry.',true);retry.hidden=false;},
      'timeout-callback':()=>{captchaStatus(form,'Security check timed out. Please retry.',true);retry.hidden=false;},
      'error-callback':code=>{captchaStatus(form,`Security check could not connect (code ${String(code).replace(/[^0-9]/g,'')}). Please retry.`,true);retry.hidden=false;return true;}
    });widgets.set(form,id);
  }catch(error){captchaStatus(form,error.message,true);retry.hidden=false;throw error;}
}
export function token(form){const id=widgets.get(form),value=id!==undefined?window.turnstile?.getResponse(id):'';if(!value)throw new Error(form.querySelector('.member-captcha-status.member-error')?.textContent||'Please complete the human verification.');return value;}
export function resetCaptcha(form){const id=widgets.get(form);if(id!==undefined){window.turnstile?.reset(id);captchaStatus(form,'Complete the security check.');}}
export function removeCaptcha(form){const id=widgets.get(form);if(id!==undefined){window.turnstile?.remove(id);widgets.delete(form);}}
export async function compressPhoto(file){
  if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Choose a JPG, PNG or WebP photograph.');
  if(file.size>15000000)throw new Error('Choose an original image smaller than 15 MB.');
  let image;try{image=await createImageBitmap(file,{imageOrientation:'from-image'});}catch{throw new Error('This photograph could not be read. Try a JPG or PNG.');}
  try{
    let size=1600;
    for(let attempt=0;attempt<7;attempt++){
      const scale=Math.min(1,size/Math.max(image.width,image.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
      const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',Math.max(.45,.84-attempt*.06)));
      if(blob&&blob.size<=300000)return new File([blob],'photo.jpg',{type:'image/jpeg'});size=Math.floor(size*.8);
    }throw new Error('This image could not be reduced enough. Try a smaller photograph.');
  }finally{image.close();}
}
