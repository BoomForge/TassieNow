import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = (path) => readFile(new URL('../../' + path, import.meta.url), 'utf8');

test('root ads.txt declares only the supplied AdSense seller', async () => {
  assert.equal((await read('public/ads.txt')).trim(), 'google.com, pub-6507270199743672, DIRECT, f08c47fec0942fa0');
});
test('ownership verification is present without making unapproved Google ad calls', async () => {
  const layout = await read('src/layouts/BaseLayout.astro');
  const slots = await read('src/components/AdSlot.astro');
  assert.match(layout, /google-adsense-account/);
  assert.match(layout, /PUBLIC_ADSENSE_INLINE_LIVE === 'true'/);
  assert.match(slots, /PUBLIC_ADSENSE_INLINE_LIVE === 'true'/);
  assert.match(slots, /data-ad-client="ca-pub-6507270199743672"/);
});
test('affiliate fallbacks match existing Pixelwolf programme URLs and remain disclosed', async () => {
  const component = await read('src/components/AdSlot.astro');
  for (const url of [
    'https://www.play-asia.com/?affiliate_id=6876635',
    'https://try.elevenlabs.io/yi9gqjx30yd5',
    'https://www.meshy.ai?via=Pixelwolf'
  ]) assert.ok(component.includes(url));
  assert.match(component, /rel="sponsored noopener noreferrer"/);
  assert.match(component, /We may earn a commission/);
});
test('public API and admin allow content inline alongside the original placements', async () => {
  for (const path of ['functions/api/ads.js','functions/api/admin/ads/index.js','functions/api/admin/ads/[id].js']) {
    const source = await read(path);
    for (const placement of ['homepage-top','homepage-inline','content-inline','site-footer']) {
      assert.ok(source.includes(placement), path + ' missing ' + placement);
    }
  }
});
test('directory and place ad breaks are outside editorial result cards', async () => {
  for (const path of [
    'src/pages/food/index.astro','src/pages/discover/[mode].astro',
    'src/pages/region/[slug].astro','src/pages/town/[slug].astro',
    'src/pages/place/[slug].astro','src/pages/event/[slug].astro',
    'src/pages/guides/[slug].astro'
  ]) assert.match(await read(path), /<AdSlot placement="content-inline"/);
});
