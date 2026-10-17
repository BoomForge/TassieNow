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

test('four Narawntapu walks do not borrow visitor centre hours or schedule',()=>{
 for(const slug of ['archers-knob','bird-hide','point-vision','springlawn-bird-hide-lookout']){
   const place=applyVerifiedPlaceDisplayOverrides({slug,name:slug,openingHours:'Mo-Su 12:30-13:00',schedule:{summary:'Closed 12:30-13:00'}},overrides);
   assert.equal(place.openingHours,undefined,slug);
   assert.equal(place.schedule,undefined,slug);
   assert.equal(place.name,slug);
 }
});
test('Tasmanian Produce Market displays the real operator, phone and venue',()=>{
 const p=applyVerifiedPlaceDisplayOverrides({slug:'tasmanian-produce-market',address:'Kangaroo Bay, Rosny Park',phone:'+61361692059',officialSource:{url:'https://tasproduceguide.au/markets/'}},overrides);
 assert.equal(p.address,'20 Kangaroo Bay Drive, Rosny Park TAS 7018');
 assert.equal(p.phone,'0448 997 748');
 assert.equal(p.officialSource.url,'https://hobarttwilightmarket.com.au/tasmanian-produce-market/');
});
test('owner-managed venue details are preserved',()=>{
 const p={slug:'tasmanian-produce-market',managedManually:true,phone:'0400 000 000',address:'Owner-corrected address'};
 assert.equal(applyVerifiedPlaceDisplayOverrides(p,overrides),p);
});
