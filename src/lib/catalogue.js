export function slugify(value) {
  return String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function imageFor(item, fallback = '/images/categories/discover.svg') {
  return item?.image?.url || fallback;
}

export function formatEventDate(date) {
  if (!date) return '';
  return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Australia/Hobart' }).format(new Date(`${date}T12:00:00Z`));
}

export const collections = {
  kids: { title: 'Tasmania with kids', description: 'Family-friendly Tasmanian places and activities.', category: 'Family' },
  free: { title: 'Free things to do', description: 'Discover Tasmanian places and activities marked as free.', category: 'Free' },
  'rainy-day': { title: 'Rainy day Tasmania', description: 'Indoor and weather-friendly ideas for when Tasmania turns wet.', category: 'Rainy Day' },
  today: { title: 'What’s on today', description: 'Current Tasmanian events happening today.', events: 'today' },
  'this-weekend': { title: 'What’s on this weekend', description: 'Tasmanian events happening this coming or current weekend.', events: 'weekend' }
};
