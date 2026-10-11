// Third-party photo sources are clickable links only, never TassieNow media assets.
export function photoSourceLink(input, checkedAt) {
  const sourceUrl=String(input.photo_link_url||'').trim();
  let address;
  try { address=new URL(sourceUrl); } catch { throw new Error('Enter the original photo or gallery URL.'); }
  if(address.protocol!=='https:' || address.username || address.password ||
    !address.hostname.includes('.') || /^(localhost|127\.|10\.|192\.168\.|169\.254\.)/i.test(address.hostname) ||
    sourceUrl.length>900)throw new Error('Photo source must be a public HTTPS link.');
  if(/(^|\.)(google\.[a-z.]+|googleusercontent\.com|gstatic\.com|bing\.com)$/i.test(address.hostname))
    throw new Error('Link to the original photographer, business or gallery page, not the Google search result or cached image.');
  if(input.photo_source_confirmed!==true)
    throw new Error('Confirm the source actually depicts this listing before linking it.');
  const title=String(input.photo_link_title||'').trim().slice(0,160);
  const credit=String(input.photo_link_credit||'').trim().slice(0,160);
  if(title.length<3)throw new Error('Give this source link a descriptive title.');
  return {sourceUrl:address.href,title,credit,kind:'external-source-link',checkedAt};
}
