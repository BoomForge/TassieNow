import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (path) => readFile(new URL('../../' + path, import.meta.url), 'utf8');

test('sitemap and event pages exclude suppressed events', async () => {
  const sitemap = await source('src/pages/sitemap.xml.ts');
  const event = await source('src/pages/event/[slug].astro');
  assert.match(sitemap, /e\.status==='active'&&e\.visibility!=='suppressed'/);
  assert.match(event, /event\.status === 'active' && event\.visibility !== 'suppressed'/);
});

test('public discovery does not link to suppressed events', async () => {
  for (const path of [
    'src/pages/index.astro',
    'src/pages/region/[slug].astro',
    'src/pages/town/[slug].astro',
    'src/pages/discover/[mode].astro'
  ]) {
    const content = await source(path);
    assert.match(content, /event\.status === 'active' && event\.visibility !== 'suppressed'/, path);
    assert.doesNotMatch(content, /event\.status === 'active' && (?:event\.endDate|event\.region|event\.town)/, path);
  }
});

test('ticket schema cannot substitute a last-checked timestamp for a ticket sale date', async () => {
  const event = await source('src/pages/event/[slug].astro');
  assert.match(event, /event\.ticketUrl && Number\.isFinite\(event\.priceFrom\)/);
  assert.doesNotMatch(event, /validFrom:\s*event\.ticketLastChecked/);
  assert.match(event, /event\.startTime \? \x60\$\{event\.startDate\}/);
});

test('built-site SEO audit rejects noindex and canonical-mismatched sitemap URLs', async () => {
  const audit = await source('scripts/audit-built-site.mjs');
  assert.match(audit, /Sitemap URL is noindex/);
  assert.match(audit, /Sitemap canonical mismatch/);
});

test('event rich-result markup uses event-specific artwork and never invents unknown venues', async () => {
  const event = await source('src/pages/event/[slug].astro');
  const audit = await source('scripts/audit-built-site.mjs');
  assert.match(event, /const namedVenue = sourceEventLocation\(\{name:event\.venue\}\)\.venue/);
  assert.match(event, /const hasNamedVenue = Boolean\(namedVenue\)/);
  assert.match(event, /const eventSchema = hasNamedVenue \? \{/);
  assert.match(event, /image: \[absoluteImage\]/);
  assert.match(event, /name: namedVenue/);
  assert.match(event, /\{eventSchema && <script type="application\/ld\+json"/);
  assert.match(audit, /Missing Event schema for named venue/);
  assert.match(audit, /Event schema without verified venue/);
  assert.match(audit, /Missing or invalid Event image URLs/);
});
