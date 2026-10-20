/**
 * Keep the Weldborough Pass walk separate from Parks Tasmania's Cradle
 * Mountain "Rainforest Walk". This intentionally does not guess new phone,
 * official operator, visitor hours, walking grade, or missing media rights.
 */
export function correctWeldboroughSource(place){
 if(place?.slug!=='weldborough-pass-rainforest-walk'||place.managedManually)return false;
 let changed=false;
 const cradleUrl=url=>/parks\.tas\.gov\.au\/explore-our-parks\/cradle-mountain(?:\/|$)/i.test(String(url||''));
 const wrongContact=/^(?:\+?61\s*3\s*6492\s*1110|\(?03\)?\s*6492\s*1110)$/;
 const isWrongEmail=/^cradle@parks\.tas\.gov\.au$/i;
 const touch=(key)=>{if(place[key]!==undefined){delete place[key];changed=true;delete place.detailSources?.[key];}};
 if(cradleUrl(place.website))touch('website');
 if(cradleUrl(place.officialSource?.url))touch('officialSource');
 if(place.phone&&wrongContact.test(String(place.phone).replace(/[().-]/g,' ').replace(/\s+/g,' ').trim()))touch('phone');
 if(isWrongEmail.test(String(place.email||'').trim()))touch('email');
 const wrongWalk=/(?:cradle mountain|pencil pine falls|431\s*m(?:etres?)?|interpretation centre|ranger station)/i.test(String(place.summary||''));
 if(wrongWalk){
  place.summary='A short rainforest walking loop at Weldborough Pass State Reserve beside the Tasman Highway between Derby and St Helens. Follow local track signage and check current conditions before visiting.';
  changed=true;
 }
 // The imported hours, schedule and visitor-contact fields originated from
 // the misidentified Cradle walk, not from this unstaffed Weldborough track.
 if(wrongWalk||cradleUrl(place.website)||cradleUrl(place.officialSource?.url)||
    isWrongEmail.test(String(place.email||''))||wrongContact.test(String(place.phone||'').replace(/[().-]/g,' ').replace(/\s+/g,' ').trim())){
  touch('openingHours');touch('schedule');
 }
 return changed;
}
