import { decodeEventEntities } from '../../../src/lib/event-text-entities.mjs';

// Read a show's OWN official page; card text on /whats-on contains presenter,
// venue and date fragments concatenated after the real title.
const text=raw=>decodeEventEntities(String(raw||'')
 .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
 .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
 .replace(/<[^>]*>/g,' ')
 .replace(/\s+/g,' ')).trim();
export function theatreNorthDetail(html=''){
 const source=String(html);
 const venueLabel=/<h[2-6]\b[^>]*>\s*Event\s+Venue\s*<\/h[2-6]>/i.exec(source);
 if(!venueLabel)return null;
 const prefix=source.slice(0,venueLabel.index);
 const h1s=[...prefix.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)];
 const title=text(h1s.at(-1)?.[1]);
 if(title.length<4||title.length>130||/^(?:what'?s on|events?|event details|show|home)$/i.test(title))return null;
 const after=source.slice(venueLabel.index+venueLabel[0].length,venueLabel.index+venueLabel[0].length+700);
 const venueMatch=/<(?:p|div|span)\b[^>]*>([^<]{3,150})<\/(?:p|div|span)>/i.exec(after);
 const venue=text(venueMatch?.[1]);
 if(venue.length<4||venue.length>160)return null;
 return {name:title,venue};
}
