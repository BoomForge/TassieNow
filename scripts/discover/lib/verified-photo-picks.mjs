// Manually source-verified Commons images for listings missed by text discovery.
// Keep this intentionally small and evidence-led, not a generic imagery fallback.
export const verifiedPhotoPicks=[{
  slug:'tessallated-pavement',
  name:'Tessallated Pavement',
  image:{
    url:'https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/Tessellated-Pavement_Tasmania.jpg/1280px-Tessellated-Pavement_Tasmania.jpg',
    alt:'Tessellated Pavement rock formation on the Tasman Peninsula, Tasmania',
    attribution:'Felix Andrews (Floybix)',
    license:'CC BY-SA 3.0',
    licenseUrl:'https://creativecommons.org/licenses/by-sa/3.0/',
    sourceUrl:'https://commons.wikimedia.org/wiki/File:Tessellated-Pavement_Tasmania.jpg',
    sourceMethod:'verified-curated',
    isFallback:false,
    matchEvidence:{
      verified:true,
      subject:'Tessellated Pavement, Tasman Peninsula',
      listingSpelling:'Tessallated Pavement',
      evidence:'Source description explicitly identifies the same rock formation; author and CC BY-SA 3.0 verified on Commons',
      checkedAt:'2026-10-11'
    }
  }
},{
  slug:'farm-gate-market',
  name:'Farm Gate Market',
  image:{
    url:'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Hobart_FarmerMarket_003_2020.jpg/1280px-Hobart_FarmerMarket_003_2020.jpg',
    alt:'Farm Gate Market on Bathurst Street, Hobart, photographed in January 2020',
    attribution:'Owen Allen',
    license:'CC BY 2.0',
    licenseUrl:'https://creativecommons.org/licenses/by/2.0/',
    sourceUrl:'https://commons.wikimedia.org/wiki/File:Hobart_FarmerMarket_003_2020.jpg',
    sourceMethod:'verified-curated',
    isFallback:false,
    matchEvidence:{
      verified:true,
      subject:'Farm Gate Market, Bathurst Street, Hobart',
      evidence:'Commons caption explicitly names Farm Gate Market at Mathers Place, Hobart; photographed 26 January 2020; Owen Allen CC BY 2.0 reviewed by FlickrReviewR',
      checkedAt:'2026-10-11',
      photographedYear:2020
    }
  }
}];
export function applyVerifiedPhotoPicks(places){
 let upgraded=0;
 for(const pick of verifiedPhotoPicks){
  const place=places.find(p=>p.slug===pick.slug && p.name===pick.name && p.status==='active');
  if(!place || (place.image && !place.image.isFallback))continue;
  place.image=structuredClone(pick.image);
  upgraded++;
 }
 return upgraded;
}
