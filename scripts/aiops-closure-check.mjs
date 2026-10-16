/**
 * Production-only evidence for previously source-fixed AI Ops event cards.
 * Called by the EXISTING operations monitor; creates no new Actions schedule.
 *
 * A real page's JSON-LD and the retired public slug redirect must both pass
 * before ChatGPT may mark the matching Pixelwolf AI Ops card complete.
 * GitHub commits/source fixtures alone are NOT sufficient.
 */
const BASE='https://tassienow.com';
export const CLOSURES=[
  {cardId:'work-20261015-2803bc8060cd6705',query:'PinkUp Burnie',day:'2026-10-22',town:'Burnie',oldTown:'burnie',oldDay:'2026-10-21'},
  {cardId:'work-20261015-3ab0992d68819844',query:'Winter Challenge Tasmania',day:'2027-08-15',town:'Orford',venue:'31 Rheban Road',oldTown:'st-helens'},
  {cardId:'work-20261015-3e187266577dba0b',query:'Mental As Anything:',day:'2027-01-01',town:'Cranbrook',venue:'Craigie Knowe Vineyard',oldTown:'st-helens'},
  {cardId:'work-20261015-552e5ee30c808f4b',query:'Spoke Motorcycle Festival',day:'2027-02-26',town:'Little Swanport',venue:'100 Mayfield Jetty Road',oldTown:'st-helens'},
  {cardId:'work-20261015-577bb272489e347e',query:'19-Twenty live',day:'2026-12-05',town:'Cranbrook',venue:'Craigie Knowe Vineyard',oldTown:'st-helens'},
  {cardId:'work-20261015-5de3c3d774a5b634',query:'The Butcher',day:'2026-10-24',town:'Cranbrook',venue:'Craigie Knowe Vineyard'},
  {cardId:'work-20261015-89573139fcb70f6a',query:'Burnie Ten',day:'2026-10-25',town:'Burnie',venue:'Wilson and Cattley Street intersection',oldDay:'2026-10-22',oldTown:'burnie'},
  {cardId:'work-20261015-999e06a8d36be666',query:'ACOTAR 6 Midnight Release Event',day:'2026-10-26',town:'Burnie',venue:'Not Just Books',priceFrom:10},
  {cardId:'work-20261015-be6ddfbe1fccbbfe',query:'Book Market : Burnie Emu Bay Lions Club',day:'2026-11-07',town:'Wivenhoe',venue:'Wivenhoe Shed',oldTown:'burnie'},
  {cardId:'work-20261015-bed4145f1ed7b429',query:'ECHO Festival',day:'2027-03-12',town:'Swansea',venue:'13512 Tasman Hwy',oldTown:'st-helens'},
  {cardId:'work-20261015-cb9b5e73aaa9e6ed',query:'The Beatles Show:',day:'2026-12-26',town:'Cranbrook',venue:'Craigie Knowe Vineyard',oldTown:'st-helens'}
];

