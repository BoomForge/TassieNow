import fs from 'node:fs/promises';

const FILE = new URL('../src/data/places.json', import.meta.url);
const OVERRIDES_FILE = new URL('../src/data/place-overrides.json', import.meta.url);
const USER_AGENT = 'TassieNow/1.2 (+https://tassienow.com)';
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Hobart' }).format(new Date());
const CONCURRENCY = 6;
const TIMEOUT = 8500;
const MAX_CHILD_PAGES = 4;

const clean = (value = '') => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&ndash;|&mdash;/gi, '-')
  .replace(/\s+/g, ' ')
  .trim();
const normalizeName = (value = '') => clean(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const tokens = (value = '') => normalizeName(value).split(' ').filter((token) => token.length > 2 && !['the', 'and', 'tasmania', 'tasmanian', 'park', 'reserve'].includes(token));

function httpUrl(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(candidate);
    return ['http:', 'https:'].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}
function sameHost(a, b) {
  try { return new URL(a).hostname.replace(/^www\./, '') === new URL(b).hostname.replace(/^www\./, ''); } catch { return false; }
}
function canFetch(value) {
  const url = httpUrl(value);
  if (!url) return null;
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (/^(facebook|instagram|google|tripadvisor|openstreetmap|wikipedia|wikidata)\./i.test(host)) return null;
    return url;
  } catch {
    return null;
  }
}
function pageText(html = '') {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<(?:br|\/p|\/div|\/li|\/section|\/h[1-6]|\/tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&ndash;|&mdash;/gi, '-')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}
function titleText(html = '') {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '';
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '';
  return clean(`${title} ${h1}`.replace(/<[^>]+>/g, ' '));
}
function pageMatches(place, html) {
  const hay = tokens(titleText(html));
  const wanted = tokens(place.name);
  if (!wanted.length || !hay.length) return false;
  const set = new Set(hay);
  const overlap = wanted.filter((token) => set.has(token)).length;
  return overlap >= Math.max(1, Math.ceil(wanted.length * 0.45));
}
function linkScore(label = '', href = '') {
  const text = normalizeName(`${label} ${href}`);
  let score = 0;
  const rules = [
    [/opening|hours|times/, 10],
    [/market dates|dates|calendar|when/, 10],
    [/plan your visit|visit|visitor/, 9],
    [/contact|find us|location|getting here/, 8],
    [/tickets|admission|entry|book/, 6],
    [/accessibility|access/, 5],
    [/about/, 3]
  ];
  for (const [pattern, points] of rules) if (pattern.test(text)) score += points;
  if (/privacy|terms|login|sign in|news|media|careers|jobs|facebook|instagram/.test(text)) score -= 20;
  return score;
}
function candidateLinks(html, baseUrl) {
  const links = [];
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(re)) {
    const label = clean(match[2].replace(/<[^>]+>/g, ' '));
    try {
      const url = new URL(match[1], baseUrl);
      url.hash = '';
      if (!['http:', 'https:'].includes(url.protocol) || !sameHost(url.href, baseUrl)) continue;
      const score = linkScore(label, url.pathname);
      if (score > 0) links.push({ url: url.href, score });
    } catch { /* ignore malformed href */ }
  }
  return [...new Map(links.sort((a, b) => b.score - a.score).map((item) => [item.url, item])).values()].slice(0, MAX_CHILD_PAGES);
}
async function fetchHtml(url) {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml' },
    signal: AbortSignal.timeout(TIMEOUT)
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const type = response.headers.get('content-type') || '';
  const html = await response.text();
  if (!/html/i.test(type) && !/<html/i.test(html.slice(0, 1200))) throw new Error('not HTML');
  return { html: html.slice(0, 2_500_000), url: response.url || url };
}

