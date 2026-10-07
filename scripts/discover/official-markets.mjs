import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { discover, crawlable, sameHost } from './lib/official-discovery.mjs';

const DATA = new URL('../../src/data/', import.meta.url);
const USER_AGENT = 'TassieNow/1.3 (+https://tassienow.com; market discovery)';
const TIMEOUT = 15000, MAX_BYTES = 2_000_000;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export function robotsAllows(text, url) {
  const groups = []; let group = null, rulesStarted = false;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/#.*$/, '').trim(), colon = line.indexOf(':');
    if (colon < 0) continue;
    const key = line.slice(0,colon).trim().toLowerCase(), value = line.slice(colon+1).trim();
    if (key === 'user-agent') {
      if (!group || rulesStarted) { group = { agents: [], rules: [] }; groups.push(group); rulesStarted = false; }
      group.agents.push(value.toLowerCase());
    } else if (group && ['allow','disallow'].includes(key)) { rulesStarted = true; if (value) group.rules.push({ allow: key === 'allow', path: value }); }
  }
  const exact = groups.filter(g => g.agents.some(a => a !== '*' && 'tassienow'.includes(a)));
  const selected = exact.length ? exact : groups.filter(g => g.agents.includes('*'));
  const target = new URL(url).pathname + new URL(url).search;
  const matches = selected.flatMap(g => g.rules).filter(r => {
    const pattern = r.path.replace(/[.+?^{}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp(`^${pattern}`).test(target);
  }).sort((a,b) => b.path.length - a.path.length || Number(b.allow) - Number(a.allow));
  return !matches.length || matches[0].allow;
}
export function createFetcher(fetchImpl = fetch) {
  const robots = new Map(), lastRequest = new Map();
  async function request(url, source, robotsRequest = false) {
    if (!crawlable(url, source)) throw new Error('URL outside approved source host');
    for (let redirects = 0; redirects < 4; redirects++) {
      const host = new URL(url).hostname;
      const delay = 1200 - (Date.now() - (lastRequest.get(host) || 0));
      if (delay > 0) await sleep(delay);
      lastRequest.set(host, Date.now());
      const response = await fetchImpl(url, { redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT), headers: { 'User-Agent': USER_AGENT, accept: robotsRequest ? 'text/plain' : 'text/html' } });
      if (response.status >= 300 && response.status < 400) {
        const target = new URL(response.headers.get('location'), url).href;
        await response.body?.cancel();
        if (!sameHost(target, source.url)) throw new Error('Cross-host redirect needs source registry update');
        url = target; continue;
      }
      if (robotsRequest && response.status === 404) return '';
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!robotsRequest && !/text\/html|application\/xhtml/i.test(response.headers.get('content-type') || '')) throw new Error('Not an HTML listing');
      const chunks = []; let bytes = 0;
      for await (const chunk of response.body) { bytes += chunk.length; if (bytes > MAX_BYTES) throw new Error('Page exceeds discovery size limit'); chunks.push(chunk); }
      return Buffer.concat(chunks).toString('utf8');
    }
    throw new Error('Too many redirects');
  }
  return async (url, source) => {
    const host = new URL(source.url).origin;
    if (!robots.has(host)) robots.set(host, request(`${host}/robots.txt`, source, true));
    const rules = await robots.get(host);
    if (!robotsAllows(rules, url)) throw new Error('robots.txt disallows discovery');
    return request(url, source);
  };
}
async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (e) { if (e.code === 'ENOENT') return fallback; throw e; }
}
async function main() {
  const sources = await readJson(new URL('./sources.json', import.meta.url));
  const places = await readJson(new URL('places.json', DATA));
  const events = await readJson(new URL('events.json', DATA), []);
  const previous = await readJson(new URL('discovery-candidates.json', DATA), []);
  const reviews = await readJson(new URL('discovery-reviews.json', DATA), {});
  const result = await discover({ sources, places, events, previous, reviews, fetchPage: createFetcher() });
  result.report.run = { id:process.env.GITHUB_RUN_ID || null, event:process.env.GITHUB_EVENT_NAME || 'local', sourceCommit:process.env.GITHUB_SHA || null };
  for (const [name,value] of [['places.json',result.places],['events.json',result.events],['discovery-candidates.json',result.candidates],['discovery-report.json',result.report]]) {
    await fs.writeFile(new URL(name, DATA), JSON.stringify(value,null,2)+'\n');
  }
  console.log(JSON.stringify(result.report.totals));
  for (const source of result.report.sources) {
    console.log(`${source.name}: ${source.pagesFetched} pages, ${source.candidatesFound} candidates`);
    for (const error of source.errors) console.warn(`::warning::${source.name}: ${error.message} (${error.url})`);
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    const rows = result.report.sources.map(s => `| ${s.name} | ${s.pagesFetched} | ${s.candidatesFound} | ${s.errors.length ? 'Needs attention' : 'OK'} |`).join('\n');
    await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, `## Market discovery\n\nPublished ${result.report.totals.added} new listings and ${result.report.totals.addedEvents} dated sessions; ${result.report.totals.review} candidates need review. Existing listings are preserved when sources fail.\n\n| Source | Pages | Candidates | Status |\n|---|---:|---:|---|\n${rows}\n\nReview: src/data/discovery-candidates.json\n`);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
