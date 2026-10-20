/**
 * Extract ONLY an event link's own trailing listing-card text. A preceding or
 * following event must never donate its date to a City of Clarence card.
 * Absence of an independently paired date is a reason to skip, not guess.
 */
export function clarenceListingCardText(html,anchor,anchors=[]){
 const raw=String(html||'');
 const from=(anchor?.index??-1)+(anchor?.[0]?.length??0);
 if(!Number.isInteger(anchor?.index)||from<=0||from>raw.length)return '';
 const next=anchors.find(a=>a.index>anchor.index && /\/event\//i.test(String(a[1]||'')));
 const limit=Math.min(raw.length,from+480,next?.index??Infinity);
 let suffix=raw.slice(from,limit);
 const close=suffix.search(/<\/(?:article|li|section)>/i);
 if(close>=0)suffix=suffix.slice(0,close);
 return String(anchor[2]||'')+' '+suffix;
}
