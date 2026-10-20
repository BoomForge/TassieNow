/**
 * A Wikidata P131 administrator label is not necessarily the locality of a
 * venue. Reject state, council and government-area names instead of emitting
 * "Tasmania" (or "<Council> Council") as a town breadcrumb.
 *
 * This intentionally does not guess a settlement from nearby coordinates.
 * Unknowns are held from new imports pending a proper locality source.
 */
export function verifiedWikidataLocality(value) {
 const name=String(value??'').replace(/\s+/g,' ').trim();
 if(!name || name.length>80 || /^Q\d+$/i.test(name))return null;
 if(/^(?:tasmania|tas|australia|commonwealth of australia)$/i.test(name))return null;
 if(/\b(?:city council|council|municipality|municipal area|local government area|regional council|shire|district council)\b/i.test(name))return null;
 if(/\b(?:greater hobart|north west coast|southern tasmania|northern tasmania|central tasmania)\b/i.test(name))return null;
 if(!/^[\p{L}\s.'-]+$/u.test(name))return null;
 return name;
}
