import fs from 'node:fs/promises';

const FILE = new URL('../src/data/events.json', import.meta.url);
function tasDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Hobart', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
const today = tasDate();
const events = JSON.parse(await fs.readFile(FILE, 'utf8'));
const kept = events.filter((event) => event.status !== 'active' || !event.endDate || event.endDate >= today);
const removed = events.filter((event) => event.status === 'active' && event.endDate && event.endDate < today);
if (removed.length) {
  await fs.writeFile(FILE, `${JSON.stringify(kept, null, 2)}\n`);
  console.log(`Pruned ${removed.length} expired active event(s) before build: ${removed.map((event) => event.name).join('; ')}`);
} else {
  console.log('No expired active events to prune.');
}