function flattenLd(value, out = []) {
  if (Array.isArray(value)) { for (const item of value) flattenLd(item, out); return out; }
  if (!value || typeof value !== 'object') return out;
  out.push(value);
  if (value['@graph']) flattenLd(value['@graph'], out);
  return out;
}
function parseLdJson(html = '') {
  const nodes = [];
  const re = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(re)) {
    const raw = match[1].trim().replace(/^<!--|-->$/g, '').trim();
    if (!raw) continue;
    try { flattenLd(JSON.parse(raw), nodes); } catch { /* malformed publisher JSON-LD */ }
  }
  return nodes;
}
function tokenOverlap(a = '', b = '') {
  const aa = new Set(tokens(a)), bb = new Set(tokens(b));
  let hits = 0; for (const token of aa) if (bb.has(token)) hits++;
  return hits;
}
function bestLdNode(nodes, place) {
  const useful = nodes.filter((node) => node && (node.openingHours || node.openingHoursSpecification || node.telephone || node.email || node.address || node.reservationUrl || node.offers || node.potentialAction));
  const scored = useful.map((node) => ({ node, overlap: tokenOverlap(node.name || node.headline || '', place.name), named: Boolean(clean(node.name || node.headline)) })).sort((a, b) => b.overlap - a.overlap);
  const best = scored[0];
  if (!best) return null;
  if (best.named && best.overlap === 0) return null;
  if (!best.named && useful.length > 1) return null;
  return best.node;
}
function addressFromLd(value) {
  if (!value) return null;
  if (typeof value === 'string') return clean(value) || null;
  const parts = [value.streetAddress, value.addressLocality, value.addressRegion, value.postalCode].map(clean).filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}
