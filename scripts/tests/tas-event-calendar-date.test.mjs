import test from 'node:test';
import assert from 'node:assert/strict';
import { tasEventCalendarDate } from '../discover/lib/tas-event-calendar-date.mjs';

test('morning AEDT Humanitix session never shifts to previous UTC day',()=>{
 assert.equal(tasEventCalendarDate('2026-11-05T09:00:00+11:00'),'2026-11-05');
 assert.equal(tasEventCalendarDate('2026-10-19T09:45:00+11:00'),'2026-10-19');
 assert.equal(tasEventCalendarDate('2026-11-08T19:00:00+11:00'),'2026-11-08');
});
test('UTC instants convert into the Hobart calendar day including DST',()=>{
 assert.equal(tasEventCalendarDate('2026-11-04T22:00:00Z'),'2026-11-05');
 assert.equal(tasEventCalendarDate('2026-07-01T14:00:00Z'),'2026-07-02');
 assert.equal(tasEventCalendarDate('2026-07-01T09:00:00Z'),'2026-07-01');
});
test('date-only or floating local event labels remain unchanged',()=>{
 assert.equal(tasEventCalendarDate('2026-11-05'),'2026-11-05');
 assert.equal(tasEventCalendarDate('2026-11-05T09:00:00'),'2026-11-05');
 assert.equal(tasEventCalendarDate('2026-11-05 09:00'),'2026-11-05');
});
test('invalid calendar dates and impossible times are rejected',()=>{
 for(const s of ['2026-02-30','2026-11-31T09:00:00+11:00','2026-11-05T25:00:00+11:00','2026-11-05T09:99:00','today','','2026-11-05 extra']){
  assert.equal(tasEventCalendarDate(s),null,s);
 }
});
