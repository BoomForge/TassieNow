const includesAny = (value, names) => names.some((name) => value.includes(name));

const CENTRAL_TOWNS = [
  'bothwell', 'hamilton', 'ouse', 'ellendale', 'fentonbury', 'gretna',
  'miena', 'liawenee', 'interlaken', 'tarraleah', 'waddamana',
  'bronte park', 'derwent bridge', 'lake st clair', 'arthurs lake',
  'great lake', 'central plateau', 'oatlands', 'kempton', 'jericho',
  'colebrook', 'tunbridge', 'ross', 'campbell town'
];

export function regionFor(lat, lon, town = '') {
  const t = String(town || '').toLowerCase();

  if (includesAny(t, ['currie', 'grassy', 'naracoopa', 'king island']) || lon < 144.35) return 'King Island';
  if (includesAny(t, ['whitemark', 'lady barron', 'flinders island']) || (lat > -40.8 && lon > 147.55)) return 'Flinders Island';
  if (includesAny(t, ['queenstown', 'strahan', 'zeehan', 'rosebery', 'tullah']) || (lon < 145.65 && lat < -41.4)) return 'West Coast';

  if (includesAny(t, CENTRAL_TOWNS)) return 'Central Tasmania';

  if (includesAny(t, ['stanley', 'smithton', 'burnie', 'wynyard', 'penguin', 'ulverstone', 'devonport', 'latrobe', 'sheffield', 'cradle mountain'])) return 'North West';
  if (includesAny(t, ['launceston', 'george town', 'deloraine', 'longford', 'evandale', 'scottsdale', 'derby', 'bridport', 'beaconsfield', 'westbury', 'mole creek'])) return 'Launceston & North';
  if (includesAny(t, ['st helens', 'bicheno', 'swansea', 'coles bay', 'orford', 'triabunna', 'scamander', 'binalong bay'])) return 'East Coast';
  if (includesAny(t, ['hobart', 'richmond', 'sorell', 'huon', 'cygnet', 'geeveston', 'dover', 'port arthur', 'new norfolk', 'bruny', 'kingston'])) return 'Hobart & South';

  // The previous broad north/south coordinate split swallowed almost the whole
  // Midlands and Central Highlands. Keep a conservative central corridor before
  // the broader regional fallbacks, while town-name rules above resolve borders.
  if (lat >= -42.65 && lat <= -41.65 && lon >= 145.95 && lon < 147.65) return 'Central Tasmania';
  if (lat > -42.05 && lon < 146.65) return 'North West';
  if (lat > -42.05 && lon >= 146.65 && lon < 148) return 'Launceston & North';
  if (lon >= 147.75 && lat <= -40.8 && lat > -43.25) return 'East Coast';
  if (lat <= -42.05) return 'Hobart & South';

  return 'Central Tasmania';
}
