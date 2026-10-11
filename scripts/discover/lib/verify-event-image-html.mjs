// Inspect the rendered hero <img> URL, not page-level text or a decoded filename.
// URL comparisons tolerate percent-encoded non-ASCII Commons filenames.
export function heroImageMatches(html, expectedUrl, pageUrl){
  const tag=html.match(/<img\b[^>]*class=["'][^"']*\bdetail-image\b[^"']*["'][^>]*>/i)?.[0];
  if(!tag)return {figure:false,photograph:false};
  const src=tag.match(/\bsrc=["']([^"']+)["']/i)?.[1]?.replaceAll('&amp;','&');
  if(!src)return {figure:true,photograph:false};
  try {
    const actual=new URL(src,pageUrl);
    const expected=new URL(expectedUrl);
    return {figure:true,photograph:actual.origin===expected.origin &&
      decodeURIComponent(actual.pathname)===decodeURIComponent(expected.pathname)};
  }catch{return {figure:true,photograph:false};}
}


export function visibleCaptionMatches(html,expectedCaption){
 if(!expectedCaption)return true;
 // Astro escapes apostrophes, ampersands and quotation marks in HTML text;
 // compare the actual rendered caption text, not the raw HTML byte sequence.
 const figure=String(html).match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i)?.[1];
 if(!figure)return false;
 const decoded=figure.replace(/<[^>]*>/g,' ')
  .replace(/&(?:amp|#38|#x26);/gi,'&')
  .replace(/&(?:apos|#39|#x27);/gi,"'")
  .replace(/&(?:quot|#34|#x22);/gi,'"')
  .replace(/&nbsp;|&#160;/gi,' ')
  .replace(/\s+/g,' ').trim();
 return decoded.includes(String(expectedCaption).replace(/\s+/g,' ').trim());
}
