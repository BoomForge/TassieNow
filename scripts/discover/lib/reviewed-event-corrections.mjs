/** Normalize only referral-tracking parameters, never session/date identifiers. */
export function normaliseEventSourceUrl(raw) {
  if (typeof raw !== 'string' || !raw.startsWith('https://')) return raw;
  try {
    const url=new URL(raw);
    if(url.hostname.toLowerCase()!=='events.humanitix.com')return raw;
    for(const key of [...url.searchParams.keys()]){
      if(['hxref','hxchl'].includes(key.toLowerCase()) || /^utm_/i.test(key))url.searchParams.delete(key);
    }
    return url.href;
  } catch { return raw; }
}
export function applyReviewedEventCorrection(event,overrides){
  const normalized=normaliseEventSourceUrl(event.eventUrl);
  const direct=overrides[event.slug];
  const bySource=Object.values(overrides).find(x=>x.eventUrl && normaliseEventSourceUrl(x.eventUrl)===normalized);
  const correction=direct||bySource;
  return {...event,eventUrl:normalized,...(correction?.fields||{})};
}