function normalPath(path){return path.replace(/\/+$/,'')+'/';}
function eventSchemas(html){
  const tags=[...html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const objects=[];
  for(const tag of tags){
    try{
      const parsed=JSON.parse(tag[1]);
      const flat=v=>{if(Array.isArray(v)){v.forEach(flat);return;}
        if(!v||typeof v!=='object')return;
        if(v['@graph'])flat(v['@graph']);
        const type=v['@type'];if(type==='Event'||Array.isArray(type)&&type.includes('Event'))objects.push(v);
      };
      flat(parsed);
    }catch{}
  }
  return objects;
}
function expiredOrBlocked(response,body){
  return !response.ok||body.length<300||/cf-challenge|just a moment|access denied|captcha/i.test(body.slice(0,1800));
}
/** No retry loops or secret credentials; runner remains under the existing 8-minute limit. */
export async function verifyAiOpsEventClosures(events,opts={}){
  const fetcher=opts.fetcher||fetch;
  const base=opts.base||BASE;
  const report={schema:'tassienow-aiops-live-closure-v1',checkedAt:new Date().toISOString(),
    base,scope:'11 existing TassieNow source-repaired Pixelwolf AI Ops cards; observed live HTML + redirect',cards:[]};
  for(const spec of CLOSURES){
    const entry={card_id:spec.cardId,status:'unverified',checks:[],observed_at_utc:null,
      expected:{name_contains:spec.query,startDate:spec.day,town:spec.town,venue:spec.venue||null}};
    const matches=events.filter(e=>e.name?.includes(spec.query)&&e.status==='active');
    if(matches.length!==1){entry.reason='source_cardinality_'+matches.length;report.cards.push(entry);continue;}
    const source=matches[0],url='/event/'+source.slug+'/';
    entry.url=base+url;entry.source_slug=source.slug;
    let sourcePass=source.startDate===spec.day&&source.town===spec.town&&
      (!spec.venue||(source.venue||'').includes(spec.venue))&&
      (spec.priceFrom===undefined||source.priceFrom===spec.priceFrom);
    entry.checks.push({name:'source_current',pass:sourcePass});
    if(!sourcePass){entry.reason='canonical_source_does_not_match_expected';report.cards.push(entry);continue;}
    try{
      const response=await fetcher(base+url,{redirect:'manual',headers:{accept:'text/html'},signal:AbortSignal.timeout(12000)});
      const html=await response.text();
      const schemas=eventSchemas(html);
      const actual=schemas.find(e=>(e.url||'').includes('/event/'+source.slug+'/'));
      const livePass=!expiredOrBlocked(response,html)&&response.status===200&&!!actual&&
        String(actual.startDate||'').startsWith(spec.day)&&
        actual.location?.address?.addressLocality===spec.town&&
        (!spec.venue||String(actual.location?.name||'').includes(spec.venue))&&
        (spec.priceFrom===undefined||
          Number(actual.offers?.price)===spec.priceFrom||
          // The Astro event template correctly omits JSON-LD Offer without a
          // real ticket URL, but still renders a verified public price label.
          (source.priceFrom===spec.priceFrom &&
            new RegExp('From\\\\s*(?:A\\\\$|\\\\$)'+spec.priceFrom+'(?:\\\\.00)?\\\\b','i').test(html)));
      entry.checks.push({name:'live_event_jsonld',pass:livePass,http_code:response.status,
        observed_date:actual?.startDate||null,observed_town:actual?.location?.address?.addressLocality||null,
        observed_venue:actual?.location?.name||null});
      if(!livePass){entry.reason='live_event_unverified_or_incorrect';report.cards.push(entry);continue;}
      if(spec.oldTown){
        const oldDay=spec.oldDay||spec.day;
        let oldSlug=source.slug;
        if(spec.oldDay)oldSlug=oldSlug.replace(spec.day,spec.oldDay);
        else if(!oldSlug.endsWith('-'+spec.town.toLowerCase().replace(/\s+/g,'-')))
          throw Error('old source slug cannot be derived safely');
        if(!spec.oldDay)oldSlug=oldSlug.replace(/-[a-z-]+$/,'-'+spec.oldTown);
        const old='/event/'+oldSlug+'/';
        entry.legacy_url=base+old;
        const redirect=await fetcher(base+old,{redirect:'manual',signal:AbortSignal.timeout(12000)});
        const location=redirect.headers.get('location')||'';
        const target=location?new URL(location,base).pathname:'';
        const redirectPass=[301,302,307,308].includes(redirect.status)&&normalPath(target)===normalPath(url);
        entry.checks.push({name:'old_event_redirect',pass:redirectPass,http_code:redirect.status,
          location:location||null});
        if(!redirectPass){entry.reason='legacy_redirect_unverified';report.cards.push(entry);continue;}
      }
      entry.status='live_verified';entry.observed_at_utc=new Date().toISOString();
    }catch(error){entry.reason=String(error.message||error).slice(0,180);}
    report.cards.push(entry);
  }
  report.live_verified_count=report.cards.filter(c=>c.status==='live_verified').length;
  report.unverified_count=report.cards.length-report.live_verified_count;
  return report;
}
