import { upcomingScheduleDates } from './schedules.js';
export function hobartDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {timeZone: 'Australia/Hobart', year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}
export function weekendDates(today) {
  const start = new Date(`${today}T12:00:00Z`);
  const day = start.getUTCDay();
  start.setUTCDate(start.getUTCDate() + (day === 0 ? -1 : (6 - day + 7) % 7));
  const end = new Date(start); end.setUTCDate(start.getUTCDate()+1);
  return [start.toISOString().slice(0,10), end.toISOString().slice(0,10)];
}
const normal = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g,'');
export function marketOccurrences(places, events, start, end) {
  return places.filter(p => p.status === 'active' && p.visibility !== 'suppressed' && p.categories?.includes('Markets') && p.schedule?.sourceUrl)
    .flatMap(place => upcomingScheduleDates(place.schedule, start, 366)
      .map(date => date.toISOString().slice(0,10)).filter(date => date <= end)
      .filter(date => !events.some(event => event.status === 'active' && event.visibility !== 'suppressed' && normal(event.name) === normal(place.name) && normal(event.town) === normal(place.town) && event.startDate <= date && event.endDate >= date))
      .map(occurrenceDate => ({...place, occurrenceDate})))
    .sort((a,b) => a.occurrenceDate.localeCompare(b.occurrenceDate) || a.name.localeCompare(b.name));
}
