# TassieNow image discovery, verification and publishing

## Hard boundary: discovery is not publication
- Discovery queries can use a 350 m radius (up to 500 m when requested). Nearby images are **leads, never proof** that a pictured business is the listing.
- File names are not mandatory: original Commons ObjectName, ImageDescription and Categories can establish exact place identity. Published market/food photos additionally need their exact town in original metadata.
- Distinctive name words plus town can place Openverse or geotagged Commons results into the **review queue only**, never automatic publication.
- Do not publish search-engine thumbnails, unlicensed organiser images, Google Maps photographs, other people's social posts, generic same-town buildings or AI-generated substitutes.
- Publishing requires the original file's verified identity, licence allowing commercial reuse (CC BY, CC BY-SA, CC0 or public domain as appropriate), creator credit and licence/source links, or rights-holder permission. Keep original attribution visible on the live page.
- Previously approved imagery takes priority and must survive catalogue refreshes. Do not downgrade an existing real photo.

## Automation
- Daily image enrichment is .github/workflows/images.yml (also runs on image code changes). Commons metadata can publish high-confidence exact-identity matches; weaker geotagged candidates are persisted in src/data/place-media-review.json for separate approval.
- Openverse research (.github/workflows/place-photo-research.yml) scans up to 110 priority listings per pass, saving up to eight candidates per listing. Its index may suggest a licence but is NOT original-source rights verification.
- Official photo-source links identify pages to inspect but cannot be counted as published hero photographs.
- On publication, live HTML/image/credit verification is required. Inspect .github/workflows/verify-published-photos.yml for failures.
- Capture checked counts, rejected/eligible images, queued leads, approved heroes and current fallback coverage separately. A successful GitHub workflow with zero new hero photos is not an image coverage improvement.

## Approval
Open the original image/source page, independently confirm exact venue or landmark and location, check creator and licence/permissions for this specific work, record a factual alt description (including historical date if applicable), then add approved picks through the documented verified-photo path. Never convert a queued candidate to approved merely because it is geotagged, has a title match or carries indexed licence metadata.
