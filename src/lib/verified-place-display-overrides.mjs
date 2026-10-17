/**
 * Owner-reviewed listing facts may be used at render time before the full
 * catalogue enrichment job next runs. All other overrides stay pipeline-only.
 * This is deliberately limited to display fields, not status, rights or URLs.
 */
const DISPLAY_FIELDS = ['openingHours', 'phone', 'address'];

export function applyVerifiedPlaceDisplayOverrides(place, overrides) {
  const override = overrides?.[place.slug];
  if (!override || override.liveDisplayOverride !== true || place.managedManually) return place;
  const verified = Object.fromEntries(
    DISPLAY_FIELDS.filter((field) => typeof override[field] === 'string' && override[field].trim())
      .map((field) => [field, override[field]])
  );
  return Object.keys(verified).length ? { ...place, ...verified } : place;
}
