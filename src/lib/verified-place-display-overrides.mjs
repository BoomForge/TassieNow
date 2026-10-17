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
  const update = Object.keys(verified).length > 0 || override.removePhone === true ||
    override.removeOpeningHours === true || override.removeSchedule === true || override.overrideOfficialSource === true;
  if (!update) return place;
  const copy = { ...place, ...verified };
  if (override.removePhone === true) delete copy.phone;
  if (override.removeOpeningHours === true) delete copy.openingHours;
  if (override.removeSchedule === true) delete copy.schedule;
  if (override.overrideOfficialSource === true && override.officialSource?.url?.startsWith('https://')) {
    copy.officialSource = structuredClone(override.officialSource);
  }
  return copy;
}
