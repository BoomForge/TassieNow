import test from 'node:test';
import assert from 'node:assert/strict';
import {geosearchUrl,geotaggedImageForPlace,validCoordinate}
  from '../discover/lib/geotagged-photo-matches.mjs';

const place={
  slug:'mount-field-national-park',
  name:'Mount Field National Park',town:'Maydena',
  latitude:-42.681,longitude:146.707,
  categories:['Nature & Walks']
};
const page={
  ns:6,title:'File:Mount Field National Park Tasmania.jpg',
  imageinfo:[{thumburl:'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/test.jpg/1280px-test.jpg',
    descriptionurl:'https://commons.wikimedia.org/wiki/File:Mount_Field_National_Park_Tasmania.jpg',
    extmetadata:{Artist:{value:'<a href="https://commons.wikimedia.org">Photographer Name</a>'},
      LicenseShortName:{value:'CC BY-SA 4.0'},
      LicenseUrl:{value:'https://creativecommons.org/licenses/by-sa/4.0/'}}}]
};

test('queries Wikimedia GeoData with tightly bounded coordinates and file namespace',()=>{
 const u=geosearchUrl(place);
 assert.equal(u.hostname,'commons.wikimedia.org');
 assert.equal(u.searchParams.get('generator'),'geosearch');
 assert.equal(u.searchParams.get('ggsnamespace'),'6');
 assert.equal(u.searchParams.get('ggsradius'),'90');
 assert.equal(u.searchParams.get('ggscoord'),'-42.681|146.707');
 assert.equal(geosearchUrl(place,999).searchParams.get('ggsradius'),'120');
});
test('rejects nonexistent, outside-Tasmania or invalid geocoordinates',()=>{
 for(const p of [{...place,latitude:0},{...place,longitude:null},{...place,latitude:'NaN'},
   {...place,longitude:180}, {...place,latitude:-45}]){
   assert.equal(validCoordinate(p),false);
   assert.equal(geosearchUrl(p),null);
 }
});
test('accepts a geographically nearby Commons photograph with exact name and licensed credit',()=>{
 const result=geotaggedImageForPlace(place,page,'2026-10-11T00:00:00.000Z');
 assert.equal(result.sourceMethod,'commons-geosearch');
 assert.equal(result.attribution,'Photographer Name');
 assert.equal(result.license,'CC BY-SA 4.0');
 assert.equal(result.matchEvidence.listingName,place.name);
 assert.equal(result.matchEvidence.verifiedCoordinateRadiusMetres,90);
 assert.equal(result.isFallback,false);
});
test('rejects geographically nearby but unrelated subjects',()=>{
 for(const title of [
  'File:Russell Falls.jpg',
  'File:Mount Field panoramic scenery.jpeg',
  'File:Mount Field National Park map.png',
  'File:Mount Field National Park logo.jpg',
  'File:Mount Field National Park poster.jpg'
 ])assert.equal(geotaggedImageForPlace(place,{...page,title}),null);
});
test('never substitutes short generic names',()=>{
 assert.equal(geotaggedImageForPlace({...place,name:'The Nut'},page),null);
 assert.equal(geotaggedImageForPlace({...place,name:'Beach'},page),null);
});
test('strictly checks Commons metadata, credits and lawful licences',()=>{
 const info=page.imageinfo[0];
 for(const license of ['CC BY-NC 4.0','CC BY-ND 4.0','Copyrighted']){
  assert.equal(geotaggedImageForPlace(place,{...page,imageinfo:[{
    ...info,extmetadata:{...info.extmetadata,LicenseShortName:{value:license},
      LicenseUrl:{value:'https://example.org/licence'}}}]}),null);
 }
 assert.equal(geotaggedImageForPlace(place,{...page,imageinfo:[{
   ...info,extmetadata:{...info.extmetadata,Artist:{value:''}}}]}),null);
 assert.equal(geotaggedImageForPlace(place,{...page,imageinfo:[{
   ...info,descriptionurl:'http://commons.wikimedia.org/wiki/File:X.jpg'}]}),null);
});
test('market and food listings need town in file title, not just coordinates',()=>{
 const market={...place,name:'Mount Field National Park',town:'Maydena',categories:['Markets']};
 assert.equal(geotaggedImageForPlace(market,page),null);
 assert.ok(geotaggedImageForPlace(market,{...page,title:'File:Mount Field National Park Maydena Tasmania.jpg'}));
 const cafe={...market,categories:['Food & Drink']};
 assert.equal(geotaggedImageForPlace(cafe,page),null);
});
