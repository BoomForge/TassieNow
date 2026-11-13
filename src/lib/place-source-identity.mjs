// Do not treat one shared word in a title as proof of a business identity.
export function oneTokenTitleIdentityMatches(placeName, pageTitle) {
  const normalise = (value) => String(value || '').normalize('NFKD')
    .replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const name = normalise(placeName);
  const title = ' '+normalise(pageTitle)+' ';
  return Boolean(name && title.includes(' '+name+' '));
}

// Independently observed wrong-entity enrichment: a Zeehan café had
// Tasman Peninsula walking-track details, contact number and Parks Tasmania URL.
// Hold this exact record out of public results until its identity can be verified.
export function quarantineTheKitchenSourceCollision(place) {
  if (place?.slug !== 'the-kitchen' || !/^zeehan$/i.test(String(place.town || ''))) return false;
  const sourceIdentity = place.sourceId === 'node/2532004100'
    || /^https?:\/\/(?:www\.)?openstreetmap\.org\/node\/2532004100\/?$/.test(String(place.sourceUrl || ''));
  const foreignDetails = /tasmans?\s+arch|devils?\s+kitchen\s+circuit/i.test(String(place.summary || ''))
    || /parks\.tas\.gov\.au/i.test(String(place.officialSource?.url || place.website || ''));
  if (!sourceIdentity || !foreignDetails || place.managedManually) return false;
  place.visibility = 'suppressed';
  place.qualityHold = 'Unverified cross-entity Parks Tasmania metadata; check original OSM business and operator identity before restoring.';
  return true;
}
