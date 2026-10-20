import { decodeEventEntities } from './event-text-entities.mjs';

// Only evidence from the SAME source Event.location can populate Event metadata.
// Do not manufacture venue names or street addresses for SEO.
const value=x=>decodeEventEntities(typeof x==='string'?x:'')
 .replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,180);
const placeholder=/^(?:venue|location|online|tba|tbc|to be (?:announced|confirmed)|see (?:website|event)|unknown|not available|tasmania)$/i;
const looksLikeStreet=s=>/^(?:\d{1,5}[a-z]?(?:\/\d+)?\s+)?\d{1,5}[a-z]?\s+.+\b(?:road|rd|street|st|avenue|ave|drive|dr|parade|lane|ln|highway|hwy|place|pl)\b/i.test(s);
export function sourceEventLocation(raw){
 const loc=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
 const data=loc.address&&typeof loc.address==='object'&&!Array.isArray(loc.address)?loc.address:{};
 const street=value(data.streetAddress||(typeof loc.address==='string'?loc.address:''));
 const locality=value(data.addressLocality);
 const postal=value(data.postalCode);
 const name=value(loc.name);
 const venue=!name||placeholder.test(name)||looksLikeStreet(name)?null:name;
 let address=street&&!placeholder.test(street)?street:null;
 if(address&&locality&&!new RegExp(locality.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i').test(address))address+=', '+locality;
 if(address&&postal&&!address.includes(postal))address+=' '+postal;
 return {venue,address,locality:locality||null};
}
