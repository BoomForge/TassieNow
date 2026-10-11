# Market photographs — zero Google API billing

TassieNow does **not** need Google Cloud, Google Places API, Maps JavaScript API or a Google billing account for its market-photo experience.

## Two no-fee routes

1. **See visitor photos on Google Maps:** Market cards and detail pages link directly to the market's public Google Maps listing. Visitors browse photos and reviews on Google's own site, with the original authors' attributions. TassieNow does not use Google's developer APIs, proxy, cache, scrape or republish those photos. Opening an ordinary Google Maps link does not generate a Google Maps Platform API charge for TassieNow.
2. **Display licensed photos within TassieNow:** The existing scheduled Commons image discovery searches specifically for the market's name, its Tasmanian town and commercially reusable licensing. Market discovery receives reserved search capacity and can save galleries of up to six rights-cleared photographs. All approved images retain original credits, licences and source links.

**Market organisers and photographers can contribute:** Each market page links to the existing free [Suggest an update](/suggest-update/) form, preselecting its own listing and the image category. Submit a direct photo URL, the original photographer's name, and evidence that its copyright owner permits publication on TassieNow (including commercial site use). Images are reviewed; submitting a link does not authorise automatic publication.

## What this deliberately does not do

- **No Google Cloud project, API key, Maps Platform service, or billing account.**
- No hidden calls to billable Google Places or Maps JavaScript services from TassieNow place detail pages.
- No importing photos from Google Maps reviews into TassieNow's own image cards. Google's content terms restrict scraping, rehosting and republishing without separate rights.
- No pretending an unrelated stock photo depicts a specific market.
- No paid photography provider, subscription or compulsory third-party developer registration.

## Monitoring

Quality CI checks that market HTML contains the free visitor-photo link and image-permission submission path, never paid Maps/Places JavaScript. The existing market-photo audit still tracks the **separate** count of licensed photographs actually in the catalogue; ordinary Google Maps links do not inflate those numbers.

## Useful no-cost discovery sources

- Wikimedia Commons: https://commons.wikimedia.org/
- Openverse: https://openverse.org/ — additional search for CC-licensed media, with **independent licence and source verification required** before use
- Official market organisers willing to grant reuse rights for original promotional photography

If the user later wants a visitor-photo gallery displayed *inside* TassieNow instead of a link to Google, it must come from separately permissioned photographers or an independently licensed source, not free scraping of Google reviews.
