// Display only verified future "next session" claims. Original source data stays intact.
const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
const nextSessionPattern = /\bConfirmed next session:\s+(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})[^.]*\./gi;

export function tasmaniaDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Hobart', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const part = (type) => parts.find((value) => value.type === type)?.value;
  return [part('year'), part('month'), part('day')].join('-');
}

export function marketCopy(value, today = tasmaniaDate()) {
  return String(value || '').replace(nextSessionPattern, (claim, day, month, year) => {
    const monthNumber = months.indexOf(month.toLowerCase()) + 1;
    const stamp = [year, String(monthNumber).padStart(2, '0'), day.padStart(2, '0')].join('-');
    return stamp < today ? 'Next market session awaiting organiser confirmation.' : claim;
  });
}

const clock = (value) => {
  if (!/^\d{2}:\d{2}$/.test(value || '')) return null;
  const [hours, minutes] = value.split(':').map(Number);
  if (hours > 23 || minutes > 59) return null;
  const hour = hours % 12 || 12;
  return minutes ? hour + ':' + String(minutes).padStart(2, '0') : String(hour);
};

export function marketSeoTitle(place) {
  if (!place.categories?.includes('Markets')) return place.name + ' | TassieNow';
  const schedule = place.schedule;
  const isVerifiedWeekly = schedule?.sourceUrl && schedule.frequency === 'weekly'
    && schedule.daysOfWeek?.length === 1;
  const weekday = isVerifiedWeekly ? schedule.daysOfWeek[0] : '';
  const start = clock(schedule?.startTime);
  const end = clock(schedule?.endTime);
  let detail = 'Market Dates & Location';
  if (isVerifiedWeekly && start && end && /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/.test(weekday)) {
    const suffix = Number(schedule.endTime.slice(0, 2)) < 12 ? 'am' : 'pm';
    const firstSuffix = Number(schedule.startTime.slice(0, 2)) < 12 ? 'am' : 'pm';
    detail = weekday + 's ' + start + firstSuffix + '–' + end + suffix;
  }
  const title = place.name + ' – ' + detail + ' | TassieNow';
  return title.length <= 72 ? title : place.name + ' – Market Info | TassieNow';
}

export function marketSeoDescription(place, today = tasmaniaDate()) {
  const base = marketCopy(place.summary, today).trim();
  const location = [place.town, 'Tasmania'].filter(Boolean).join(', ');
  const text = [base, 'Find market dates, opening hours, location and official updates in ' + location + '.']
    .filter(Boolean).join(' ');
  if (text.length <= 160) return text;
  return text.slice(0, 157).replace(/\s+\S*$/, '') + '…';
}
