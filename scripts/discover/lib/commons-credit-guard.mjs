/** A Commons photo under an attribution licence needs a named credit. */
export function usableCommonsCreator(meta={}, licence='', licenceUrl=''){
 const raw=String(meta.Artist?.value||meta.Credit?.value||'').replace(/<[^>]*>/g,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();
 const publicDomain=/^(?:cc0|public domain)$/i.test(String(licence).trim())||
   /creativecommons\.org\/publicdomain\/zero\//i.test(String(licenceUrl));
 if(publicDomain)return raw||'Public domain contributor';
 if(!raw || /^(?:wikimedia commons contributor|unknown|anonymous|n\/a|commons)$/i.test(raw))return null;
 return raw;
}
