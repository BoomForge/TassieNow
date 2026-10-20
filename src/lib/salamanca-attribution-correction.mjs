/**
 * Wikimedia Commons file page identifies Dysprosia as photographer and explicitly
 * specifies the BSD three-clause licence. Missing Artist in Commons' API metadata
 * previously showed 'Wikimedia Commons contributor' on gallery photo three.
 * This is a file-identity-specific correction, never a guessed author.
 */
const FILE = 'salamanca market, hobart, tasmania.jpg';
const SOURCE = 'https://commons.wikimedia.org/wiki/File:Salamanca_Market,_Hobart,_Tasmania.jpg';
const LICENSE = 'https://opensource.org/license/bsd-3-clause';

export function correctSalamancaPhotoCredit(place) {
 if (place?.slug !== 'salamanca-market' || place.managedManually || !Array.isArray(place.gallery)) return place;
 let changed=false;
 const gallery=place.gallery.map(image=>{
  if(!image || typeof image.sourceUrl !== 'string')return image;
  let filename;
  try{
   const u=new URL(image.sourceUrl);
   if(u.hostname!=='commons.wikimedia.org'||!u.pathname.startsWith('/wiki/File:'))return image;
   filename=decodeURIComponent(u.pathname.slice('/wiki/File:'.length)).replace(/_/g,' ').toLowerCase();
  }catch{return image;}
  if(filename!==FILE)return image;
  if(image.attribution==='Dysprosia' && image.license==='BSD 3-Clause' && image.licenseUrl===LICENSE)return image;
  changed=true;
  return {...image,attribution:'Dysprosia',license:'BSD 3-Clause',licenseUrl:LICENSE,sourceUrl:image.sourceUrl||SOURCE};
 });
 return changed?{...place,gallery}:place;
}
