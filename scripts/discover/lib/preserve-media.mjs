// Keep licensed, identity-matched media through automated OSM refreshes.
// Do not use a photo merely because its filename resembles a place name.
const validWebUrl = (value) => {
  try { return ['https:', 'http:'].includes(new URL(value).protocol); }
  catch { return false; }
};
// Uploaded owner-approved local photos also survive OSM rediscovery. An arbitrary
// relative SVG or a stale link-only record must never be treated as verified media.
const approvedLocalUpload=(image)=>/^\/uploads\/admin\/[a-z0-9/_-]+\.(?:jpe?g|png|webp)$/i.test(image?.url||'') &&
  image?.useMode==='hosted' && image?.sourceMethod==='manual-reviewed' &&
  image?.rightsEvidence?.status==='owner-attested';
export const verifiedMedia = (image) =>
  Boolean(image && !image.isFallback && (validWebUrl(image.url) || approvedLocalUpload(image)) &&
    validWebUrl(image.sourceUrl) && String(image.license || '').trim() &&
    String(image.attribution || '').trim());

const imageKey = (image) => image?.sourceUrl || image?.url || '';

export function retainVerifiedMedia(place, previous) {
  if (!previous || previous.sourceType !== place.sourceType ||
      !place.sourceId || previous.sourceId !== place.sourceId) return place;
  // Never override existing real/manual imagery, even if older metadata is incomplete.
  const freshHero = Boolean(place.image && !place.image.isFallback);
  if (!freshHero && verifiedMedia(previous.image)) {
    place.image = structuredClone(previous.image);
  }
  const used = new Set([imageKey(place.image)].filter(Boolean));
  const gallery = [];
  for (const image of [...(place.gallery || []), ...(previous.gallery || [])]) {
    if (!verifiedMedia(image) || used.has(imageKey(image))) continue;
    used.add(imageKey(image));
    gallery.push(structuredClone(image));
    if (gallery.length >= 12) break;
  }
  if (gallery.length) place.gallery = gallery;
  return place;
}
