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
