const clean = (value = '') => String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/\s+/g, ' ').trim();

function decoded(value) {
  const raw = String(value ?? '');
  try { return decodeURIComponent(raw); } catch { return raw; }
}

export function normaliseTelephone(value) {
  const result = clean(decoded(String(value ?? '').replace(/^tel:/i, '')));
  return result || null;
}


/** Extract one trustworthy Australian dial target from scraped phone text. */
export function australianTelHref(value) {
  const raw = normaliseTelephone(value);
  if (!raw) return null;
  const match = raw.match(/(?<!\d)(?:\+?61[\s().-]*0?[\s().-]*[23478]|0[23478])(?:[\s().-]*\d){8}/);
  if (match) {
    let digits = match[0].replace(/\D/g, '');
    if (digits.startsWith('610')) digits = '61' + digits.slice(3);
    else if (digits.startsWith('0')) digits = '61' + digits.slice(1);
    return /^61[23478]\d{8}$/.test(digits) ? 'tel:+' + digits : null;
  }
  const service = raw.match(/(?<!\d)(?:1[38]00(?:[\s().-]*\d){6}|13(?:[\s().-]*\d){4})(?!\d)/);
  return service ? 'tel:' + service[0].replace(/\D/g, '') : null;
}


/** Split multiple Australian phone contacts into independently diallable links. */
export function australianTelephoneEntries(value) {
  const raw = normaliseTelephone(value);
  if (!raw) return [];
  const contacts = [...raw.matchAll(/(?<!\d)(?:\+?61[\s().-]*0?[\s().-]*[23478]|0[23478])(?:[\s().-]*\d){8}/g)].map(m=>m[0]);
  if (!contacts.length) {
    const service = raw.match(/(?<!\d)(?:1[38]00(?:[\s().-]*\d){6}|13(?:[\s().-]*\d){4})(?!\d)/);
    if (service) contacts.push(service[0]);
  }
  return contacts.map(number=>({display:number.trim(),href:australianTelHref(number)})).filter(x=>x.href);
}

export function safeBookingUrl(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const expanded = decoded(raw);
  if (/[{}]/.test(expanded)) return null;
  if (/^(?:https?:\/\/)?(?:yes|no|true|false)\/?$/i.test(expanded)) return null;
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.')) return null;
    return url.href;
  } catch {
    return null;
  }
}

function firstSafeUrl(value) {
  if (!value) return null;
  if (typeof value === 'string') return safeBookingUrl(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstSafeUrl(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof value === 'object') {
    for (const key of ['url', 'target', 'sameAs']) {
      const found = firstSafeUrl(value[key]);
      if (found) return found;
    }
  }
  return null;
}

export function structuredBookingUrl(node = {}) {
  const explicit = firstSafeUrl(node.reservationUrl || node.bookingUrl || node.offers);
  if (explicit) return explicit;
  const actions = Array.isArray(node.potentialAction) ? node.potentialAction : [node.potentialAction];
  for (const action of actions) {
    const type = String(action?.['@type'] || '').split('/').pop().toLowerCase();
    if (!['reserveaction', 'orderaction', 'buyaction'].includes(type)) continue;
    const found = firstSafeUrl(action);
    if (found) return found;
  }
  return null;
}

const key = (value) => clean(value).toLowerCase().replace(/[^a-z0-9]/g, '');
const tas = (value) => /^tas(?:mania)?$/i.test(clean(value));

export function normaliseStructuredAddress(value) {
  if (!value) return null;
  if (typeof value === 'string') return clean(value) || null;
  const streetParts = clean(value.streetAddress).split(/\s*,\s*/).filter(Boolean);
  let locality = clean(value.addressLocality);
  let region = clean(value.addressRegion);
  const postcode = clean(value.postalCode);
  if (tas(locality) && streetParts.length > 1) locality = streetParts.pop();
  if (tas(locality)) locality = '';
  if (tas(region) || (region.toUpperCase() === 'CA' && /^7\d{3}$/.test(postcode))) region = 'TAS';
  const parts = [];
  for (const part of [...streetParts, locality, region, postcode]) {
    if (part && !parts.some((existing) => key(existing) === key(part))) parts.push(part);
  }
  return parts.join(', ') || null;
}

export function sanitiseListingFields(place) {
  const nextPhone = normaliseTelephone(place.phone);
  if (nextPhone) place.phone = nextPhone;
  if (place.bookingUrl) {
    const nextBooking = safeBookingUrl(place.bookingUrl);
    if (nextBooking) place.bookingUrl = nextBooking;
    else {
      delete place.bookingUrl;
      if (place.detailSources) delete place.detailSources.bookingUrl;
    }
  }
  return place;
}
