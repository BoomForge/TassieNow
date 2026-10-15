export const esc = (value='') => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function api(path,options={}) {
  const response=await fetch(`/api/member/${path}`,{credentials:'same-origin',cache:'no-store',...options,headers:{Accept:'application/json',...(options.body&&!(options.body instanceof FormData)?{'Content-Type':'application/json'}:{}),...options.headers}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){const error=new Error(data.error||'Unable to connect. Please try again.');error.status=response.status;throw error;}return data;
}
export const send = (path,body={},method='POST') => api(path,{method,body:JSON.stringify(body)});
export function message(node,value,error=false){node.textContent=value;node.classList.toggle('member-error',error);}
export async function busy(form,action){const buttons=form.querySelectorAll('button');buttons.forEach(b=>b.disabled=true);try{return await action();}finally{buttons.forEach(b=>b.disabled=false);}}
let captchaPromise;const widgets=new WeakMap();
export async function mountCaptcha(form){
  const box=form.querySelector('.member-captcha');if(!box||widgets.has(form))return;
  const key=document.querySelector('[data-turnstile-key]')?.dataset.turnstileKey;
  if(!key){box.textContent='Human verification is unavailable. Please try again later.';return;}
  if(!captchaPromise)captchaPromise=new Promise((resolve,reject)=>{
    if(window.turnstile){resolve();return;}
    window.tassieCaptchaReady=()=>resolve();
    const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=tassieCaptchaReady';script.async=true;script.onerror=()=>reject(new Error('Unable to load human verification. Check your connection.'));document.head.append(script);
  });
  await captchaPromise;
  if(widgets.has(form)||!box.isConnected)return;
  widgets.set(form,window.turnstile.render(box,{sitekey:key,theme:'auto',size:'flexible','response-field':false}));
}
export function token(form){const id=widgets.get(form),value=id!==undefined?window.turnstile?.getResponse(id):'';if(!value)throw new Error('Please complete the human verification.');return value;}
export function resetCaptcha(form){const id=widgets.get(form);if(id!==undefined)window.turnstile?.reset(id);}
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
