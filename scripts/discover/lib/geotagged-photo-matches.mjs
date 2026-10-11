import {permittedLicence} from './event-media.mjs';

const clean = value => String(value || '').normalize('NFKD')
  .replace(/[\u0300-\u036f]/g,'').replace(/<[^>]*>/g,' ').toLowerCase()
  .replace(/[^a-z0-9]+/g,' ').trim();
const block=/\b(?:logo|map|diagram|sign|signage|icon|poster|brochure|menu|screenshot|advertisement|flag|coat of arms|floor plan|artwork|illustration)\b/i;
const photoFile=/\.(?:jpe?g|webp|png)$/i;
const generalNames=new Set(['beach','reserve','lake','lagoon','creek','mountain','waterfall','forest','lookout','park','campground','restaurant','cafe','shop','market','museum']);
const urlIsHttps=value=>{try{return new URL(value).protocol==='https:';}catch{return false;}};
export const validCoordinate = place => {
  const lat=Number(place?.latitude), lon=Number(place?.longitude);
  return Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=-44.0&&lat<=-39.0&&lon>=143.0&&lon<=149.0;
};
// Maximum spatial search radius is intentionally small: a nearby landmark
// can be unrelated to this listing. Geography is corroboration, never identity.
export function geosearchUrl(place,radius=90) {
  if(!validCoordinate(place))return null;
  const query=new URL('https://commons.wikimedia.org/w/api.php');
  for(const [key,value] of Object.entries({
    action:'query',format:'json',generator:'geosearch',ggsprimary:'all',
    ggsnamespace:'6',ggslimit:'30',ggsradius:String(Math.min(120,Math.max(10,radius))),
    ggscoord:`${Number(place.latitude)}|${Number(place.longitude)}`,
    prop:'imageinfo',iiprop:'url|extmetadata',iiurlwidth:'1280'
  }))query.searchParams.set(key,value);
  return query;
}
export function geotaggedImageForPlace(place,page,observedAt=new Date().toISOString()) {
  if(!validCoordinate(place)||!page||page.ns!==6||!page.title)return null;
  const name=clean(place.name);
  const title=clean(page.title.replace(/^File:/i,''));
  if(name.length<10||name.split(' ').every(token=>generalNames.has(token)))return null;
  if(block.test(page.title)||!photoFile.test(page.title))return null;
  // A photograph geotagged at the location but captioned for a *different*
  // business, stall, view or attraction must NOT be published.
  if(!(' '+title+' ').includes(' '+name+' '))return null;
  const info=page.imageinfo?.[0],meta=info?.extmetadata||{};
  if(!info||!urlIsHttps(info.thumburl||info.url)||!urlIsHttps(info.descriptionurl))return null;
  const licence=String(meta.LicenseShortName?.value||meta.UsageTerms?.value||'').replace(/<[^>]*>/g,' ').trim();
  const licenceUrl=String(meta.LicenseUrl?.value||'');
  if(!permittedLicence(licence,licenceUrl))return null;
  const credit=String(meta.Artist?.value||'').replace(/<[^>]*>/g,' ').replace(/&amp;/gi,'&').trim();
  if(!credit)return null;
  // A named small business needs place+town textual corroboration too:
  // merely standing next to its building is not proof of its identity.
  const food=(place.categories||[]).includes('Food & Drink');
  const market=(place.categories||[]).includes('Markets');
  if((food||market)&&(!place.town||!(' '+title+' ').includes(' '+clean(place.town)+' ')))return null;
  return {
    url:info.thumburl||info.url,
    alt:`${place.name}, ${place.town}, Tasmania (geotagged Wikimedia Commons photograph)`,
    attribution:credit,
    license:licence,
    licenseUrl:licenceUrl||null,
    sourceUrl:info.descriptionurl,
    isFallback:false,
    sourceMethod:'commons-geosearch',
    confidence:'high',
    matchEvidence:{
      method:'exact-name-in-original-file-title-plus-nearby-geotag',
      originalTitle:page.title,
      listingName:place.name,
      verifiedCoordinateRadiusMetres:90,
      observedAt
    }
  };
}
