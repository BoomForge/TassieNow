import test from 'node:test';
import assert from 'node:assert/strict';
import overrides from '../../src/data/place-overrides.json' with { type: 'json' };
import { applyVerifiedPlaceDisplayOverrides } from '../../src/lib/verified-place-display-overrides.mjs';
import { phoneFromText } from '../../src/lib/phone-candidate.mjs';

test('1830 hours are official restaurant lunch service, not park opening hours',()=>{
 const place=applyVerifiedPlaceDisplayOverrides({slug:'1830',openingHours:'Mo-Su 09:00-17:00'},overrides);
 assert.equal(place.openingHours,'Mo-Su 11:30-14:30');
});
test('Calcified Forest loses false GIS-coordinate phone without changing identity',()=>{
 const place=applyVerifiedPlaceDisplayOverrides({slug:'calcified-forest',phone:'0231591379',name:'Calcified Forest'},overrides);
 assert.equal(place.phone,undefined);
 assert.equal(place.name,'Calcified Forest');
});
test('phone parser preserves valid numbers but never extracts GIS-coordinate substrings',()=>{
 assert.equal(phoneFromText('146.602315913791728'),null);
 assert.equal(phoneFromText('03 6266 4345'),'03 6266 4345');
 assert.equal(phoneFromText('0419 403 467'),'0419 403 467');
});
