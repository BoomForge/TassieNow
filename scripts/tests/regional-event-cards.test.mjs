import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const importer = fs.readFileSync(new URL('../discover/public-events.mjs', import.meta.url), 'utf8');
const start = importer.indexOf('function regionalListingEvents');
const end = importer.indexOf('function anchorEvents', start);
assert.ok(start >= 0 && end > start, 'regional event parser must exist');
const source = importer.slice(start, end);
const monthNumber = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
const iso = (day, month, year) => monthNumber[month]
  ? [year, String(monthNumber[month]).padStart(2,'0'), String(day).padStart(2,'0')].join('-') : null;
const clean = (s) => String(s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
function dateRange(s) {
  const m = s.match(/\b(\d{1,2})\s+([A-Za-z]+)\s+(20\d{2})/);
  return m ? { startDate: iso(m[1],m[2],m[3]), endDate: iso(m[1],m[2],m[3]) } : null;
}
const context = {
  URL, decode: (s) => s, clean,
  plausibleName: (s) => s.length >= 4,
  titleFromEventUrl: (s) => new URL(s).pathname.split('/').filter(Boolean).at(-1).replaceAll('-', ' '),
  finalName: clean,
  dateRange,
  validRange: (date) => Boolean(date?.startDate && date?.endDate && date.endDate >= '2026-10-08'),
  makeEvent: (event) => event,
  iso
};
vm.createContext(context);
vm.runInContext(source + '\nthis.parseRegional = regionalListingEvents;', context);
const parse = context.parseRegional;

test('East Coast event cards exclude undated monthly markets and capture dated events', () => {
  const html = '<a href="/atdw_events/monthly-market/">Monthly Market</a>MONTHLY '
    + '<a href="/atdw_events/feast/">Great Feast</a>24th Oct 2026 '
    + '<a href="/atdw_events/festival/">Bicheno Festival</a>21st Nov 2026 to 22nd Nov 2026';
  const actual = parse(html, {name:'East Coast Tasmania', url:'https://eastcoasttasmania.com/events/',town:'St Helens',region:'East Coast'});
  assert.equal(actual.length,2);
  assert.equal(actual[0].startDate,'2026-10-24');
  assert.equal(actual[1].startDate,'2026-11-21');
  assert.equal(actual[1].endDate,'2026-11-22');
});
test('King Island event card recognises explicitly dated island events', () => {
  const html = '<a href="/events/king-island-pro-am/">King Island Pro-Am 15 Jan 2027 – 17 Jan 2027</a>';
  const actual = parse(html,{name:'King Island Tourism',url:'https://kingisland.org.au/events/',town:'Currie',region:'King Island'});
  assert.equal(actual.length,1);
  assert.equal(actual[0].startDate,'2027-01-15');
  assert.equal(actual[0].endDate,'2027-01-17');
});
test('Regional parser excludes external links and undated events', () => {
  const html = '<a href="https://example.org/events/fake/">Other event 24 Oct 2026</a>'
    + '<a href="/atdw_events/undated/">A monthly event</a>';
  const actual = parse(html,{name:'East Coast Tasmania',url:'https://eastcoasttasmania.com/events/',town:'St Helens',region:'East Coast'});
  assert.equal(actual.length,0);
});
