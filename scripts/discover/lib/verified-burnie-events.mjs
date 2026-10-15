const VERIFIED_BURNIE_EVENTS = new Map([
  ['https://www.burnie.tas.gov.au/Community/Whats-On-Events/2026/Pink-Up-Your-Town', {
    startDate: '2026-10-22',
    endDate: '2026-10-22',
    summary: 'PinkUp Burnie in Burnie on Thursday 22 October 2026. The official listing gives 9:00 am to 9:01 am; check the organiser page for current participation details.'
  }],
  ['https://www.burnie.tas.gov.au/Community/Whats-On-Events/2026/Burnie-Ten', {
    startDate: '2026-10-25',
    endDate: '2026-10-25',
    venue: 'Wilson and Cattley Street intersection (north), Burnie',
    summary: 'Burnie Ten in Burnie on Sunday 25 October 2026, 10:00 am to 3:00 pm, starting at the Wilson and Cattley Street intersection (north). Check the official page for current race details.'
  }],
  ['https://www.burnie.tas.gov.au/Community/Whats-On-Events/2026/ACOTAR-6-Midnight-Release-Event', {
    startDate: '2026-10-26',
    endDate: '2026-10-26',
    venue: 'Not Just Books, 40 Wilson Street, Burnie',
    summary: 'ACOTAR 6 Midnight Release Event at Not Just Books, 40 Wilson Street, Burnie, on Monday 26 October 2026 at 10:30 pm. Bookings are essential and the listed cost is $10.',
    priceFrom: 10,
    priceTo: 10,
    priceCurrency: 'AUD',
    bookingRequired: true
  }]
]);

const slugify = value => String(value)
  .normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '').slice(0, 90);

export function applyVerifiedBurnieEvent(event, checkedAt) {
  const override = VERIFIED_BURNIE_EVENTS.get(event?.eventUrl);
  if (!override) return event;
  const corrected = {...event, ...override, lastChecked: checkedAt};
  corrected.slug = slugify(`${corrected.name}-${corrected.startDate}-${corrected.town}`);
  return corrected;
}
