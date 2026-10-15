import {mountCaptcha,token,message} from './member-common.js';
const form=document.querySelector('#login-form'),status=document.querySelector('#login-status');
if(form){
 const input=document.createElement('input');input.type='hidden';input.name='cf-turnstile-response';form.append(input);
 form.addEventListener('submit',event=>{
  try{input.value=token(form);}catch(error){event.preventDefault();event.stopImmediatePropagation();message(status,error.message,true);}
 },{capture:true});
 mountCaptcha(form).catch(error=>message(status,error.message,true));
}
