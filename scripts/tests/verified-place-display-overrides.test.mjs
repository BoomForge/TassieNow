import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { applyVerifiedPlaceDisplayOverrides } from '../../src/lib/verified-place-display-overrides.mjs';

const overrides = JSON.parse(await fs.readFile(new URL('../../src/data/place-overrides.json', import.meta.url), 'utf8'));
const slug = 'willie-smith-s-apple-shed';

test('applies independently sourced Willie Smith address, hours and phone at build time', () => {
  const input = { slug, name: 'Willie Smith\'s Apple Shed', address: 'Grove, Tasmania, 7109', openingHours: 'Mo-Su 09:00-17:00', phone: '(03)%206266%204345', status: 'active' };
  const out = applyVerifiedPlaceDisplayOverrides(input, overrides);
  assert.equal(out.address, '2064 Huon Highway, Grove TAS 7109');
  assert.equal(out.openingHours, 'Mo-Th 10:00-16:00; Fr 10:00-21:00; Sa-Su 10:00-17:00');
  assert.equal(out.phone, '(03) 6266 4345');
  assert.equal(out.status, 'active');
  assert.equal(out.name, input.name);
});

test('does not change other places or manually managed records', () => {
  const other = { slug: 'salamanca-market', address: 'Keep this value' };
  assert.equal(applyVerifiedPlaceDisplayOverrides(other, overrides), other);
  const manual = { slug, address: 'Owner managed', managedManually: true };
  assert.equal(applyVerifiedPlaceDisplayOverrides(manual, overrides), manual);
});

test('ignores attempted non-display modifications', () => {
  const input = {slug:'example', status:'active', name:'Original'};
  const out=applyVerifiedPlaceDisplayOverrides(input, {example:{liveDisplayOverride:true,name:'Changed',status:'suppressed',address:'Verified address'}});
  assert.equal(out.name,'Original');
  assert.equal(out.status,'active');
  assert.equal(out.address,'Verified address');
});
