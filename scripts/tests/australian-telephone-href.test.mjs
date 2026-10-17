import test from 'node:test';
import assert from 'node:assert/strict';
import { normaliseTelephone, australianTelHref } from '../../src/lib/listing-field-sanitizers.mjs';

test('URL-decoded phone displays and valid mobile tap-to-call',()=>{
 assert.equal(normaliseTelephone('tel:0418%20934%20476'),'0418 934 476');
 assert.equal(australianTelHref('0418%20934%20476'),'tel:+61418934476');
});
test('national format with missing plus sign is converted to international dial format',()=>{
 assert.equal(australianTelHref('61363301259'),'tel:+61363301259');
});
test('leading domestic zero after country code is removed',()=>{
 assert.equal(australianTelHref('+610364775938'),'tel:+61364775938');
});
test('two phone numbers in one data field use the first only, never concatenate',()=>{
 assert.equal(australianTelHref('+61362727721+61428386843'),'tel:+61362727721');
});
test('local area codes and Australian service numbers are valid',()=>{
 assert.equal(australianTelHref('(03) 6266 4345'),'tel:+61362664345');
 assert.equal(australianTelHref('1300 123 456'),'tel:1300123456');
 assert.equal(australianTelHref('13 11 14'),'tel:131114');
});
test('bad/unrelated input cannot become tap-to-call',()=>{
 assert.equal(australianTelHref('yes'),null);
 assert.equal(australianTelHref('146.602315913791728'),null);
});
