// An imported JSON-LD Event.url can be an array, object, relative URI or invalid string.
// Only independently addressable HTTP(S) URLs may be published as visitor links.
export function absoluteEventUrl(value) {
  if (typeof value !== 'string' || !/^https?:\/\//i.test(value.trim())) return null;
  try {
    const parsed = new URL(value.trim());
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) return null;
    return parsed.href;
  } catch { return null; }
}

const TICKET_FIELDS = ['ticketUrl','ticketProvider','priceFrom','priceTo','priceCurrency','availability','bookingRequired','ticketLastChecked'];
const AMTF = 'Australian Musical Theatre Festival';
const AMTF_OFFICIAL = 'https://www.amtf.org.au/';

// Fail closed on invalid imported URLs, never fabricate a ticket destination.
// A verified festival organiser site is preferred to a generic tourism listing.
export function repairImportedEventLinks(event) {
  const corrected = {...event};
  const current = absoluteEventUrl(corrected.eventUrl);
  const source = absoluteEventUrl(corrected.sourceUrl);
  let repaired = false;
  if (!current) {
    const reviewedFestival = corrected.name === AMTF
      && corrected.startDate === '2027-05-19'
      && corrected.endDate === '2027-05-23';
    const fallback = reviewedFestival ? AMTF_OFFICIAL : source;
    if (!fallback) return {event: corrected, valid: false, repaired: false};
    corrected.eventUrl = fallback;
    repaired = true;
  }
  if (corrected.ticketUrl && !absoluteEventUrl(corrected.ticketUrl)) {
    for (const field of TICKET_FIELDS) delete corrected[field];
    repaired = true;
  }
  return {event: corrected, valid: true, repaired};
}
