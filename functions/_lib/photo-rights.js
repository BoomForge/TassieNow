// Admin-only photo acceptance policy. Search indexes and credits do not establish reuse rights.
// Existing approved images are not reclassified when unrelated catalogue fields are edited.
const text = (value, limit=250) => String(value ?? '').trim().slice(0,limit);
const validHttps = (value, label) => {
  let url;
  try { url=new URL(value); } catch { throw new Error(label+' must be a valid HTTPS URL'); }
  if(url.protocol!=='https:' || url.username || url.password ||
    /^(localhost|127\.|10\.|192\.168\.)/i.test(url.hostname))
    throw new Error(label+' must be a public HTTPS URL');
  return url.href;
};

export function photoLicence(name) {
  const value=text(name,80).toUpperCase().replace(/\s+/g,' ');
  const cc=value.match(/^CC (BY|BY-SA) (2\.0|2\.5|3\.0|4\.0)$/);
  if(cc)return {name:'CC '+cc[1]+' '+cc[2],
    url:'https://creativecommons.org/licenses/'+cc[1].toLowerCase()+'/'+cc[2]+'/'};
  if(value==='CC0'||value==='CC0 1.0')return {name:'CC0 1.0',url:'https://creativecommons.org/publicdomain/zero/1.0/'};
  if(value==='PUBLIC DOMAIN')return {name:'Public domain',url:null};
  if(value==='RIGHTS-HOLDER PERMISSION')return {name:'Rights-holder permission',url:null,permission:true};
  throw new Error('Choose CC BY, CC BY-SA, CC0, public domain, or documented rights-holder permission. Credit alone is insufficient.');
}

export function acceptAdminPhoto(body, current, verifiedAt) {
  if(!body.image_url)return current || null;
  const url=validHttps(body.image_url,'Photo');
  if (/(^|\.)(googleusercontent\.com|gstatic\.com)$/.test(new URL(url).hostname) ||
      /(^|\.)google\.[a-z.]+$/.test(new URL(url).hostname))
    throw new Error('Use the independently authorised original image file, not Google cached/review/map imagery.');
  // If the stored image and its provenance have not changed, preserve its complete
  // original metadata and do not force fresh attestations on unrelated edits.
  const unchanged=current&&current.url===url&&
    ['image_alt','image_attribution','image_license','image_source_url','image_license_url']
    .every((key)=>{
      const field={image_alt:'alt',image_attribution:'attribution',image_license:'license',
        image_source_url:'sourceUrl',image_license_url:'licenseUrl'}[key];
      return text(body[key])===text(current[field]);
    });
  if(unchanged)return current;
  if(/\/images\/categories\/|\.(?:svg)(?:\?|$)/i.test(url))
    throw new Error('Category illustrations cannot be approved as real photographs.');
  if(body.image_rights_confirmed!==true)
    throw new Error('Verify the exact place, original source and reuse rights before accepting a photo.');
  const attribution=text(body.image_attribution,180);
  const alt=text(body.image_alt || body.name,180);
  if(!attribution || /^(unknown|owner supplied|provided by site owner|google)$/i.test(attribution))
    throw new Error('Enter the actual photographer or named rights-holder.');
  if(!alt)throw new Error('Describe what the photograph actually depicts.');
  const licence=photoLicence(body.image_license);
  const sourceUrl=validHttps(body.image_source_url,'Original photo source');
  const origin=new URL(sourceUrl);
  if((/(^|\.)google\.|(^|\.)googleusercontent\.|(^|\.)gstatic\./.test(origin.hostname)) ||
      /^(www\.)?(bing|pinterest)\./.test(origin.hostname))
    throw new Error('Provide the original photographer or licensor page, not a search-result or Google-hosted image.');
  const providedLicenceUrl=text(body.image_license_url);
  if(licence.url && providedLicenceUrl) {
    const actual=validHttps(providedLicenceUrl,'Licence').replace(/\/$/,'');
    if(actual!==licence.url.replace(/\/$/,''))
      throw new Error('Licence URL must match the exact Creative Commons version selected.');
  }
  const permissionNotes=text(body.image_permission_notes,500);
  if(licence.permission && (!/\b20\d\d-\d\d-\d\d\b/.test(permissionNotes) || permissionNotes.length<35))
    throw new Error('Rights-holder permission needs a dated, non-private note describing who granted which website reuse rights.');
  if(licence.name==='Public domain' && permissionNotes.length<20)
    throw new Error('For public domain, document the original source’s specific public-domain basis in the evidence notes.');
  return {
    url,alt,attribution,license:licence.name,
    licenseUrl:licence.url || (providedLicenceUrl?validHttps(providedLicenceUrl,'Licence'):null),
    sourceUrl,isFallback:false,sourceMethod:'manual-reviewed',
    rightsEvidence:{
      status:'owner-attested',checkedAt:verifiedAt,
      note:permissionNotes || 'Owner confirmed original source, subject identity and licence before publication.'
    }
  };
}
