import { safeBookingUrl } from './listing-field-sanitizers.mjs';
import bookingQuarantine from '../data/booking-quarantine.json' with { type: 'json' };

export const suspectBookingSlugs = new Set(bookingQuarantine.slugs);
const HASTINGS_CAVE_PATH = /(?:^|\/)hastings[-_ ]caves?(?:[-_ ]state[-_ ]reserve)?(?:\/|\.|$)/i;

export function safePlaceBookingUrl(place) {
  if (!place || suspectBookingSlugs.has(place.slug)) return null;
  const result = safeBookingUrl(place.bookingUrl);
  if (!result) return null;
  const parsed = new URL(result);
  // A generic Parks Tasmania page must not become every park's ticket link.
  if (/(?:^|\.)parks\.tas\.gov\.au$/i.test(parsed.hostname)
    && HASTINGS_CAVE_PATH.test(decodeURIComponent(parsed.pathname))
    && !/hastings[-_ ]caves?/i.test(String(place.slug || ''))) return null;
  return result;
}