function hoursFromSpecification(spec) {
  const rows = Array.isArray(spec) ? spec : spec ? [spec] : [];
  return rows.map((row) => {
    const days = (Array.isArray(row.dayOfWeek) ? row.dayOfWeek : row.dayOfWeek ? [row.dayOfWeek] : []).map((day) => {
      const value = String(day || '').split('/').pop();
      return DAY_MAP[String(value).toLowerCase()]?.[1] || value;
    }).filter(Boolean).join(',');
    const opens = normalizeTime(row.opens) || clean(row.opens);
    const closes = normalizeTime(row.closes) || clean(row.closes);
    return [days, opens && closes ? `${opens}-${closes}` : opens || closes].filter(Boolean).join(' ');
  }).filter(Boolean).join('; ') || null;
}
function firstHttpFrom(value) {
  if (!value) return null;
  if (typeof value === 'string') return httpUrl(value);
  if (Array.isArray(value)) { for (const item of value) { const found = firstHttpFrom(item); if (found) return found; } return null; }
  if (typeof value === 'object') {
    for (const key of ['url','urlTemplate','target','sameAs']) { const found = firstHttpFrom(value[key]); if (found) return found; }
  }
  return null;
}
function structuredFields(node = {}) {
  const openingRaw = Array.isArray(node.openingHours) ? node.openingHours.map(clean).filter(Boolean).join('; ') : clean(node.openingHours);
  const bookingUrl = firstHttpFrom(node.reservationUrl || node.bookingUrl || node.potentialAction || node.offers);
  const operator = clean(node.provider?.name || node.organizer?.name || node.brand?.name || (typeof node.provider === 'string' ? node.provider : ''));
  return {
    openingHours: openingRaw || hoursFromSpecification(node.openingHoursSpecification),
    phone: clean(node.telephone) || null,
    email: clean(node.email) || null,
    address: addressFromLd(node.address),
    bookingUrl,
    operator: operator || null
  };
}
const BOOKING_HOST = /(?:^|\.)(?:rezdy\.com|fareharbor\.com|humanitix\.com|eventbrite\.(?:com|com\.au)|ticketek\.com\.au|ticketmaster\.com\.au|trybooking\.com|bookeasy\.com|checkfront\.com|roller\.app)$/i;
function bookingLink(html = '', baseUrl = '') {
  const found = [];
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(re)) {
    const label = clean(match[2].replace(/<[^>]+>/g, ' '));
    const hint = normalizeName(`${label} ${match[1]}`);
    if (!/\b(book|booking|tickets?|admission|reserve|reservation)\b/.test(hint) || /login|sign in|staff/.test(hint)) continue;
    try {
      const u = new URL(match[1], baseUrl);
      const host = u.hostname.replace(/^www\./, '');
      if (!['http:','https:'].includes(u.protocol) || (!sameHost(u.href, baseUrl) && !BOOKING_HOST.test(host))) continue;
      let score = 0;
      if (/\bbook(?: now)?\b|\btickets?\b/.test(hint)) score += 10;
      if (BOOKING_HOST.test(host)) score += 5;
      if (sameHost(u.href, baseUrl)) score += 2;
      found.push({ url: u.href, score });
    } catch { /* malformed booking link */ }
  }
  return found.sort((a, b) => b.score - a.score)[0]?.url || null;
}
function dayKeysFromLine(lower = '') {
  const keys = Object.keys(DAY_MAP);
  if (/\b(?:daily|every day|seven days|7 days)\b/i.test(lower)) return keys;
  const range = lower.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b\s*(?:-|–|—|to|through|thru)\s*\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
  if (range) {
    const a = keys.indexOf(range[1].toLowerCase()), b = keys.indexOf(range[2].toLowerCase());
    if (a >= 0 && b >= 0) {
      const out = []; let i = a;
      while (true) { out.push(keys[i]); if (i === b || out.length === 7) break; i = (i + 1) % 7; }
      return out;
    }
  }
  return keys.filter((day) => new RegExp(`\\b${day}\\b`, 'i').test(lower));
}
function openingHoursFromText(text = '') {
  const lines = text.split(/\n|(?<=[.!?])\s+/).map(clean).filter((line) => line.length >= 8 && line.length <= 260);
  const rows = [];
  for (const line of lines) {
    if (/administration|office hours|phone hours|customer service|support hours/i.test(line)) continue;
    const lower = line.toLowerCase();
    const days = dayKeysFromLine(lower);
    const times = [...line.matchAll(/\b((?:[01]?\d|2[0-3]):[0-5]\d|\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/gi)].map((match) => normalizeTime(match[1])).filter(Boolean);
    if (times.length < 2) continue;
    if (!days.length && !/\bopen(?:ing)?\b|\bhours\b/i.test(line)) continue;
    const actualDays = days.length ? days : Object.keys(DAY_MAP);
    const codes = actualDays.map((day) => DAY_MAP[day][1]);
    const dayText = codes.length === 7 ? 'Mo-Su' : codes.join(',');
    rows.push(`${dayText} ${times[0]}-${times[1]}`);
  }
  return [...new Set(rows)].slice(0, 7).join('; ') || null;
}

function extractEmail(html = '', text = '') {
  const mailto = html.match(/href=["']mailto:([^"'?]+)[^"']*["']/i)?.[1];
  if (mailto && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mailto)) return clean(mailto);
  const found = text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0];
  return found || null;
}
function extractPhone(html = '', text = '') {
  const tel = html.match(/href=["']tel:([^"']+)["']/i)?.[1];
  if (tel) return clean(tel.replace(/^tel:/i, ''));
  const candidates = text.match(/(?:\+61\s?[2-478]|0[2-478])(?:[\s.-]?\d){8}|1[38]00(?:[\s.-]?\d){6}|04(?:[\s.-]?\d){8}/g) || [];
  return candidates.length ? clean(candidates[0]) : null;
}
function normalizeTime(raw) {
  const match = String(raw || '').trim().toLowerCase().replace('.', ':').match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const suffix = match[3];
  if (suffix === 'pm' && hour < 12) hour += 12;
  if (suffix === 'am' && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
const DAY_MAP = { monday: ['Monday', 'Mo'], tuesday: ['Tuesday', 'Tu'], wednesday: ['Wednesday', 'We'], thursday: ['Thursday', 'Th'], friday: ['Friday', 'Fr'], saturday: ['Saturday', 'Sa'], sunday: ['Sunday', 'Su'] };
function scheduleFromText(text = '', sourceUrl) {
  const lines = text.split(/\n|(?<=[.!?])\s+/).map(clean).filter((line) => line.length >= 12 && line.length <= 320);
  const scored = [];
  for (const line of lines) {
    const lower = line.toLowerCase();
    const dayKeys = dayKeysFromLine(lower);
    const recurrence = /\b(every|each|weekly|daily|every day|seven days|7 days)\b/i.test(line);
    const timeMatches = [...line.matchAll(/\b(\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm))\b/gi)].map((match) => match[1]);
    if (!dayKeys.length && !recurrence) continue;
    if (!timeMatches.length && !/market dates|held every|runs every|open every/i.test(line)) continue;
    let score = 0;
    if (recurrence) score += 8;
    if (/\b(open|opening|held|operates|runs|market)\b/i.test(line)) score += 7;
    score += Math.min(4, dayKeys.length * 2);
    if (timeMatches.length >= 2) score += 5;
    if (/administration|office hours|phone hours|customer service/i.test(line)) score -= 10;
    scored.push({ line, lower, dayKeys, timeMatches, score });
  }
  const best = scored.sort((a, b) => b.score - a.score)[0];
  if (!best || best.score < 10) return null;
  const daysOfWeek = best.dayKeys.map((day) => DAY_MAP[day][0]);
  const startTime = normalizeTime(best.timeMatches[0]);
  const endTime = normalizeTime(best.timeMatches[1]);
  let frequency = null;
  if (/daily|every day|seven days|7 days/i.test(best.line)) frequency = 'daily';
  else if (/every|each|weekly/i.test(best.line) && daysOfWeek.length) frequency = 'weekly';
  const result = { summary: best.line, sourceUrl };
  if (frequency) result.frequency = frequency;
  if (daysOfWeek.length) result.daysOfWeek = daysOfWeek;
  if (startTime) result.startTime = startTime;
  if (endTime) result.endTime = endTime;
  return result;
}
function openingHoursFromSchedule(schedule) {
  if (!schedule?.startTime || !schedule?.endTime) return null;
  if (schedule.frequency === 'daily') return `Mo-Su ${schedule.startTime}-${schedule.endTime}`;
  const codes = (schedule.daysOfWeek || []).map((day) => DAY_MAP[String(day).toLowerCase()]?.[1]).filter(Boolean);
  return codes.length ? `${codes.join(',')} ${schedule.startTime}-${schedule.endTime}` : null;
}
function exceptionNote(text = '') {
  const lines = text.split(/\n|(?<=[.!?])\s+/).map(clean).filter((line) => line.length >= 15 && line.length <= 360);
  const found = lines.find((line) => /\b(exception|except|christmas|anzac|public holiday|holiday hours|special hours|closed on)\b/i.test(line));
  return found || null;
}
function source(type, url) { return { type, url, checkedAt: TODAY }; }
function applyField(place, key, value, srcUrl) {
  if (value == null || value === '') return false;
  if (place.managedManually && place[key]) return false;
  const existingType = place.detailSources?.[key]?.type;
  if (existingType === 'manual') return false;
  if (place[key] === value && existingType === 'official-website') return false;
  place[key] = value;
  place.detailSources ||= {};
  place.detailSources[key] = source('official-website', srcUrl);
  return true;
}
function applySchedule(place, schedule) {
  if (!schedule?.summary) return false;
  if (place.managedManually && place.schedule) return false;
  if (place.detailSources?.schedule?.type === 'manual') return false;
  const same = JSON.stringify(place.schedule || null) === JSON.stringify(schedule);
  if (same) return false;
  place.schedule = schedule;
  place.detailSources ||= {};
  place.detailSources.schedule = source('official-website', schedule.sourceUrl);
  return true;
}
async function mapLimit(items, limit, worker) {
  let index = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index++];
      await worker(current);
    }
  });
  await Promise.all(runners);
}

