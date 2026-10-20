/**
 * Owner-reviewed listing facts may be used at render time before the full
 * catalogue enrichment job next runs. All other overrides stay pipeline-only.
 * This is deliberately limited to display fields, not status, rights or URLs.
 */
const DISPLAY_FIELDS = ['openingHours', 'phone', 'address', 'town'];

export function applyVerifiedPlaceDisplayOverrides(place, overrides) {
  const override = overrides?.[place.slug];
  if (!override || override.liveDisplayOverride !== true || place.managedManually) return place;
  const verified = Object.fromEntries(
    DISPLAY_FIELDS.filter((field) => typeof override[field] === 'string' && override[field].trim())
      .map((field) => [field, override[field]])
  );
  const licensedImage = override.image && override.image.isFallback === false &&
    override.image.sourceUrl?.startsWith('https://commons.wikimedia.org/wiki/File:') &&
    override.image.licenseUrl?.startsWith('https://creativecommons.org/licenses/by-sa/');
  const update = Object.keys(verified).length > 0 || override.removePhone === true ||
    override.removeOpeningHours === true || override.removeSchedule === true || override.overrideOfficialSource === true ||
    (licensedImage && place.image?.isFallback === true);
  if (!update) return place;
  const copy = { ...place, ...verified };
  // Trowunna's previous state-only breadcrumb can also carry the wrong region.
  // The reviewed correction is explicitly pinned to the operator's Mole Creek address.
  if (place.slug === 'trowunna-wildlife-park' && override.region === 'Launceston & North') {
    copy.region = override.region;
  }
  if (licensedImage && place.image?.isFallback === true) copy.image = structuredClone(override.image);
  if (override.removePhone === true) delete copy.phone;
  if (override.removeOpeningHours === true) delete copy.openingHours;
  if (override.removeSchedule === true) delete copy.schedule;
  if (override.overrideOfficialSource === true && override.officialSource?.url?.startsWith('https://')) {
    copy.officialSource = structuredClone(override.officialSource);
  }
  return copy;
}
