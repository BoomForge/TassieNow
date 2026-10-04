import fs from 'node:fs/promises';
const PLACES_FILE = new URL('../src/data/places.json', import.meta.url);
const USER_AGENT = 'TassieNow/0.2 (+https://tassienow.pages.dev)';
const CONCURRENCY = 12;
async function checkUrl(url) {
  if (!url) return { status: 'none', code: null };
  for (const method of ['HEAD', 'GET']) {
    try {
      const response = await fetch(url, { method, redirect: 'follow', headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml,*/*;q=0.8' }, signal: AbortSignal.timeout(12000) });
      if (response.status === 404 || response.status === 410) return { status: 'dead', code: response.status };
      if (response.ok || [401, 403, 405, 429].includes(response.status)) return { status: response.ok ? 'ok' : 'inconclusive', code: response.status };
    } catch { if (method === 'GET') return { status: 'inconclusive', code: null }; }
  }
  return { status: 'inconclusive', code: null };
}
async function mapLimit(items, limit, worker) {
  let next = 0; async function run() { while (next < items.length) { const index = next++; await worker(items[index], index); } }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
}
const places = JSON.parse(await fs.readFile(PLACES_FILE, 'utf8')); let dead = 0; let ok = 0; let inconclusive = 0;
await mapLimit(places, CONCURRENCY, async (place) => {
  if (!place.website) return; const result = await checkUrl(place.website); place.websiteCheck = { status: result.status, code: result.code, checkedAt: new Date().toISOString() };
  if (result.status === 'dead') { dead += 1; place.website = null; } else if (result.status === 'ok') ok += 1; else inconclusive += 1;
});
await fs.writeFile(PLACES_FILE, `${JSON.stringify(places, null, 2)}\n`); console.log(`Link audit complete: ${ok} ok, ${dead} dead links removed, ${inconclusive} inconclusive.`);