const places = JSON.parse(await fs.readFile(FILE, 'utf8'));
let overrides = {};
try { overrides = JSON.parse(await fs.readFile(OVERRIDES_FILE, 'utf8')); } catch { /* optional */ }

const targets = places.filter((place) => place.status === 'active' && place.visibility !== 'suppressed' && canFetch(place.officialSource?.url || place.website));
let crawled = 0;
let matchedSites = 0;
let fieldsChanged = 0;
let schedulesFound = 0;

await mapLimit(targets, CONCURRENCY, async (place) => {
  const startUrl = canFetch(place.officialSource?.url || place.website);
  if (!startUrl) return;
  try {
    const home = await fetchHtml(startUrl);
    crawled++;
    const identityMatched = pageMatches(place, home.html) || tokens(new URL(home.url).hostname).some((token) => tokens(place.name).includes(token));
    if (!identityMatched) return;
    matchedSites++;
    const pages = [home];
    for (const link of candidateLinks(home.html, home.url)) {
      try { pages.push(await fetchHtml(link.url)); } catch { /* optional child page */ }
    }
    for (const page of pages) {
      const text = pageText(page.html);
      const structured = bestLdNode(parseLdJson(page.html), place);
      if (structured) {
        const fields = structuredFields(structured);
        for (const key of ['openingHours', 'phone', 'email', 'address', 'bookingUrl', 'operator']) {
          if (fields[key] && applyField(place, key, fields[key], page.url)) fieldsChanged++;
        }
      }
      const email = extractEmail(page.html, text);
      const phone = extractPhone(page.html, text);
      if (!place.email && email && applyField(place, 'email', email, page.url)) fieldsChanged++;
      if (!place.phone && phone && applyField(place, 'phone', phone, page.url)) fieldsChanged++;
      const textHours = openingHoursFromText(text);
      if (textHours && applyField(place, 'openingHours', textHours, page.url)) fieldsChanged++;
      const book = bookingLink(page.html, page.url);
      if (!place.bookingUrl && book && applyField(place, 'bookingUrl', book, page.url)) fieldsChanged++;
      const schedule = scheduleFromText(text, page.url);
      if (schedule) {
        const note = exceptionNote(text);
        if (note && note !== schedule.summary) schedule.notes = note;
        if (applySchedule(place, schedule)) { schedulesFound++; fieldsChanged++; }
        const hours = openingHoursFromSchedule(schedule);
        if (hours && !place.openingHours && applyField(place, 'openingHours', hours, page.url)) fieldsChanged++;
      }
    }
    place.lastDetailsChecked = TODAY;
  } catch { /* website may block automated retrieval */ }
});

