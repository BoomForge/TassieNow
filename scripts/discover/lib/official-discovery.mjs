import { isMarketEvent } from '../../../src/lib/market-category.js';

export function clean(value = '') {
  return String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;|&#8217;/gi, "'")
    .replace(/&ndash;|&mdash;|&#8211;|&#8212;/gi, '-').replace(/\s+/g, ' ').trim();
}
export const keyName = value => clean(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[’']/g, '').replace(/\bmarkets\b/g, 'market').replace(/[^a-z0-9]+/g, ' ').trim();
export const slugify = value => keyName(value).replace(/ /g, '-');
const NAME_ALIASES = new Map([
  ['evandale market', 'evandale sunday market'],
  ['harvest market launceston', 'harvest launceston community farmers market'],
  ['salamanca market weekly', 'salamanca market'],
  ['willie smiths market', 'willie smiths artisan and produce market'],
  ['willie smiths artisan market', 'willie smiths artisan and produce market']
]);
export function canonical(value, base) {
  if (!value || typeof value !== 'string') return null;
  try {
    const url = new URL(value, base);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    url.hash = ''; for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid|gclid)/i.test(key)) url.searchParams.delete(key);
    return url.href.replace(/\/$/, '');
  } catch { return null; }
}
export function sameHost(a, b) {
  try { return new URL(a).hostname.replace(/^www\./, '') === new URL(b).hostname.replace(/^www\./, ''); } catch { return false; }
}
const blocked = /^(?:facebook|instagram|twitter|x|youtube|google|tiktok)\./i;
export function crawlable(url, source) {
  if (!canonical(url) || !sameHost(url, source.url)) return false;
  const u = new URL(url);
  return !blocked.test(u.hostname.replace(/^www\./, '')) && !/\.(?:pdf|jpg|png|zip|svg)$/i.test(u.pathname);
}
export function contentHtml(html) {
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || html;
  return main.replace(/<(?:nav|header|footer|script|style)\b[\s\S]*?<\/(?:nav|header|footer|script|style)>/gi, ' ');
}
function structured(html) {
  const out = [];
  function visit(item) {
    if (!item || typeof item !== 'object') return;
    if (Array.isArray(item)) { item.forEach(visit); return; }
    out.push(item);
    // ItemList, @graph and embedded entities use the same traversal.
    Object.values(item).forEach(value => { if (typeof value === 'object') visit(value); });
  }
  for (const script of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { visit(JSON.parse(script[1])); } catch { /* A malformed block does not discard other blocks. */ }
  }
  return out;
}
export function parseSchedule(value, url) {
  const text = clean(value), day = text.match(/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)s?\b/i)?.[1];
  if (!day) return null;
  const daysOfWeek = [day[0].toUpperCase() + day.slice(1).toLowerCase()];
  const base = { daysOfWeek, sourceUrl: url, notes: 'Confirm cancellations and special-date changes with the organiser.' };
  const monthly = text.match(/\b((?:(?:first|second|third|fourth|fifth|[1-5](?:st|nd|rd|th))(?:\s*(?:,|and|&)\s*)?)+)\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i);
  if (monthly && /\b(?:month|monthly)\b/i.test(text)) {
    const ordinal = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5 };
    const weeksOfMonth = [...monthly[1].matchAll(/first|second|third|fourth|fifth|[1-5](?:st|nd|rd|th)/gi)].map(m => ordinal[m[0].toLowerCase()] || Number(m[0][0]));
    // Ambiguous seasonal/exclusion prose needs review instead of invented future dates.
    if (/\b(?:except|excluding|season|september to april|summer|winter|until|from \d)\b/i.test(text)) return null;
    return { ...base, frequency: 'monthly', weeksOfMonth, summary: `${weeksOfMonth.map(n => ['','First','Second','Third','Fourth','Fifth'][n]).join(' and ')} ${daysOfWeek[0]} of each month. Check the source for times.` };
  }
  if (/\b(?:monthly|month|except|excluding|season|summer|winter)\b/i.test(text)) return null;
  if (new RegExp(`\\b(?:every|each)\\s+${daysOfWeek[0]}s?\\b|\\bweekly\\b`, 'i').test(text)) {
    return { ...base, frequency: 'weekly', summary: `Every ${daysOfWeek[0]}. Check the source for times.` };
  }
  return null;
}
export function extractCandidates(html, source, pageUrl = source.url) {
  const out = [], body = contentHtml(html);
  for (const item of structured(html)) {
    const types = [].concat(item['@type'] || []);
    if (!types.some(t => /^(?:Place|TouristAttraction|LocalBusiness|Store|Event|FoodEvent|SaleEvent)$/.test(t))) continue;
    const name = clean(item.name);
    if (!isMarketEvent(name) || name.length > 140) continue;
    const location = item.location && typeof item.location === 'object' ? item.location : item;
    const address = location.address || item.address || {};
    const geo = location.geo || item.geo || {};
    const url = canonical(item.url || item['@id'], pageUrl) || canonical(pageUrl);
    // Embedded publisher/footer schema is not evidence for the market being described.
    if (!sameHost(url, pageUrl)) continue;
    const description = clean(item.description);
    out.push({ name, url, town: clean(address.addressLocality), address: clean(address.streetAddress),
      latitude: geo.latitude == null ? null : Number(geo.latitude), longitude: geo.longitude == null ? null : Number(geo.longitude),
      country: typeof address.addressCountry === 'object' ? address.addressCountry.name : address.addressCountry,
      state: clean(address.addressRegion), schedule: parseSchedule(description, url),
      evidenceType: 'structured', event: types.some(t => /Event$/.test(t)), startDate: item.startDate || null, endDate: item.endDate || item.startDate || null });
  }
  if (source.headings && canonical(pageUrl) === canonical(source.url)) {
    const headings = [...body.matchAll(/<h([2-4])\b[^>]*>([\s\S]*?)<\/h\1>/gi)];
    for (let i = 0; i < headings.length; i++) {
      const h = headings[i], name = clean(h[2]);
      if (!isMarketEvent(name) || name.length > 110 || /\b(?:guide|around|within|finder|many|best|find|across|glance|please|organisers|notice|markets in|markets and)\b/i.test(name)) continue;
      const section = body.slice(h.index + h[0].length, headings[i + 1]?.index || body.length);
      const text = clean(section), location = section.match(/LOCATION:\s*(?:<\/strong>)?\s*([\s\S]*?)(?:<br|<\/p)/i)?.[1];
      const address = clean(location || '');
      const link = h[2].match(/href=["']([^"']+)["']/i)?.[1];
      const url = canonical(link, pageUrl) || canonical(pageUrl);
      out.push({ name, url, town: address.split(',').at(-1)?.trim() || '', address,
        schedule: parseSchedule(text, canonical(pageUrl)), evidenceType: 'directory-section',
        latitude: null, longitude: null, event: false });
    }
  }
  for (const match of body.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = canonical(match[1], pageUrl), name = clean(match[2].match(/<h[2-4]\b[^>]*>([\s\S]*?)<\/h[2-4]>/i)?.[1] || match[2]);
    if (!url || !isMarketEvent(name) || name.length < 5 || name.length > 140 || /^(?:markets?|market finder|read more|view all)/i.test(name) || /^(?:country|local|community|farmers|weekly) markets?$/i.test(name)) continue;
    out.push({ name, url, evidenceType: 'link', event: false, latitude: null, longitude: null });
  }
  if (source.parser === 'opencities') {
    const name = clean(body.match(/<h1\b[^>]*class=["'][^"']*oc-page-title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1]);
    const occurrences = [];
    for (const tag of body.matchAll(/<li\b[^>]*class=["'][^"']*multi-date-item[^"']*["'][^>]*>/gi)) {
      const attr = field => tag[0].match(new RegExp(`data-${field}=["']([^"']+)["']`, 'i'))?.[1];
      const date = side => [attr(`${side}-year`),attr(`${side}-month`),attr(`${side}-day`)].join('-');
      const time = side => [attr(`${side}-hour`),attr(`${side}-mins`)].join(':');
      occurrences.push({ startDate:date('start'), endDate:date('end'), startTime:time('start'), endTime:time('end') });
    }
    const location = body.match(/<h2\b[^>]*>\s*Location\s*<\/h2>([\s\S]*?)(?:<div|<h2)/i)?.[1] || '';
    const paragraphs = [...location.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)];
    const address = clean(paragraphs.find(p => /maps\.google\.com|View Map/i.test(p[1]))?.[1].replace(/<a\b[\s\S]*?<\/a>/gi,'') || '');
    const parts = address.split(',').map(clean).filter(Boolean), town = parts.at(-1)?.match(/^\d{4}$/) ? parts.at(-2) : parts.at(-1);
    const point = html.match(/"centerPoint"\s*:\s*"(-\d+\.\d+),(\d+\.\d+)"/);
    if (name && isMarketEvent(name) && occurrences.length && address && town && point) {
      out.unshift({ name, url:canonical(pageUrl), town, address, latitude:Number(point[1]), longitude:Number(point[2]),
        state:'Tasmania', country:'AU', event:true, occurrences, evidenceType:'council-calendar', schedule:null });
    }
  }
  return out;
}
export function matchPlace(candidate, places) {
  const rawName = keyName(candidate.name), name = NAME_ALIASES.get(rawName) || rawName, url = canonical(candidate.url);
  return places.find(p => {
    const nameMatches = keyName(p.name) === name;
    const townMatches = !candidate.town || keyName(p.town) === keyName(candidate.town);
    const urls = [p.website, p.officialSource?.url, p.sourceUrl].map(u => canonical(u));
    // Shared council indexes never identify a particular place; URL matches also require a similar name.
    const a = new Set(name.split(' ')), b = keyName(p.name).split(' ');
    const overlap = b.filter(t => a.has(t)).length / Math.max(a.size, b.length);
    const close = Number.isFinite(candidate.latitude) && Number.isFinite(candidate.longitude) &&
      Math.hypot(candidate.latitude - p.latitude, candidate.longitude - p.longitude) < .001;
    const distinct = b.some(t => a.has(t) && !['market','farmers','community','village','the','and'].includes(t));
    return townMatches && (nameMatches || (url && urls.includes(url) && overlap >= .6) || (close && distinct && overlap >= .6));
  });
}
export function publicationProblems(c, source) {
  const problems = [];
  if (c.evidenceType !== 'structured') problems.push('Needs structured venue/location verification');
  if (!['government','tourism','official-website'].includes(source.trust)) problems.push('Needs council, tourism or organiser confirmation');
  if (!c.town || !c.address) problems.push('Needs an exact town and venue address');
  if (!Number.isFinite(c.latitude) || c.latitude < -44 || c.latitude > -39 || !Number.isFinite(c.longitude) || c.longitude < 143 || c.longitude > 149) problems.push('Needs verified Tasmanian venue coordinates');
  if (c.country && !/^(?:au|australia)$/i.test(c.country)) problems.push('Country is not Australia');
  if (c.state && !/^(?:tas|tasmania)$/i.test(c.state)) problems.push('State is not Tasmania');
  if (!c.schedule) problems.push('Needs an unambiguous recurring schedule; dated markets stay in event discovery');
  if (c.event) problems.push('Dated event needs review before becoming a permanent market listing');
  if (!canonical(c.url) || !sameHost(c.url, source.url)) problems.push('Needs a verified source detail URL');
  return problems;
}
export function makePlace(c, source, today, region) {
  return { slug: slugify(`${c.name}-${c.town}`), name: c.name, town: c.town, region,
    latitude: c.latitude, longitude: c.longitude, categories: ['Markets'],
    summary: `${c.name} is a market in ${c.town}. ${c.schedule.summary}`,
    address: c.address, website: c.url, sourceUrl: c.url, sourceType: 'official-discovery',
    officialSource: { name: source.name, url: c.url, type: source.trust === 'government' ? 'government' : 'official-website' },
    schedule: c.schedule, status: 'active', lastChecked: today,
    discovery: { sourceId: source.id, verifiedAt: today, method: 'structured-source' },
    detailSources: { schedule: { type: 'official-discovery', url: c.url, checkedAt: today } },
    image: { url: '/images/categories/markets.svg', alt: `${c.name} market illustration`, attribution: 'TassieNow', license: 'TassieNow original artwork', isFallback: true } };
}
export async function discover({ sources, places, events = [], previous = [], reviews = {}, fetchPage, now = new Date(), maxDetails = 42, maxRuntimeMs = 300000 }) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Hobart' }).format(now);
  const candidates = new Map(previous.map(c => [c.id, c]));
  const report = { checkedAt: now.toISOString(), added: [], addedEvents: [], correctedEvents: [], updated: [], sources: [], totals: {} };
  let details = 0;
  const started = Date.now();
  for (const source of sources) {
    const health = { id: source.id, name: source.name, url: source.url, pagesFetched: 0, candidatesFound: 0, errors: [] };
    report.sources.push(health);
    const visit = async url => {
      if (Date.now() - started > maxRuntimeMs) { health.errors.push({ url, message: 'Run time budget reached; retry next scheduled scan' }); return []; }
      try {
        const html = await fetchPage(url, source); health.pagesFetched++;
        return extractCandidates(html, source, url);
      } catch (e) { health.errors.push({ url, message: String(e.message).slice(0, 180) }); return []; }
    };
    let found = await visit(source.url);
    if (health.pagesFetched && !found.length) health.errors.push({ url: source.url, message: 'No market candidates parsed; source may need a parser update or browser rendering' });
    const links = [...new Set(found.map(c => c.url).filter(u => crawlable(u, source) && canonical(u) !== canonical(source.url)))].sort();
    // Rotate a bounded detail-page budget, rather than fetching only the first page forever.
    const offset = links.length ? Math.floor(now.getTime() / 86400000) * 6 % links.length : 0;
    const rotated = links.slice(offset).concat(links.slice(0, offset));
    for (const url of rotated.slice(0, Math.min(6, maxDetails - details))) {
      if (Date.now() - started > maxRuntimeMs) break;
      details++; found.push(...await visit(url));
    }
    health.candidatesFound = found.length;
    // Structured evidence replaces the less complete link/heading evidence on this run.
    const strength = c => ({'council-calendar':0,structured:1,'directory-section':2,link:3}[c.evidenceType] ?? 4);
    found.sort((a,b) => strength(a)-strength(b));
    const seen = new Set();
    for (const c of found) {
      const id = `${source.id}:${slugify(c.name)}`;
      if (seen.has(id)) continue; seen.add(id);
      const review = reviews[id];
      const old = candidates.get(id), match = (review?.placeSlug && places.find(p=>p.slug===review.placeSlug)) || matchPlace(c, places);
      const reasons = publicationProblems(c, source);
      if (review?.reason) reasons.unshift(review.reason);
      let status = match ? 'existing' : 'review', placeSlug = match?.slug;
      const region = source.region || places.find(p => keyName(p.town) === keyName(c.town))?.region;
      if (c.evidenceType === 'council-calendar' && source.trust === 'government' && region &&
          c.latitude >= -44 && c.latitude <= -39 && c.longitude >= 143 && c.longitude <= 149) {
        const valid = c.occurrences.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d.startDate) && /^\d{4}-\d{2}-\d{2}$/.test(d.endDate) &&
          Number.isFinite(Date.parse(d.startDate)) && new Date(d.startDate).toISOString().slice(0,10) === d.startDate &&
          Number.isFinite(Date.parse(d.endDate)) && new Date(d.endDate).toISOString().slice(0,10) === d.endDate &&
          d.endDate >= today && d.endDate === d.startDate && Date.parse(d.startDate)-now.getTime() < 366*86400000);
        const eventSlugs = [];
        // Exact council sessions outrank dates guessed by the general index feed.
        // Keep the old record for provenance; a failed fetch never reaches this branch.
        if (valid.length) for (const e of events) {
          if (e.status === 'active' && !e.managedManually && e.endDate >= today && keyName(e.name) === keyName(c.name) &&
              canonical(e.eventUrl || e.sourceUrl) === canonical(c.url) && !valid.some(d=>d.startDate===e.startDate)) {
            e.status='superseded'; e.lastChecked=today;
            e.correction={sourceUrl:c.url,reason:'Date absent from the verified council session calendar',checkedAt:today};
            report.correctedEvents.push(e.slug);
          }
        }
        for (const d of valid) {
          const existing = events.find(e => keyName(e.name) === keyName(c.name) && e.startDate === d.startDate && keyName(e.town) === keyName(c.town));
          if (existing) { eventSlugs.push(existing.slug); continue; }
          const event = { slug:slugify(`${c.name}-${d.startDate}-${c.town}`),name:c.name,town:c.town,region,
            startDate:d.startDate,endDate:d.endDate,categories:['Events','Markets'],venue:c.address,
            summary:`${c.name} in ${c.town}. The council lists this session for ${d.startDate}; check the source for changes.`,
            eventUrl:c.url,sourceUrl:c.url,sourceName:source.name,status:'active',lastChecked:today,
            discovery:{sourceId:source.id,method:'council-calendar',verifiedAt:today},
            image:{url:'/images/categories/markets.svg',alt:`${c.name} market illustration`,attribution:'TassieNow',license:'Site artwork',isFallback:true} };
          if (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(d.startTime)) event.startTime=d.startTime;
          if (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(d.endTime)) event.endTime=d.endTime;
          if (!events.some(e=>e.slug===event.slug)) { events.push(event); eventSlugs.push(event.slug); report.addedEvents.push(event.slug); }
        }
        if (eventSlugs.length) { status='event'; c.eventSlugs=eventSlugs; }
      }
      if (match?.discovery?.sourceId === source.id && !match.managedManually && reasons.length === 0 && region) {
        const fresh = makePlace(c, source, today, region);
        // Refresh only source-owned details; preserve ranking, licensed images and manual edits.
        for (const field of ['address','latitude','longitude','region','schedule','lastChecked','discovery']) match[field] = fresh[field];
        match.detailSources ||= {};
        match.detailSources.schedule = fresh.detailSources.schedule;
        report.updated.push(match.slug);
      }
      if (!match && !region) reasons.push('Needs a verified region');
      if (!match && reasons.length === 0) {
        const place = makePlace(c, source, today, region);
        if (places.some(p => p.slug === place.slug)) reasons.push('Slug collision needs review');
        else { places.push(place); status = 'published'; placeSlug = place.slug; report.added.push(place.slug); }
      }
      candidates.set(id, { ...c, id, sourceId: source.id, sourceName: source.name, sourceUrl: source.url,
        firstSeen: old?.firstSeen || today, lastSeen: today, status, placeSlug: placeSlug || null,
        reasons: status === 'review' ? reasons : [] });
      if (review) candidates.get(id).review = review;
    }
  }
  const queue = [...candidates.values()].sort((a,b) => a.id.localeCompare(b.id));
  report.totals = { discovered: queue.length, review: queue.filter(c => c.status === 'review').length,
    existing: queue.filter(c => c.status === 'existing').length, added: report.added.length,
    events:queue.filter(c=>c.status==='event').length, addedEvents:report.addedEvents.length,
    updated: report.updated.length, failedSources: report.sources.filter(s => s.errors.length).length };
  return { places, events, candidates: queue, report };
}
