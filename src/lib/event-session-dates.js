// An organiser's season date range is not evidence of an event every day.
// Fail closed for long-running series without a verified session schedule.
const DAY={Sunday:0,Monday:1,Tuesday:2,Wednesday:3,Thursday:4,Friday:5,Saturday:6};
const isoDay=s=>/^20\d{2}-\d{2}-\d{2}$/.test(String(s||''))?new Date(s+'T12:00:00Z'):null;
const dayIndex=s=>isoDay(s)?.getUTCDay()??-1;
const civilDiff=(a,b)=>Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/86400000);
function scheduleFor(event){
 if(event.schedule && typeof event.schedule==='object')return event.schedule;
 // First-party organiser evidence, not derived from date ranges.
 if(event.name==='Franklin Movie Nights')return{frequency:'monthly',daysOfWeek:['Sunday'],weeksOfMonth:[1]};
 if(event.name==='Rock and Rhyme at Huonville Library')return{frequency:'weekly',daysOfWeek:['Wednesday']};
 return null;
}
export function eventOccursOnLocalDay(event,day){
 if(!isoDay(day)||!isoDay(event?.startDate)||!isoDay(event?.endDate))return false;
 if(day<event.startDate||day>event.endDate)return false;
 const schedule=scheduleFor(event);
 const span=civilDiff(event.startDate,event.endDate);
 if(schedule?.sessionDates?.length)return schedule.sessionDates.includes(day);
 if(schedule?.frequency==='daily')return true;
 if(schedule?.frequency==='weekly'||schedule?.frequency==='monthly'){
  const idx=dayIndex(day);
  const days=(schedule.daysOfWeek||[]).map(d=>DAY[d]).filter(x=>x!==undefined);
  if(!days.includes(idx))return false;
  const week=Math.floor((Number(day.slice(8,10))-1)/7)+1;
  if(schedule.frequency==='monthly' && schedule.weeksOfMonth?.length && !schedule.weeksOfMonth.includes(week))return false;
  if(schedule.frequency==='weekly' && Number(schedule.interval)>1 &&
      Math.floor(civilDiff(event.startDate,day)/7)%Number(schedule.interval)!==0)return false;
  return true;
 }
 // Days-long festivals and exhibitions are normally continuous; an entire
 // month/season isn't a daily event merely because it has start and end dates.
 return span<=21 || event.continuous===true;
}
export function eventOccursWithin(event,from,to){
 if(!isoDay(from)||!isoDay(to)||to<from||civilDiff(from,to)>7)return false;
 for(let day=from;day<=to;){
  if(eventOccursOnLocalDay(event,day))return true;
  const d=isoDay(day);d.setUTCDate(d.getUTCDate()+1);day=d.toISOString().slice(0,10);
 }
 return false;
}