let overridesApplied = 0;
for (const place of places) {
  const override = overrides[place.slug];
  if (!override) continue;
  const manual = Boolean(place.managedManually);
  for (const key of ['openingHours', 'phone', 'email', 'address', 'operator', 'bookingUrl', 'fee', 'wheelchair']) {
    if (override[key] == null || (manual && place[key])) continue;
    place[key] = override[key];
    overridesApplied++;
  }
  if (override.schedule && !(manual && place.schedule)) { place.schedule = override.schedule; overridesApplied++; }
  if (override.officialSource && !manual) place.officialSource = override.officialSource;
  place.detailSources ||= {};
  for (const [key, detail] of Object.entries(override.detailSources || {})) {
    if (manual && place[key]) continue;
    place.detailSources[key] = { ...detail, checkedAt: TODAY };
  }
  place.lastDetailsChecked = TODAY;
}

await fs.writeFile(FILE, `${JSON.stringify(places, null, 2)}\n`);
const publicPlaces = places.filter((place) => place.status === 'active' && place.visibility !== 'suppressed');
const count = (fn) => publicPlaces.filter(fn).length;
console.log(`Official-page enrichment: crawled ${crawled}/${targets.length} home page(s); matched ${matchedSites}; changed ${fieldsChanged} field(s); found ${schedulesFound} recurring schedule(s); applied ${overridesApplied} sourced override value(s).`);
console.log(`Richer coverage: opening hours ${count((p) => p.openingHours)}/${publicPlaces.length}; schedule/date pattern ${count((p) => p.schedule?.summary)}/${publicPlaces.length}; phone ${count((p) => p.phone)}/${publicPlaces.length}; email ${count((p) => p.email)}/${publicPlaces.length}.`);
