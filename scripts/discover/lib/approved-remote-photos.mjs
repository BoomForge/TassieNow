// Approval is a deliberate, evidenced action. Finding an OG image is not approval.
// This module never downloads or rehosts image bytes.
import {shouldUpgradeEventImage} from './event-media.mjs';

const clean = s=>String(s||'').trim();
const date=/^20\d{2}-\d{2}-\d{2}$/;
const licenseNames=/^(CC BY(?:-SA)? (?:2\.0|2\.5|3\.0|4\.0)|CC0 1\.0|Public domain)$/;
function publicHttps(value) {
  try {
    const u=new URL(value);
    if(u.protocol!=='https:'||u.username||u.password||!u.hostname.includes('.')||
      /^(localhost|127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|169\.254\.|0\.)/i.test(u.hostname)||
      /\.(?:local|internal|test)$/i.test(u.hostname))return false;
    return true;
  }catch{return false;}
}
const searchHost = url=>/(?:^|\.)(?:googleusercontent\.com|gstatic\.com|google\.com|bing\.com|pinterest\.com)$/i.test(new URL(url).hostname);
export function verifyApprovedRemotePick(pick) {
  if(!pick||!['place','event'].includes(pick.kind))return 'missing kind';
  if(!clean(pick.slug)||!clean(pick.name)||!clean(pick.town))return 'missing exact listing identity';
  const i=pick.image||{}, e=pick.evidence||{};
  if(!publicHttps(i.url)||!publicHttps(i.sourceUrl)||!publicHttps(e.rightsPage))return 'image, source and licence evidence must be public HTTPS';
  if(searchHost(i.url)||searchHost(i.sourceUrl)||searchHost(e.rightsPage))return 'search-engine images are not original sources';
  if(!clean(i.alt)||!clean(i.attribution)||!licenseNames.test(clean(i.license)))return 'missing alt, author or supported commercial-use licence';
  if(!clean(e.identity)||clean(e.identity).length<16||!clean(e.rightsDetails)||clean(e.rightsDetails).length<45||
     !date.test(e.checkedAt||'')||e.status!=='verified-open-licence')return 'insufficient original identity and rights evidence';
  const license=clean(i.license);
  const expected=license==='CC0 1.0'?'https://creativecommons.org/publicdomain/zero/1.0/':
    license==='Public domain'?null:
    'https://creativecommons.org/licenses/'+license.toLowerCase().replace('cc ','').replace(' ','/')+'/';
  if(expected&&clean(i.licenseUrl).replace(/\/$/,'')!==expected.replace(/\/$/,''))return 'licence URL mismatches licence version';
  if(license==='Public domain'&&!/public.domain.*(?:expiry|government|dedication|expired|basis)|(?:expiry|expired|dedicated).*public.domain/i.test(e.rightsDetails))
    return 'public domain must identify the specific basis';
  if(pick.kind==='event') {
    if(!['event-photo','official-artwork','historical-event','contextual'].includes(i.mediaType))return 'event photo type not verified';
    if(['historical-event','contextual'].includes(i.mediaType)&&!clean(i.caption))return 'historical and venue images need clear captions';
    if(i.mediaType==='historical-event'&&!Number.isInteger(i.historicalYear))return 'historical image requires year';
  }
  return null;
}
export function verifiedRemoteImage(pick){
  const i=pick.image,e=pick.evidence;
  return {
    url:i.url,sourceUrl:i.sourceUrl,alt:i.alt,attribution:i.attribution,
    license:i.license,licenseUrl:i.licenseUrl||null,isFallback:false,
    useMode:'external-embed',sourceMethod:'ai-verified-remote',usagePermission:'open-licence',
    ...(pick.kind==='event'?{mediaType:i.mediaType,caption:i.caption||null,
      ...(i.historicalYear?{historicalYear:i.historicalYear}:{})}:{}),
    matchEvidence:{verified:true,subject:e.identity,checkedAt:e.checkedAt,
      sourceFilePage:i.sourceUrl,rightsPage:e.rightsPage,details:e.rightsDetails,
      listingSlug:pick.slug,listingName:pick.name,listingTown:pick.town}
  };
}
export function applyApprovedRemotePhotos(places,events,picks,reachable=new Set()) {
  let placesAdded=0,eventsAdded=0; const skipped=[];
  for(const pick of picks){
    const error=verifyApprovedRemotePick(pick);
    if(error){skipped.push({slug:pick?.slug||'',reason:error});continue;}
    const records=pick.kind==='place'?places:events;
    const item=records.find(x=>x.slug===pick.slug&&x.name===pick.name&&x.town===pick.town&&
      x.status==='active'&&(pick.kind!=='place'||x.visibility!=='suppressed'));
    if(!item){skipped.push({slug:pick.slug,reason:'exact active listing not present'});continue;}
    if(pick.kind==='event'&&item.endDate<new Date().toLocaleDateString('en-CA',{timeZone:'Australia/Hobart'})){
      skipped.push({slug:pick.slug,reason:'event expired'});continue;
    }
    const upgraded=verifiedRemoteImage(pick);
    if(pick.kind==='place'?!item.image?.isFallback:!shouldUpgradeEventImage(item.image,upgraded)){
      skipped.push({slug:pick.slug,reason:'existing photo retained'});continue;
    }
    if(!reachable.has(pick.image.url)){skipped.push({slug:pick.slug,reason:'remote photo not HTTP-verified'});continue;}
    item.image=upgraded;
    if(pick.kind==='place')placesAdded++;else eventsAdded++;
  }
  return {placesAdded,eventsAdded,skipped};
}
