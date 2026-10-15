const EAST_COAST_LOCALITIES = [
  'Little Swanport',
  'Binalong Bay',
  'St Helens',
  'Coles Bay',
  'Cranbrook',
  'Triabunna',
  'Scamander',
  'Swansea',
  'Bicheno',
  'Orford',
];

const escapeRegex = (value) => String(value).replace(/[.*+?^{}()|[\]\\]/g, '\\$&');

export function regionalCardLocation(text, {
  defaultTown,
  region,
  eventName = '',
} = {}) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  const town = EAST_COAST_LOCALITIES.find((candidate) =>
    new RegExp(`\\b${escapeRegex(candidate)}\\s*,?\\s*7\\d{3}\\b`, 'i').test(normalized)
  ) || defaultTown;

  if (!town) return { town: defaultTown, region };

  const localityMatch = normalized.match(
    new RegExp(`\\b${escapeRegex(town)}\\s*,?\\s*(7\\d{3})\\b`, 'i')
  );
  const localityIndex = localityMatch?.index ?? -1;
  const beforeLocality = localityIndex >= 0 ? normalized.slice(0, localityIndex).trim() : '';
  const addressMatch = beforeLocality.match(
    /(\d{1,5}\s+[^,]{2,80}?(?:Road|Rd|Street|St|Highway|Hwy|Drive|Dr|Lane|Ln))\s*,?\s*$/i
  );
  const postcode = localityMatch?.[1];
  const address = addressMatch
    ? `${addressMatch[1].trim()}, ${town}${postcode ? ` TAS ${postcode}` : ''}`
    : undefined;
  const venue = /\\bCraigie Knowe Vineyard\\b/i.test(eventName)
    ? 'Craigie Knowe Vineyard'
    : undefined;

  return { town, region, venue, address };
}
