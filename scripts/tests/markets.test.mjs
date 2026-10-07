import test from 'node:test';
import assert from 'node:assert/strict';
import { upcomingScheduleDates } from '../../src/lib/schedules.js';
import { isMarketEvent } from '../../src/lib/market-category.js';

const dates = (schedule, today, limit) => upcomingScheduleDates(schedule, today, limit).map(date => date.toISOString().slice(0, 10));
test('first and third Sundays include only the published monthly market days', () => {
  assert.deepEqual(dates({ frequency: 'monthly', daysOfWeek: ['Sunday'], weeksOfMonth: [1, 3] }, '2026-10-07', 3), ['2026-10-18', '2026-11-01', '2026-11-15']);
});
test('Deloraine skips closed months and includes the extra Christmas market', () => {
  assert.deepEqual(dates({ frequency: 'monthly', daysOfWeek: ['Saturday'], weeksOfMonth: [1], excludedMonths: [1, 11], dates: ['2026-12-19'] }, '2026-10-07', 3), ['2026-12-05', '2026-12-19', '2027-02-06']);
});
test('Lilydale uses its actual 2026 dates, without inventing a monthly recurrence', () => {
  assert.deepEqual(dates({ frequency: 'irregular', dates: ['2026-09-13', '2026-12-06'] }, '2026-10-07', 8), ['2026-12-06']);
});
test('weekly schedules retain their behaviour and honour exceptions', () => {
  assert.deepEqual(dates({ frequency: 'weekly', daysOfWeek: ['Saturday'], excludedDates: ['2026-10-17'] }, '2026-10-07', 2), ['2026-10-10', '2026-10-24']);
});
test('market classification ignores substring noise and unrelated titles', () => {
  for (const name of ['Queen Victoria Community Market', 'Second Glance Market', 'Makers Markets', 'Marketplace']) assert.equal(isMarketEvent(name), true);
  for (const name of ['Marketing workshop', 'Supermarket tour', 'Jack Jumper and Jewels school holiday clinics', 'In Conversation with Monica McInerney']) assert.equal(isMarketEvent(name), false);
});
