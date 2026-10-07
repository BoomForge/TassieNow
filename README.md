# TassieNow

TassieNow is a zero-cost-first Tasmanian tourism and local discovery site for locals and visitors. It combines a broad place catalogue, current events, region/town landing pages and live-use discovery tools while keeping source provenance and quality checks in the data pipeline.

## Current stage

TassieNow is past the bootstrap-MVP stage. The site now maintains a large generated catalogue with automated discovery, enrichment, validation, ranking, image upgrades, event refreshes and search-index submission.

The project deliberately avoids a paid database or paid discovery API while traffic and product fit are still being proven.

## Discovery sources

TassieNow uses multiple independent sources rather than treating any single directory as canonical.

### Places

- OpenStreetMap / Overpass for broad geographic discovery.
- Wikidata for independent attraction, museum, gallery, wildlife, beach and nature-reserve discovery.
- Parks Tasmania for official parks and walking information.
- Official venue/business pages during enrichment for websites, contact details, hours and schedule information.
- Wikimedia Commons / Wikidata imagery where licensing and provenance can be preserved.

### Events and tickets

- Tasmanian council event calendars.
- Discover Tasmania / Tourism Tasmania public event pages.
- Humanitix public event discovery.
- Ticketmaster public event discovery.
- Eventbrite public event discovery where the public page is accessible.
- Moshtix Tasmania public event discovery.
- Ticketek Hobart/Tasmania-context public event discovery.
- Direct ticket/booking links found on official event pages, including Humanitix, Eventbrite, Ticketmaster, TryBooking, Moshtix and Ticketek.

Ticket enrichment is intentionally separate from the core event record. If a ticket provider is unavailable or changes markup, existing verified events remain intact.

Event records can include `ticketUrl`, `ticketProvider`, `priceFrom`, `priceTo`, `priceCurrency`, `availability`, `bookingRequired` and `ticketLastChecked` when those facts can be recovered safely.

## Live-use features

The public site includes:

- Search across names, towns, regions and categories.
- Region and town landing pages.
- Kids, Free, Rainy Day, Markets, Nature, Food & Produce, Today and This Weekend discovery views.
- Near Me sorting using browser geolocation only after the visitor requests it.
- Surprise Me random discovery.
- Event detail pages with ticket/booking information where available.
- SEO-friendly place, event, town and region pages plus a generated sitemap.

## Automation

GitHub Actions maintains the data and site:

- `discover.yml` performs the multi-source catalogue refresh, recovery, enrichment, ranking, image pass and audit.
- `events.yml` refreshes event and ticket sources four times per day.
- `catalogue-quality.yml` performs deeper listing-quality enrichment.
- `images.yml` upgrades licensed listing imagery.
- `indexnow.yml` submits updated URLs for supported search engines.
- `quality.yml` syntax-checks automation, validates data and builds the site on pushes and pull requests.
- `automation-health.yml` records a persistent heartbeat when GitHub's scheduler actually executes, so unattended automation can be audited rather than assumed.
- `promote.yml` selects one useful TassieNow discovery, place or event each day and can publish it to Bluesky when the repository secrets are configured.

The site exposes two Atom feeds:

- `/feed.xml` — the broader recently-updated places/events feed.
- `/promotion-feed.xml` — one deterministic, social-friendly promotion item per day for RSS/Atom syndication tools such as IFTTT.

### Promotion automation

The daily promotion workflow runs at `21:30 UTC`, which lands in the Tasmanian morning year-round (about 07:30 AEST / 08:30 AEDT).

Bluesky publishing is optional and uses the official AT Protocol password-session flow intended for bots/scripts. Configure these repository secrets:

- `BLUESKY_HANDLE` — the Bluesky handle that should publish TassieNow posts.
- `BLUESKY_APP_PASSWORD` — an app password generated for that account. Do not use the account's main password.

When either secret is missing the workflow exits successfully without posting. The publisher checks the account's recent records and skips a promotion if the same campaign URL has already been posted, so rerunning the workflow is safe.

The promotion selector intentionally rotates between fresh events, high-quality places and useful discovery pages instead of posting every catalogue change. Links carry UTM campaign parameters so future analytics can separate automated promotion from organic traffic.

All data-writing workflows use the shared `tassienow-data-writes` concurrency group to avoid overlapping commits.

Expired active events are pruned using the Tasmania/Hobart date before every production build as a safety net. The event refresh also removes expired records normally, so stale event pages are not dependent on a scheduled workflow having run successfully that day.

## Catalogue audit

Run:

```bash
npm run audit:data
```

This generates `src/data/catalogue-audit.json` with current coverage metrics including:

- public and suppressed place counts
- source mix
- region and town coverage
- non-fallback image coverage
- gallery coverage
- website, schedule and official-source coverage
- active event count
- ticket-link and price coverage
- event source and ticket-provider mix

The audit is regenerated by catalogue and event automation so catalogue quality can be measured instead of judged by raw file size.

## Local development

Requires Node.js 22+.

```bash
npm install
npm run dev
```

Quality/build check:

```bash
npm run build
```

Refresh event and ticket data manually:

```bash
npm run refresh:events
```

## Cloudflare Pages deployment

Use:

- **Production branch:** `main`
- **Framework preset:** Astro
- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Root directory:** repository root

Cloudflare Pages rebuilds the public site after changes land on `main`.

### Launch measurement and search verification

The public layout supports two optional Cloudflare Pages environment variables:

- `PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN` — loads the Cloudflare Web Analytics beacon when a manual token is used. If Pages Web Analytics automatic injection is enabled in the Cloudflare dashboard, leave this unset to avoid a duplicate beacon.
- `PUBLIC_GOOGLE_SITE_VERIFICATION` — renders Google's `google-site-verification` meta tag so Search Console ownership can be verified without another code change.

Cloudflare Pages can also enable Web Analytics through the project's **Metrics → Web Analytics** control, which injects the beacon automatically on deployment.

## Data model

Canonical data lives in:

- `src/data/places.json`
- `src/data/events.json`
- `src/data/parks-walks.json`
- `src/data/place-overrides.json`
- `src/data/catalogue-audit.json` when generated
- `src/data/automation-health.json`

Run `npm run validate:data` to catch missing fields, duplicate slugs, invalid URLs, invalid ticket/price metadata and obviously non-Tasmanian coordinates before deployment.

## Principles

- Keep hosting and discovery costs at zero until demand justifies spending.
- Prefer portable data and explicit provenance over platform lock-in.
- Use several independent discovery sources and deduplicate them into one catalogue.
- Keep factual listing data separate from marketing copy.
- Do not scrape Google Maps or copy business marketing text.
- Preserve existing healthy records when an external discovery source has a partial outage.
- Fail soft when optional enrichment sources are unavailable.
- Keep basic business inclusion free; future monetisation should sit around discovery rather than gatekeeping it.
