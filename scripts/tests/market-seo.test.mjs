import test from 'node:test';
import assert from 'node:assert/strict';
import { marketCopy, marketSeoTitle, marketSeoDescription, tasmaniaDate } from '../../src/lib/market-seo.mjs';

const verified = {
  name: 'New Norfolk Market', town: 'New Norfolk',
  categories: ['Markets'], summary: 'Weekly town-centre market in the Derwent Valley.',
  schedule: { frequency: 'weekly', daysOfWeek: ['Saturday'], startTime: '08:00', endTime: '14:00', sourceUrl: 'https://example.org/official' }
};

test('verified recurring market uses real opening hours for its title', () => {
  assert.equal(marketSeoTitle(verified), 'New Norfolk Market – Saturdays 8am–2pm | TassieNow');
  assert.match(marketSeoDescription(verified, '2026-10-12'), /New Norfolk.*market dates.*New Norfolk, Tasmania/);
});
test('never invent hours from an irregular market schedule', () => {
  assert.equal(marketSeoTitle({...verified, schedule:{frequency:'irregular',dates:['2026-10-11']}}),
    'New Norfolk Market – Market Dates & Location | TassieNow');
});
test('only expired next-session claims change, without inventing a recurrence', () => {
  const text = 'Lunawanna market. Confirmed next session: 11 October 2026, 9 am to 2 pm. Recurrence awaits confirmation.';
  assert.equal(marketCopy(text,'2026-10-11'),text);
  assert.equal(marketCopy(text,'2026-10-12'),
    'Lunawanna market. Next market session awaiting organiser confirmation. Recurrence awaits confirmation.');
  assert.equal(marketCopy('Every Saturday, 8 am–2 pm','2026-10-12'), 'Every Saturday, 8 am–2 pm');
});
test('Hobart time controls the date across UTC calendar changes',()=>{
  assert.equal(tasmaniaDate(new Date('2026-10-11T14:30:00Z')),'2026-10-12');
});
