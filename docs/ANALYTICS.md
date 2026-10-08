# TassieNow privacy-first measurement

## Counters

The first-party page script emits small same-origin beacons for page views, search/filter changes and explicitly labelled outbound business or booking links. The Pages Function aggregates by UTC day, event type, page route and a controlled detail label.

The counter table contains **no search terms, full destination URLs, precise geolocation, IP addresses or visitor identifiers**. DNT/GPC signals disable the first-party collection. No cookies or third-party tracker are required for these counters.

These are **recorded interactions**, not verified unique visitors, completed purchases or revenue. Browsers and privacy tools may block beacons; reloads and bots can increase counts. For commercial reports do not imply unique human customers or confirmed sales. Apply Cloudflare rate limiting or bot controls to /api/metrics as traffic grows.

## Inspect totals from the owner-controlled Cloudflare D1 console

### Daily visitors/interactions by page
```sql
SELECT day, event_type, page_path, detail, SUM(hits) AS recorded_interactions
FROM discovery_metrics
WHERE day >= date('now','-30 day')
GROUP BY day, event_type, page_path, detail
ORDER BY day DESC, recorded_interactions DESC;
```

### Outbound referrals by listing (informational, not conversions)
```sql
SELECT page_path, detail, SUM(hits) AS outbound_clicks
FROM discovery_metrics
WHERE event_type='outbound' AND day >= date('now','-30 day')
GROUP BY page_path, detail
ORDER BY outbound_clicks DESC;
```

### Sponsored placements
Paid advertising impressions and clicks are stored separately in the existing `ads` table. They are not part of organic discovery ranking or the new generic outbound counts. The current ad impression metric reflects ad selections/API delivery, not independently verified viewable impressions.

## Future partner reports
Use actual reporting ranges and clear labels. A simple monthly report may show impressions/selections from the ad table and counted outbound clicks, but not unique visitors, leads, purchases or sales unless independently verified. A sponsorship badge alone must not influence organic ranking.

## Privacy and retention
Counters are aggregated from creation. No per-user deletion is needed for first-party aggregate data, but review retention and Cloudflare server-log policies separately. Verify the D1 binding in production and test that metrics are flowing before reporting any nonzero figure.
