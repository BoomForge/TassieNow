import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// These existing workflows can write the shared live event/place/catalogue
// datasets. Keep their publication stages behind the same GitHub Actions lock;
// otherwise a photo publisher can advance main during a 30-minute discovery
// job and make its final pull --rebase fail on the same JSON files.
const writers = [
  'discover.yml',
  'events.yml',
  'catalogue-quality.yml',
  'catalogue-deep-quality.yml',
  'calendar-freshness.yml',
  'recover-images.yml',
  'event-photo-research.yml',
  'images.yml',
  'ai-photo-publish.yml'
];

test('overlapping data publishers use the non-cancelling shared write queue', () => {
  for (const file of writers) {
    const yaml = readFileSync(new URL('../../.github/workflows/' + file, import.meta.url), 'utf8');
    // Recognise either workflow-level or job-level concurrency configuration.
    const blocks = [...yaml.matchAll(/(?:^|\n)[ \t]*concurrency:\s*\n((?:[ \t]+[^\n]*\n){1,8})/g)];
    assert.ok(blocks.some(([, block]) =>
      /^\s*group:\s*tassienow-data-writes\s*$/m.test(block) &&
      /^\s*queue:\s*max\s*$/m.test(block) &&
      /^\s*cancel-in-progress:\s*false\s*$/m.test(block)
    ), file + ' must not race another shared data writer or cancel an older verified refresh');
  }
});

test('event publisher preserves unrelated build edits during its final rebase', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/events.yml', import.meta.url), 'utf8');
  assert.match(workflow, /git commit -m "data: refresh Tasmanian events and verified booking links"/);
  assert.match(workflow, /git pull --rebase --autostash origin main/);
  assert.match(workflow, /git add src\/data\/events\.json src\/data\/event-media-review\.json src\/data\/catalogue-audit\.json/);
});
