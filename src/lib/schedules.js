const dayNumber = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };

// Dates are calendar days in Hobart, represented at UTC noon for stable formatting.
export function upcomingScheduleDates(schedule, today, limit = 8) {
  if (!schedule?.frequency) return [];
  const start = new Date(`${today}T12:00:00Z`);
  const wantedDays = new Set((schedule.daysOfWeek || []).map(day => dayNumber[day]));
  const explicit = new Set(schedule.dates || []);
  const excluded = new Set(schedule.excludedDates || []);
  const dates = [];
  for (let offset = 0; offset < 366 && dates.length < limit; offset++) {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + offset);
    const iso = date.toISOString().slice(0, 10);
    if (excluded.has(iso)) continue;
    const allowedMonth = !schedule.excludedMonths?.includes(date.getUTCMonth() + 1);
    const weekday = wantedDays.has(date.getUTCDay());
    const ordinal = Math.ceil(date.getUTCDate() / 7);
    const regular = allowedMonth && (
      schedule.frequency === 'daily' ||
      (schedule.frequency === 'weekly' && weekday) ||
      (schedule.frequency === 'monthly' && weekday && schedule.weeksOfMonth?.includes(ordinal))
    );
    if (explicit.has(iso) || regular) dates.push(date);
  }
  return dates;
}
