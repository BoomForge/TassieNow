/**
 * Calendar dates on the Burnie City Council site are event-local dates.
 * Never use ISO UTC conversion on midnight +11:00 and never borrow dates
 * from the preceding or following council listing card.
 */
const MONTHS={jan:1,january:1,feb:2,february:2,mar:3,march:3,apr:4,april:4,may:5,jun:6,june:6,jul:7,july:7,aug:8,august:8,sep:9,sept:9,september:9,oct:10,october:10,nov:11,november:11,dec:12,december:12};
const valid=(y,m,d)=>{
  const ms=Date.UTC(y,m-1,d); const dt=new Date(ms);
  return dt.getUTCFullYear()===y&&dt.getUTCMonth()+1===m&&dt.getUTCDate()===d;
};
export function localEventCalendarDate(value){
  const raw=String(value||'').trim();
  const m=/^(20\d{2})-(\d{2})-(\d{2})(?=$|T|\s)/.exec(raw);
  if(!m)return null;
  const y=Number(m[1]),month=Number(m[2]),day=Number(m[3]);
  return valid(y,month,day)?m[1]+'-'+m[2]+'-'+m[3]:null;
}
export function burnieListingCardDate(markup){
  const text=String(markup||'').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/\s+/g,' ');
  const m=/\b([0-3]?\d)\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(20\d{2})\b/i.exec(text);
  if(!m)return null;
  const day=Number(m[1]),month=MONTHS[m[2].toLowerCase()],year=Number(m[3]);
  if(!month||!valid(year,month,day))return null;
  const date=year+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
  return {startDate:date,endDate:date,raw:m[0]};
}
