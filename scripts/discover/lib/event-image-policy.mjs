// Event-image classification is distinct from copyright permission.
// Content matching, rights verification and captions are separate requirements.
import {permittedLicence,eventSeriesMatchesFile} from './event-media.mjs';

const tidy=value=>String(value||'').replace(/<[^>]*>/g,' ').replace(/&amp;/gi,'&')
  .replace(/&#39;/g,"'").replace(/\s+/g,' ').trim();
const normalize=value=>tidy(value).normalize('NFKD').toLowerCase()
  .replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const yearIn=value=>String(value||'').match(/\b20\d{2}\b/g)?.map(Number)||[];
const artworkWords=/\b(?:poster|flyer|programme|program|promotional|advert|advertisement|banner|artwork)\b/i;
const notPhotographs=/\b(?:map|sculpture|statue|traffic sign|road sign|signage|screenshot|floor plan)\b/i;
const venueBlacklist=/^(?:town hall|community hall|theatre|stadium|arts centre|library|school)$/i;

export function classifyCommonsEventImage(event,page,info){
  const metadata=info?.extmetadata||{};
  const file=tidy(page?.title||'');
  const description=tidy([metadata.ObjectName?.value,metadata.ImageDescription?.value,
    metadata.Categories?.value].filter(Boolean).join(' '));
  const context=file+' '+description;
  if(!file || notPhotographs.test(file))return null;
  // Complete event-series identity, not a single coincidental keyword.
  const series=eventSeriesMatchesFile(event.name,file);
  const targetYear=Number(String(event.startDate||'').slice(0,4));
  const pictured=yearIn(file).length?yearIn(file):yearIn(description);
  const local=normalize(event.town);
  const venueRegion=normalize(context);
  const nameLoc=normalize(event.name).split(' ').filter(w=>['hobart','launceston','devonport','burnie','sorell','tasmania'].includes(w));
  const located=Boolean((local&&venueRegion.includes(local))||/\btasmania(?:n)?\b/i.test(context)||
    nameLoc.some(w=>venueRegion.split(' ').includes(w)));
  if(series){
    if(!located)return null;
    if(pictured.some(year=>!Number.isFinite(targetYear)||year>targetYear))return null;
    const prior=pictured.filter(year=>year<targetYear).sort((a,b)=>b-a)[0];
    if(prior){
      if(artworkWords.test(file))return {mediaType:'event-artwork',historicalYear:prior,
        caption:`Archived promotional artwork from ${prior}; not artwork for the ${targetYear} edition.`,
        alt:`${event.name} — archived promotional artwork from ${prior}`};
      return {mediaType:'historical-event',historicalYear:prior,
        caption:`Photo from the ${prior} edition of ${event.name}; not a photo of the ${targetYear} event.`,
        alt:`${event.name} — photograph from ${prior}`};
    }
    if(artworkWords.test(file)){
      return {mediaType:'event-artwork',caption:'Licensed event promotional artwork',
        alt:`${event.name} promotional artwork`};
    }
    // Exact event identity and no contradictory year information.
    return {mediaType:'event-photo',caption:null,alt:`${event.name} event photograph`};
  }
  // Venue context requires a named, distinctive actual venue, not city-wide
  // theatre/school imagery or a picture of an unrelated act or opponent.
  const venue=String(event.venue||'').trim();
  if(!venue || venue.length<9 || venueBlacklist.test(venue))return null;
  const venueName=normalize(venue);
  const title=normalize(file);
  if(!venueName || !title.includes(venueName) || artworkWords.test(file))return null;
  if(!local || !(normalize(context).includes(local)||/\btasmania(?:n)?\b/i.test(context)))return null;
  return {mediaType:'contextual',
    caption:`Venue photograph: ${venue}. This does not depict the advertised event.`,
    alt:`${venue} venue, contextual photograph for ${event.name}`};
}

export function approvedCandidateImage(event,candidate){
  // Publishing an organiser website preview is never automatic simply because
  // it appeared on that site; explicit reuse evidence must accompany approval.
  if(candidate?.rights!=='granted'||candidate?.eventIdentityVerified!==true)return null;
  const permission=candidate.permission;
  if(!permission?.grantedBy||!permission?.evidenceUrl?.startsWith('https://')||
     !permission?.verifiedAt||!permission?.scope?.includes('TassieNow'))return null;
  if(!candidate.url?.startsWith('https://')||!candidate.sourcePage?.startsWith('https://'))return null;
  const type=candidate.imageType;
  if(!['official-artwork','historical-event','contextual','event-photo'].includes(type))return null;
  if((type==='historical-event'||type==='contextual')&&!candidate.caption)return null;
  if(type==='historical-event'&&!Number.isInteger(candidate.historicalYear))return null;
  const image={
    url:candidate.url,
    sourceUrl:candidate.sourcePage,
    alt:candidate.alt||`${event.name} — ${type.replaceAll('-', ' ')}`,
    attribution:candidate.credit||permission.grantedBy,
    license:'Organiser permission',
    licenseUrl:permission.evidenceUrl,
    usagePermission:'granted',
    permissionEvidence:permission,
    sourceMethod:'organiser-approved',
    mediaType:type,
    caption:candidate.caption||null,
    ...(candidate.historicalYear?{historicalYear:candidate.historicalYear}:{}),
    isFallback:false,
    matchEvidence:{verified:true,eventName:event.name,checkedAt:permission.verifiedAt,
      verificationSource:candidate.sourcePage}
  };
  return image;
}

export function eligibleCommonsImage(event,page,info){
  const classification=classifyCommonsEventImage(event,page,info);
  if(!classification)return null;
  const metadata=info?.extmetadata||{};
  const licence=tidy(metadata.LicenseShortName?.value||metadata.UsageTerms?.value||'');
  const licenseUrl=metadata.LicenseUrl?.value||'';
  if(!permittedLicence(licence,licenseUrl)||!info?.descriptionurl?.startsWith('https://'))return null;
  const imageUrl=info.thumburl||info.url;
  if(!imageUrl?.startsWith('https://'))return null;
  return {
    ...classification,
    url:imageUrl,
    sourceUrl:info.descriptionurl,
    attribution:tidy(metadata.Artist?.value||metadata.Credit?.value)||'Wikimedia Commons contributor',
    license:licence,
    licenseUrl,
    sourceMethod:'commons-event',
    isFallback:false,
    matchEvidence:{verified:true,eventName:event.name,sourceFileTitle:String(page.title||''),
      sourceFilePage:info.descriptionurl,verifiedType:classification.mediaType,
      checkedAt:new Date().toISOString().slice(0,10)}
  };
}


const genericVenue=/^(?:hobart|launceston|devonport|tasmania|bothwell|whitemark|theatre|cinema|town hall|community centre|public hall|various locations|devonport and surrounds|launceston and surrounds)$/i;
const tokenise=value=>normalize(value).split(' ').filter(Boolean);
export function eligibleCommonsVenueImage(event,page,info) {
  // Intentionally strict about *where* the photo was taken, flexible about
  // when it was taken. A venue photo never purports to show the event itself.
  const rawVenue=String(event.venue||'').split(',')[0].trim();
  const venue=normalize(rawVenue);
  const town=normalize(event.town);
  if(venue.length<9||!town||genericVenue.test(rawVenue)||/\b(?:street|road|avenue|st|tas|australia)\b/i.test(rawVenue))return null;
  const file=tidy(page?.title||'');
  const fileName=normalize(file.replace(/^File:/i,''));
  if(/\b(?:logo|poster|advert|icon|sculpture|statue|sign|map|diagram|plan)\b/i.test(file))return null;
  if(!fileName.includes(venue))return null;
  const meta=info?.extmetadata||{};
  const desc=normalize([meta.ImageDescription?.value,meta.ObjectName?.value,meta.Categories?.value].join(' '));
  const location=fileName+' '+desc;
  // Town names such as Hobart, Devonport and Sheffield also exist outside
  // Tasmania; the image itself must explicitly establish the Tasmanian state.
  if(!location.includes(town) || !(location.includes('tasmania')||location.includes('tasmanian') ||
    /\\btas\\b/i.test(tidy(meta.ImageDescription?.value||''))))return null;
  // Do not accept generic "town hall" photos or a similarly named interstate venue.
  if(tokenise(venue).filter(w=>w.length>3).length<2)return null;
  const yearMatches=file.match(/\b20\d{2}\b/g)||[];
  const license=tidy(meta.LicenseShortName?.value||meta.UsageTerms?.value);
  if(!permittedLicence(license,meta.LicenseUrl?.value))return null;
  const url=info?.thumburl||info?.url;
  if(!url?.startsWith('https://')||!info?.descriptionurl?.startsWith('https://'))return null;
  return {
    url,sourceUrl:info.descriptionurl,license,licenseUrl:meta.LicenseUrl?.value||null,
    attribution:tidy(meta.Artist?.value||meta.Credit?.value)||'Wikimedia Commons contributor',
    alt:`${rawVenue}, ${event.town} — venue photograph, not the advertised event`,
    mediaType:'contextual',
    caption:`Venue photograph: ${rawVenue}, ${event.town}. This does not depict the advertised event.`,
    sourceMethod:'commons-venue',isFallback:false,
    matchEvidence:{verified:true,verifiedType:'contextual',venue:rawVenue,town:event.town,
      sourceFileTitle:file,sourceFilePage:info.descriptionurl,checkedAt:new Date().toISOString().slice(0,10),
      evidence:'Full venue name in Commons file title and Tasmania/town in source description',
      ...(yearMatches.length?{photoYear:Number(yearMatches[0])}:{})}
  };
}
