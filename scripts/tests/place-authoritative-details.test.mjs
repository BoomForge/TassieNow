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

test('Hastings Thermal Pool licensed exact-subject photo replaces placeholder with attribution',()=>{
 const p=applyVerifiedPlaceDisplayOverrides({slug:'hastings-thermal-springs',image:{url:'/images/categories/discover.svg',isFallback:true}},overrides);
 assert.equal(p.image.isFallback,false);
 assert.equal(p.image.attribution,'Photnart');
 assert.equal(p.image.license,'CC BY-SA 3.0');
 assert.match(p.image.sourceUrl,/commons.wikimedia.org\/wiki\/File:Hastings_Thermal_Pool/);
});
test('Hastings licensed override never replaces an owner-quality real photograph',()=>{
 const original={slug:'hastings-thermal-springs',image:{url:'https://site.example/organiser-owned.jpg',isFallback:false}};
 assert.equal(applyVerifiedPlaceDisplayOverrides(original,overrides),original);
});

test('Crabtree phone override fixes encoded display and phone input',()=>{
 const p=applyVerifiedPlaceDisplayOverrides({slug:'crabtree-crop-and-crafts-market-crabtree',phone:'0419%20403%20467'},overrides);
 assert.equal(p.phone,'0419 403 467');
});
test('previously manual-sourced address overrides now reach live cards without changing unrelated listings',()=>{
 for(const [slug,address] of [
 ['the-hangout-cafe-and-restaurant','100A Main Road, Moonah, TAS 7009'],
 ['bento-legana','Shop 5/8 Legana Grove, Legana, TAS 7277'],
 ['mr-burger','1 Bayfield St, Rosny Park, TAS 7018']]){
   const p=applyVerifiedPlaceDisplayOverrides({slug,address:'Malformed old address'},overrides);
   assert.equal(p.address,address,slug);
 }
 const mr=applyVerifiedPlaceDisplayOverrides({slug:'mr-burger',town:'Hobart'},overrides);
 assert.equal(mr.town,'Rosny Park');
});
