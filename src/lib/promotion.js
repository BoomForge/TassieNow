const DISCOVERY = {
  kids: {
    title: 'Things to do with kids in Tasmania',
    summary: 'Family-friendly places and activities across Tasmania, from easy outdoor adventures to museums, wildlife and rainy-day ideas.',
    path: '/discover/kids/',
    image: '/images/categories/family.svg'
  },
  free: {
    title: 'Free things to do in Tasmania',
    summary: 'Good Tasmanian days out that do not need to cost anything.',
    path: '/discover/free/',
    image: '/images/categories/discover.svg'
  },
  'rainy-day': {
    title: 'Rainy day activities in Tasmania',
    summary: 'Indoor and weather-friendly ideas for the days when Tasmania does what Tasmania does.',
    path: '/discover/rainy-day/',
    image: '/images/categories/indoor.svg'
  },
  markets: {
    title: 'Markets in Tasmania',
    summary: 'Local produce, makers and community markets around Tasmania.',
    path: '/discover/markets/',
    image: '/images/categories/markets.svg'
  },
  nature: {
    title: 'Walks and nature in Tasmania',
    summary: 'Trails, lookouts, beaches, reserves and wild places worth getting outside for.',
    path: '/discover/nature/',
    image: '/images/categories/nature.svg'
  },
  food: {
    title: 'Tasmanian food and local produce',
    summary: 'Local flavours, farms, makers, produce and food stops worth building into a Tasmanian day out.',
    path: '/discover/food/',
    image: '/images/categories/food.svg'
  },
  today: {
    title: 'What’s on in Tasmania today',
    summary: 'Current events happening around Tasmania today, refreshed automatically from official and public sources.',
    path: '/discover/today/',
    image: '/images/categories/events.svg'
  },
  'this-weekend': {
    title: 'What’s on in Tasmania this weekend',
    summary: 'Current events around Tasmania this weekend without digging through separate calendars.',
    path: '/discover/this-weekend/',
    image: '/images/categories/events.svg'
  }
};

export function tasDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Hobart',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function hash(value) {
  let output = 2166136261;
  for (const char of String(value)) {
    output ^= char.codePointAt(0);
    output = Math.imul(output, 16777619);
  }
  return output >>> 0;
}

function pick(items, key) {
  if (!items.length) return null;
  return items[hash(key) % items.length];
}

function trim(value, max = 180) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function absolute(base, value) {
  return new URL(value, `${String(base).replace(/\/$/, '')}/`).href;
}

function discoveryPromotion(slug, date, base) {
  const item = DISCOVERY[slug];
  return {
    id: `discovery:${slug}:${date}`,
    date,
    type: 'discovery',
    title: item.title,
    summary: item.summary,
    socialText: trim(item.title, 250),
    url: absolute(base, item.path),
    imageUrl: absolute(base, item.image)
  };
}

function placePromotion(place, date, base) {
  const location = [place.town, place.region].filter(Boolean).join(' · ');
  return {
    id: `place:${place.slug}:${date}`,
    date,
    type: 'place',
    title: place.name,
    summary: trim(place.summary || `Discover ${place.name} in ${location || 'Tasmania'}.`, 190),
    socialText: trim(`TassieNow pick: ${place.name}${place.town ? ` in ${place.town}` : ''}. ${place.summary || ''}`, 270),
    url: absolute(base, `/place/${place.slug}/`),
    imageUrl: absolute(base, place.image?.url || '/images/categories/discover.svg')
  };
}

function eventPromotion(event, date, base) {
  return {
    id: `event:${event.slug}:${date}`,
    date,
    type: 'event',
    title: event.name,
    summary: trim(event.summary || `A current Tasmanian event in ${event.town || event.region || 'Tasmania'}.`, 190),
    socialText: trim(`${event.name}${event.town ? ` · ${event.town}` : ''}. ${event.summary || ''}`, 270),
    url: absolute(base, `/event/${event.slug}/`),
    imageUrl: absolute(base, event.image?.url || '/images/categories/events.svg')
  };
}

export function getDailyPromotion({ places = [], events = [], date = new Date(), base = 'https://tassienow.com' } = {}) {
  const today = tasDate(date);
  const calendar = new Date(`${today}T12:00:00Z`);
  const weekday = calendar.getUTCDay();
  const week = Math.floor(calendar.getTime() / 604800000);

  const activePlaces = places
    .filter((place) => place.status === 'active' && place.visibility !== 'suppressed')
    .sort((a, b) =>
      Number(Boolean(b.featured)) - Number(Boolean(a.featured)) ||
      Number(Boolean(a.image?.isFallback)) - Number(Boolean(b.image?.isFallback)) ||
      (b.qualityScore || 0) - (a.qualityScore || 0) ||
      String(a.name || '').localeCompare(String(b.name || ''))
    );

  const activeEvents = events
    .filter((event) => event.status === 'active' && event.endDate >= today)
    .sort((a, b) =>
      String(a.startDate || '').localeCompare(String(b.startDate || '')) ||
      Number(Boolean(a.image?.isFallback)) - Number(Boolean(b.image?.isFallback)) ||
      String(a.name || '').localeCompare(String(b.name || ''))
    );

  if (weekday === 2 && activePlaces.length) {
    const visualPool = activePlaces.filter((place) => !place.image?.isFallback).slice(0, 250);
    return placePromotion(pick(visualPool.length ? visualPool : activePlaces.slice(0, 250), today), today, base);
  }

  if (weekday === 4 && activeEvents.length) {
    const soon = activeEvents.slice(0, 20);
    const visualSoon = soon.filter((event) => !event.image?.isFallback);
    return eventPromotion(pick(visualSoon.length ? visualSoon : soon, today), today, base);
  }

  if (weekday === 3 || weekday === 5) {
    return discoveryPromotion('this-weekend', today, base);
  }

  if (weekday === 6) {
    return discoveryPromotion('today', today, base);
  }

  if (weekday === 0) {
    const sundayModes = ['kids', 'nature', 'food'];
    return discoveryPromotion(sundayModes[week % sundayModes.length], today, base);
  }

  const mondayModes = ['free', 'rainy-day', 'markets', 'nature'];
  return discoveryPromotion(mondayModes[week % mondayModes.length], today, base);
}

export function addCampaignParams(url, {
  source = 'promotion',
  medium = 'syndication',
  campaign = 'daily-promotion',
  content
} = {}) {
  const target = new URL(url);
  target.searchParams.set('utm_source', source);
  target.searchParams.set('utm_medium', medium);
  target.searchParams.set('utm_campaign', campaign);
  if (content) target.searchParams.set('utm_content', content);
  return target.href;
}
