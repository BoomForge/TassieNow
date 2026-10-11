# TassieNow market photos: Google Maps and licensed media

Market imagery uses two separate sources with different rules.

1. **TassieNow licensed images.** The discovery pipeline looks for exact-market imagery on Wikimedia Commons, checks identity and commercial-use licensing, and records photographer and licence. Market listings receive a dedicated share of each photo pass and allow up to six licensed images.
2. **Google visitor photos and reviews.** Market result cards link to Google Maps. Market detail pages offer a prominent "Browse photos on Google Maps" link. If the site's existing \`PUBLIC_GOOGLE_MAPS_API_KEY\` is configured and the relevant Google APIs are enabled, the visitor can explicitly click "Show live Google visitor photos". Only then does the browser request live Google Places data and display the official Google Place Details component with media, reviews and Google's attribution. Search results must exactly match the market name and Tasmanian town or very close known coordinates. Uncertain matches only present the Google Maps link.

Google Places photos are **not** included in \`src/data/places.json\`, scraped from Google reviews, downloaded, cached, or redistributed from TassieNow storage. Places photo references and image URLs expire; Google requires fresh retrieval, photo author credits and Google Maps source links. The official Places UI Kit supplies Google Maps presentation and credits.

## Google configuration

An in-page Google photo viewer depends on the Google Maps JavaScript API, Places API (New), and Places UI Kit being enabled for the project's API key, with Google Cloud billing configured and domain/referrer restrictions. Because every Places search and UI component can generate Google billing charges, the viewer is opt-in, never eagerly loaded as a grid of 30 market photo widgets.

The link to Google Maps is available even without an API key or if the matching place cannot be verified. We do not add API credentials or enable billing automatically.

## Quality

The \`marketPhotoCoverage\` section in \`src/data/catalogue-audit.json\` reports real licensed market hero images, listing count, multi-photo galleries, and known Google Place IDs. Independent CI recomputes totals and fails if the saved audit is inaccurate. Google visitor images do not inflate those copyright-verified media counts.

**Do not** treat finding a photo inside a Google review as permission to copy it to the TassieNow static image catalogue. If organisers provide independently licensed publicity photographs, those can enter the normal review and publishing pipeline.
