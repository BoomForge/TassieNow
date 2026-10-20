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


test('Archers Knob and every Port Sorell detail page use North West',()=>{
 for(const slug of ['archers-knob','springlawn-bird-hide-lookout','ghost-rock','brewstone']){
  const stale={slug,town:'Port Sorell',region:'Hobart & South'};
  const fixed=applyVerifiedPlaceDisplayOverrides(stale,overrides);
  assert.equal(fixed.region,'North West',slug);
  assert.equal(stale.region,'Hobart & South');
 }
 const southern={slug:'sorell-market',town:'Sorell',region:'Hobart & South'};
 assert.equal(applyVerifiedPlaceDisplayOverrides(southern,overrides),southern);
 const manual={slug:'archers-knob',town:'Port Sorell',region:'Hobart & South',managedManually:true};
 assert.equal(applyVerifiedPlaceDisplayOverrides(manual,overrides),manual);
});


test('Salamanca third gallery photo credits Dysprosia with explicit BSD three-clause licence',()=>{
 const file='https://commons.wikimedia.org/wiki/File:Salamanca_Market,_Hobart,_Tasmania.jpg';
 const input={slug:'salamanca-market',gallery:[
  {sourceUrl:'https://commons.wikimedia.org/wiki/File:Different.jpg',attribution:'Photographer A'},
  {sourceUrl:'https://commons.wikimedia.org/wiki/File:Another.jpg',attribution:'Photographer B'},
  {sourceUrl:file,attribution:'Wikimedia Commons contributor',license:'BSD'}
 ]};
 const corrected=applyVerifiedPlaceDisplayOverrides(input,overrides);
 assert.equal(corrected.gallery[2].attribution,'Dysprosia');
 assert.equal(corrected.gallery[2].license,'BSD 3-Clause');
 assert.equal(corrected.gallery[2].licenseUrl,'https://opensource.org/license/bsd-3-clause');
 assert.equal(corrected.gallery[2].sourceUrl,file);
 assert.equal(corrected.gallery[0].attribution,'Photographer A');
 assert.equal(corrected.gallery[1].attribution,'Photographer B');
 assert.equal(input.gallery[2].attribution,'Wikimedia Commons contributor','never mutate source fixture');
 assert.equal(applyVerifiedPlaceDisplayOverrides(corrected,overrides),corrected,'idempotent correction');
 const manual={...input,managedManually:true};
 assert.equal(applyVerifiedPlaceDisplayOverrides(manual,overrides),manual,'preserve owner managed media');
 const other={...input,slug:'other-place'};
 assert.equal(applyVerifiedPlaceDisplayOverrides(other,overrides),other,'do not change unrelated places');
});
