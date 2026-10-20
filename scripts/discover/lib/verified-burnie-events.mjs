const VERIFIED_BURNIE_EVENTS = new Map([
  // Source rechecked 20 October 2026: council event lists Sunday 15 November,
  // 10 am–1 pm at the Burnie Waste Transfer Station. Preserve across pagination gaps.
  ['https://www.burnie.tas.gov.au/Community/Whats-On-Events/2026/Free-Household-Chemical-Disposal', {
    name:'Free Household Chemical Disposal',
    town:'Burnie',region:'North West',startDate:'2026-11-15',endDate:'2026-11-15',
    startTime:'10:00',endTime:'13:00',
    venue:'Burnie Waste Transfer Station',
    address:'289 Mooreville Road, Burnie TAS 7320',
    summary:'Free household chemical disposal at Burnie Waste Transfer Station, 289 Mooreville Road, on Sunday 15 November 2026 from 10:00 am to 1:00 pm. Check Burnie City Council for accepted materials and any changes.'
  }],
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
  ['https://www.burnie.tas.gov.au/Community/Whats-On-Events/2026/Book-Market-Burnie-Emu-Bay-Lions-Club', {
    town: 'Wivenhoe',
    region: 'North West',
    startDate: '2026-11-07',
    endDate: '2026-11-07',
    venue: 'Wivenhoe Shed, Smith and Angelsea Streets, Wivenhoe',
    summary: 'Book Market by the Burnie Emu Bay Lions Club at Wivenhoe Shed, Smith and Angelsea Streets, Wivenhoe, on Saturday 7 November 2026 from 10:00 am to 12:00 pm. Entry is free.'
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
  }],
  ['https://www.burnie.tas.gov.au/Community/Whats-On-Events/2026/Intro-to-Computing-at-Burnie-Library', {"startDate":"2026-10-21","endDate":"2026-10-21","startTime":"09:30","endTime":"14:30","venue":"Burnie Library, 30 Alexander Street, Burnie","address":"30 Alexander Street, Burnie TAS 7320"}],
  ['https://www.burnie.tas.gov.au/Community/Whats-On-Events/2026/In-Conversation-with-Monica-McInerney', {"startDate":"2026-10-27","endDate":"2026-10-27","startTime":"18:00","endTime":"20:00","venue":"Not Just Books, 40 Wilson Street, Burnie","address":"40 Wilson Street, Burnie TAS 7320","priceFrom":10,"priceTo":10,"priceCurrency":"AUD"}],
  ['https://www.burnie.tas.gov.au/Community/Whats-On-Events/2026/Tuning-into-Kids', {"startDate":"2026-10-28","endDate":"2026-10-28","startTime":"11:00","endTime":"13:00","venue":"The Salvation Army, 99 Wilson Street, Burnie","address":"99 Wilson Street, Burnie TAS 7320"}],
  ['https://www.burnie.tas.gov.au/Community/Whats-On-Events/2026/Second-Glance-Market', {"startDate":"2026-10-31","endDate":"2026-10-31","startTime":"12:00","endTime":"15:00","venue":"Civic Centre – Burnie Arts, 77–79 Wilmot Street, Burnie","address":"77–79 Wilmot Street, Burnie TAS 7320","priceFrom":0,"priceTo":0,"priceCurrency":"AUD"}],
  ['https://www.burnie.tas.gov.au/Community/Whats-On-Events/2026/Diwali-Festival-of-Light-in-Burnie', {"startDate":"2026-11-01","endDate":"2026-11-01","startTime":"17:00","endTime":"22:00","venue":"Marist Regional College – The Harcombe Centre","address":"Paraka Street entrance, Burnie TAS 7320","priceFrom":10,"priceCurrency":"AUD"}],
  ['https://www.burnie.tas.gov.au/Community/Whats-On-Events/2026/Harness-Racing-Club-Season', {"startDate":"2026-11-06","endDate":"2026-11-06","startTime":"18:00","endTime":"23:59","venue":"Burnie Harness Racing Club, 1 Pearl Street, Wivenhoe","address":"1 Pearl Street, Wivenhoe TAS 7320","town":"Wivenhoe"}],
  ['https://www.burnie.tas.gov.au/Community/Whats-On-Events/2026/Burnie-Surf-Club-Nipper-Open-Day', {"startDate":"2026-11-08","endDate":"2026-11-08","startTime":"09:45","endTime":"12:00","venue":"West Beach, Burnie","address":"West Beach, Burnie TAS 7320"}],
  ['https://www.burnie.tas.gov.au/Community/Whats-On-Events/2026/National-Recycling-Week', {"startDate":"2026-11-09","endDate":"2026-11-15","startTime":"10:00","endTime":"16:00","venue":"Burnie Council City Offices, 80 Wilson Street, Burnie","address":"80 Wilson Street, Burnie TAS 7320"}],
  ['https://www.burnie.tas.gov.au/Community/Whats-On-Events/2026/In-Conversation-with-Alan-Carter', {"startDate":"2026-11-10","endDate":"2026-11-10","startTime":"14:30","endTime":"16:00","venue":"Europa Cafe, 1/23 Cattley Street, Burnie","address":"1/23 Cattley Street, Burnie TAS 7320","priceFrom":10,"priceTo":10,"priceCurrency":"AUD"}],
  ['https://www.burnie.tas.gov.au/Community/Whats-On-Events/2026/In-Conversation-with-Peter-FitzSimons', {startDate:'2026-11-12',endDate:'2026-11-12',startTime:'18:00',endTime:'20:00',venue:'South Burnie Bowls Club, 2 Hale Street, Burnie',address:'2 Hale Street, Burnie TAS 7320',priceFrom:10,priceTo:10,priceCurrency:'AUD'}]
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

/**
 * Safeguard one independently confirmed council session against disappearance
 * from the short, paginated list feed. A previous-date duplicate is corrected
 * by applyVerifiedBurnieEvent and deduplicated during normal event sanitisation.
 * Never bring the record back after its official end date.
 */
export function restoreVerifiedBurnieEvents(events,today){
  if(!Array.isArray(events))return events;
  const official='https://www.burnie.tas.gov.au/Community/Whats-On-Events/2026/Free-Household-Chemical-Disposal';
  const date='2026-11-15';
  if(today>date||events.some(event=>event.eventUrl===official))return events;
  const event={
    slug:'free-household-chemical-disposal-2026-11-15-burnie',
    name:'Free Household Chemical Disposal',
    town:'Burnie',region:'North West',startDate:date,endDate:date,
    startTime:'10:00',endTime:'13:00',
    venue:'Burnie Waste Transfer Station',
    address:'289 Mooreville Road, Burnie TAS 7320',
    categories:['Events','Free'],
    summary:'Free household chemical disposal at Burnie Waste Transfer Station, 289 Mooreville Road, on Sunday 15 November 2026 from 10:00 am to 1:00 pm. Check Burnie City Council for accepted materials and any changes.',
    eventUrl:official,sourceUrl:official,sourceName:'Burnie City Council',
    image:{url:'/images/categories/events.svg',alt:'Free Household Chemical Disposal event category artwork',
      attribution:'TassieNow',license:'Site artwork',isFallback:true},
    status:'active',lastChecked:'2026-10-20'
  };
  return [...events,event];
}
