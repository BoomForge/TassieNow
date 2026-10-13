import {permittedLicence} from './event-media.mjs';

// Nearby does not mean identical. Search broadly; publish only when original
// Commons metadata explicitly identifies the place and its locality.
const plain = value => String(value || '').replace(/<[^>]*>/g,' ')
  .replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").trim();
const clean = value => plain(value).normalize('NFKD')
  .replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const match = (context,phrase) => Boolean(clean(phrase)) &&
  (' '+clean(context)+' ').includes(' '+clean(phrase)+' ');
const blocked = /\b(?:logo|map|diagram|sign|signage|icon|poster|brochure|menu|screenshot|advertisement|flag|coat of arms|floor plan|artwork|illustration)\b/i;
const photoFile = /\.(?:jpe?g|webp|png)$/i;
const generic = new Set(['the','and','for','beach','reserve','lake','lagoon','creek','mount','mountain','waterfall','forest','lookout','park','campground','restaurant','cafe','shop','market','museum','national','tasmania','tasmanian']);
const https = value => { try { const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password; }catch{return false;} };
export const validCoordinate = place => {
  const lat=Number(place?.latitude), lon=Number(place?.longitude);
  return Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=-44&&lat<=-39&&lon>=143&&lon<=149;
};
// 350 metres is only a discovery radius, never evidence of identity.
// Keep the upper bound finite so unrelated nearby venues cannot flood the scan.
export function geosearchUrl(place,radius=350) {
  if(!validCoordinate(place))return null;
  const query=new URL('https://commons.wikimedia.org/w/api.php');
  for(const [key,value] of Object.entries({
    action:'query',format:'json',generator:'geosearch',ggsprimary:'all',
    ggsnamespace:'6',ggslimit:'50',ggsradius:String(Math.min(500,Math.max(10,radius))),
    ggscoord:String(Number(place.latitude))+'|'+String(Number(place.longitude)),
    prop:'imageinfo',iiprop:'url|extmetadata',iiurlwidth:'1280'
  }))query.searchParams.set(key,value);
  return query;
}
function details(place,page){
  if(!validCoordinate(place)||!page||page.ns!==6||!page.title||
     blocked.test(page.title)||!photoFile.test(page.title))return null;
  const info=page.imageinfo?.[0], meta=info?.extmetadata||{};
  if(!info||!https(info.thumburl||info.url)||!https(info.descriptionurl))return null;
  const licence=plain(meta.LicenseShortName?.value||meta.UsageTerms?.value||'');
  const licenceUrl=plain(meta.LicenseUrl?.value||'');
  if(!permittedLicence(licence,licenceUrl))return null;
  const credit=plain(meta.Artist?.value||'');
  if(!credit)return null;
  const title=plain(page.title.replace(/^File:/i,''));
  // Original source descriptions, object titles and Commons categories can
  // identify photographs with generic filenames. Artist/credit never does.
  const context=[title,meta.ObjectName?.value,meta.ImageDescription?.value,
    meta.Categories?.value].map(plain).join(' ');
  return {info,title,context,licence,licenceUrl,credit};
}
export function geotaggedImageForPlace(place,page,observedAt=new Date().toISOString()){
  const d=details(place,page), name=clean(place?.name);
  if(!d||name.length<10||name.split(' ').every(t=>generic.has(t)))return null;
  if(!match(d.context,place.name))return null;
  const food=(place.categories||[]).includes('Food & Drink');
  const market=(place.categories||[]).includes('Markets');
  // For businesses and markets require the *same locality* in original source
  // metadata. Geotagged proximity alone is not proof that it is this business.
  if((food||market)&&(!place.town||!match(d.context,place.town)))return null;
  return {
    url:d.info.thumburl||d.info.url,
    alt:place.name+', '+place.town+', Tasmania (geotagged Wikimedia Commons photograph)',
    attribution:d.credit,license:d.licence,licenseUrl:d.licenceUrl||null,
    sourceUrl:d.info.descriptionurl,isFallback:false,
    sourceMethod:'commons-geosearch',confidence:'high',
    matchEvidence:{
      method:'exact-name-in-original-Commons-metadata-plus-nearby-geotag',
      originalTitle:page.title,listingName:place.name,
      searchRadiusMetres:350,observedAt
    }
  };
}
// Broader *research* match: not permission, not identity verification.
// These leads go to the existing review queue and must never auto-publish.
export function geotaggedReviewCandidate(place,page,observedAt=new Date().toISOString()){
  const d=details(place,page);
  if(!d||!place?.name||!place?.town||!page.pageid)return null;
  const exact=match(d.context,place.name);
  const tokens=[...new Set(clean(place.name).split(' ').filter(t=>t.length>=4&&!generic.has(t)))];
  const hits=tokens.filter(t=>match(d.context,t));
  const locality=match(d.context,place.town)||match(d.context,'Tasmania');
  if(!exact&&(!locality||!tokens.length||hits.length<Math.min(2,tokens.length)))return null;
  return {
    id:'commons-geo:'+String(page.pageid),
    url:d.info.thumburl||d.info.url,
    sourcePage:d.info.descriptionurl,
    title:d.title,credit:d.credit,licence:d.licence,licenceUrl:d.licenceUrl,
    provider:'Wikimedia Commons GeoData',
    rights:'independent-verification-needed',
    identity:'candidate-not-verified',
    reason:exact?'Full place name in Commons metadata; locality needs confirmation':
      'Distinctive name words and nearby geotag; exact identity needs review',
    evidence:{nearbyGeotag:true,searchRadiusMetres:350,matchedWords:hits,localityInMetadata:locality},
    observedAt
  };
}
