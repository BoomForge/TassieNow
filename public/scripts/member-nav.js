import {api} from './member-common.js';
try{const {user}=await api('session');const link=document.querySelector('[data-member-link]');if(link&&user)link.textContent='My TassieNow';}catch{}
