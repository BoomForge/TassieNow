// Distinct Tasmanian editorial artwork, not an organiser poster or a photograph.
// The image is used only when no licensed event, venue or activity media exists.
export function eventDisplayImage(event) {
 return event?.image?.url && !event.image.isFallback ? event.image.url :
  event?.slug ? '/images/event-posters/'+encodeURIComponent(event.slug)+'.svg' : '/images/categories/events.svg';
}
export function eventDisplayAlt(event) {
 return event?.image?.url&&!event.image.isFallback ? (event.image.alt||event.name):
  'Original TassieNow illustrated event card for '+String(event?.name||'Tasmanian event');
}
const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;')
 .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const themes=[
 [/music|concert|quartet|band|carols|choir|sing|folk/i,['#21153e','#6d4cab','#f7c6ff']],
 [/food|wine|taste|feast|market|cook|dining/i,['#381a2b','#a84b58','#ffdab0']],
 [/sport|golf|skating|pickleball|archery|race|walking|pilates/i,['#123c43','#237e79','#d7ffef']],
 [/art|exhibit|festival|story|film|cinema|show|theatre|craft/i,['#2b2447','#636cb1','#ffe1d4']],
 [/workshop|learn|training|talk|discussion|library|class/i,['#152c48','#2e698e','#d4ebff']],
 [/community|family|seniors|youth|charity|fundrais|support/i,['#284037','#689168','#ecffd4']]
];
function linesOf(name){
 const words=String(name||'Tasmanian event').split(/\s+/);
 const lines=[];let line='';
 for(const word of words) {
  if((line+' '+word).trim().length>31 && line){lines.push(line);line=word;}
  else line=(line+' '+word).trim();
 }
 if(line)lines.push(line);
 if(lines.length>3){
  const rest=lines.slice(2).join(' ');
  return [lines[0],lines[1],rest.length>30?rest.slice(0,29)+'…':rest];
 }
 return lines;
}
function formatDate(date){
 const match=String(date||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
 const months=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
 return match ? match[3]+' '+months[Number(match[2])-1]+' '+match[1] : 'SEE EVENT DETAILS';
}
export function renderEventPoster(event){
 const name=String(event?.name||'Tasmanian event');
 const palette=(themes.find(t=>t[0].test(name))||[null,['#182d3d','#345d72','#ffddaa']])[1];
 const rows=linesOf(name),font=rows.some(x=>x.length>25)?48:58;
 const title=rows.map((line,i)=>'<tspan x="72" y="'+(255+(i-(rows.length-1)/2)*85)+'">'+esc(line)+'</tspan>').join('');
 const town=String(event?.town||'Tasmania');
 const marks=Array.from({length:7},(_,i)=>'<circle cx="'+(790+i*48)+'" cy="'+(145+i*63)+
  '" r="'+(35+i*19)+'" stroke="'+palette[2]+'" stroke-opacity=".12" stroke-width="3" fill="none"/>').join('');
 return '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" role="img">'+
  '<title>'+esc(name)+'</title><desc>Original TassieNow artwork, not a photograph or organiser poster.</desc>'+
  '<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">'+
  '<stop stop-color="'+palette[0]+'"/><stop offset="1" stop-color="'+palette[1]+'"/></linearGradient></defs>'+
  '<rect width="1200" height="675" fill="url(#bg)"/>'+
  '<circle cx="1120" cy="220" r="290" fill="'+palette[2]+'" opacity=".11"/>'+marks+
  '<path d="M735 675L876 499 944 566 1075 395 1200 580V675Z" fill="'+palette[0]+'" opacity=".46"/>'+
  '<rect x="72" y="69" width="51" height="6" rx="3" fill="'+palette[2]+'"/>'+
  '<text x="139" y="80" font-family="Arial,Helvetica,sans-serif" font-size="22" font-weight="800" letter-spacing="4" fill="white">TASSIENOW</text>'+
  '<text x="73" y="155" font-family="Arial,Helvetica,sans-serif" font-size="16" letter-spacing="3" fill="'+palette[2]+'">WHAT&apos;S ON IN TASMANIA</text>'+
  '<text font-family="Arial,Helvetica,sans-serif" font-size="'+font+'" font-weight="800" fill="white">'+title+'</text>'+
  '<path d="M72 535H640" stroke="'+palette[2]+'" stroke-width="2" opacity=".6"/>'+
  '<text x="74" y="582" font-family="Arial,Helvetica,sans-serif" font-size="25" font-weight="700" fill="white">'+esc(formatDate(event?.startDate))+'</text>'+
  '<text x="74" y="623" font-family="Arial,Helvetica,sans-serif" font-size="24" fill="'+palette[2]+'">'+esc(town)+'</text>'+
  '<text x="1133" y="620" text-anchor="end" font-family="Arial,Helvetica,sans-serif" font-size="13" fill="#fff" opacity=".68">TASSIENOW EDITORIAL ART</text>'+
  '</svg>';
}
