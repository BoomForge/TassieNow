/**
 * Decode common numeric typography entities found in event titles, including
 * double-escaped &amp;#8217; from upstream feeds. Deliberately do not decode
 * angle brackets or other HTML markup entities into active tags.
 */
const safeNumeric=new Map([
 [38,'&'],[39,"'"],[160,' '],[8211,'–'],[8212,'—'],[8216,'‘'],
 [8217,'’'],[8220,'“'],[8221,'”'],[8230,'…']
]);
export function decodeEventEntities(value=''){
 let text=String(value??'');
 for(let i=0;i<3;i++){
  const next=text.replace(/&amp;/gi,'&')
   .replace(/&#(?:x([0-9a-f]{1,6})|([0-9]{1,7}));/gi,(full,hex,dec)=>{
    const code=hex?parseInt(hex,16):parseInt(dec,10);
    return safeNumeric.get(code)??full;
   })
   .replace(/&(?:nbsp|quot|apos|ndash|mdash);/gi,full=>({
    '&nbsp;':' ','&quot;':'"','&apos;':"'",'&ndash;':'–','&mdash;':'—'
   })[full.toLowerCase()]??full);
  if(next===text)break;
  text=next;
 }
 return text;
}
