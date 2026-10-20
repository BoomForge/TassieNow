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

test('Bento Legana and Little Riva source-reviewed contact fields override malformed past imports',()=>{
 for(const [slug,phone] of [['bento-legana','(03) 6330 1259'],['little-riva','(03) 6477 5938']]){
  const p=applyVerifiedPlaceDisplayOverrides({slug,phone:'613003001259',address:'Old address'},overrides);
  assert.equal(p.phone,phone,slug);
  assert.ok(p.address.length>20,slug);
 }
});


test('Bakers Delight Claremont Plaza overrides Victoria head-office address and stale hours',()=>{
 const verified=overrides['bakers-delight'];
 assert.equal(verified.liveDisplayOverride,true);
 assert.equal(verified.name,'Bakers Delight Claremont Plaza');
 assert.equal(verified.town,'Claremont');
 assert.equal(verified.openingHours,'Mo-Fr 06:00-18:00; Sa-Su 08:00-18:00');
 assert.equal(verified.phone,'03 6249 9117');
 assert.match(verified.address,/Shop 15.*35 Main Road.*Claremont TAS 7011/);
 assert.equal(verified.detailSources.openingHours.url,'https://claremontplaza.com.au/stores/bakers-delight/');
 const stale={slug:'bakers-delight',town:'Glenorchy',
   address:'293 Camberwell Road, Camberwell, Victoria, 3124',openingHours:'Mo-Sa 08:30-18:00'};
 const fixed=applyVerifiedPlaceDisplayOverrides(stale,overrides);
 assert.equal(fixed.town,'Claremont');
 assert.equal(fixed.address,verified.address);
 assert.equal(fixed.openingHours,verified.openingHours);
 assert.equal(applyVerifiedPlaceDisplayOverrides({...stale,managedManually:true},overrides).address,stale.address);
});

test('Trowunna no longer inherits generic Tasmania locality or unrelated region',()=>{
 const official=overrides['trowunna-wildlife-park'];
 assert.equal(official.town,'Mole Creek');
 assert.equal(official.region,'Launceston & North');
 assert.equal(official.detailSources.town.url,'https://www.trowunna.com.au/contact-us');
 const stale={
   slug:'trowunna-wildlife-park',name:'Trowunna Wildlife Park',town:'Tasmania',
   region:'Hobart & South',address:'Tasmania'
 };
 const fixed=applyVerifiedPlaceDisplayOverrides(stale,overrides);
 assert.equal(fixed.town,'Mole Creek');
 assert.equal(fixed.region,'Launceston & North');
 assert.equal(fixed.address,'1892 Mole Creek Road, Mole Creek TAS 7304');
 assert.equal(fixed.name,stale.name,'do not rename business without evidence');
 const manual={...stale,managedManually:true};
 assert.equal(applyVerifiedPlaceDisplayOverrides(manual,overrides),manual);
});
