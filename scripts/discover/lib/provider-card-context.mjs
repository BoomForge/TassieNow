/**
 * A ticketing search-result link may only use date and location information
 * from its OWN card. Never read 700 bytes before the link, because that can
 * pair it with the previous ticket or next card's venue.
 */
export function providerCardContext(html,anchor){
 const source=String(html||'');
 if(!anchor||!Number.isInteger(anchor.index)||!anchor[0])return '';
 const start=anchor.index;
 const endAnchor=start+anchor[0].length;
 const after=source.slice(endAnchor,Math.min(source.length,endAnchor+520));
 const boundaries=[/<\/article\s*>/i,/<\/li\s*>/i,/<a\b/i]
  .map(re=>after.search(re)).filter(n=>n>=0);
 const remaining=after.slice(0,boundaries.length?Math.min(...boundaries):after.length);
 return anchor[0]+' '+remaining;
}
