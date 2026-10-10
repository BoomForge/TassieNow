import fs from 'node:fs/promises';

// Rebase research candidates onto the newest rights-review queue.
// Preserve existing rights decisions, captions and curated candidate metadata.
const savedPath = process.argv[2];
if (!savedPath) throw Error('Usage: node scripts/reapply-event-review.mjs queue-after-run.json');
const file = new URL('../src/data/event-media-review.json', import.meta.url);
const [saved, current] = await Promise.all([savedPath, file].map(path => fs.readFile(path, 'utf8').then(JSON.parse)));
let addedEvents = 0;
let addedCandidates = 0;
for (const [slug, entry] of Object.entries(saved)) {
  if (!entry?.name || !Array.isArray(entry.candidates)) continue;
  if (!current[slug]) {
    current[slug] = entry;
    addedEvents++;
    addedCandidates += entry.candidates.length;
    continue;
  }
  const existing = current[slug];
  if (!Array.isArray(existing.candidates)) existing.candidates = [];
  const seen = new Set(existing.candidates.map(candidate => candidate.url));
  for (const candidate of entry.candidates) {
    if (!candidate?.url || seen.has(candidate.url)) continue;
    existing.candidates.push(candidate);
    seen.add(candidate.url);
    addedCandidates++;
  }
}
if (addedEvents || addedCandidates) await fs.writeFile(file, JSON.stringify(current, null, 2) + '\n');
console.log(`Preserved ${addedEvents} new event reviews and ${addedCandidates} newly discovered image candidates.`);
