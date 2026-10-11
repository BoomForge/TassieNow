# TassieNow — free image-source aggregation

## Source order
1. Preserve approved existing hero and gallery photographs across discovery.
2. Use exact Wikidata P18 / Commons categories and properly licensed Commons search matches for automatic publishing.
3. Use specific Commons photo picks checked for the correct place, photographer, original licence, source, and time of capture.
4. Independently query the free Openverse API for missing market, food and place heroes. **Save leads for review; do not auto-publish Openverse search results.**
5. Keep clearly designed category artwork when no independently verifiable photograph exists.

## Why Openverse is research-only
Openverse indexes third-party metadata. A claimed open licence or title in a search result does **not** prove the original source licensed that particular photograph or that the photo shows the exact listed business. The bounded new research workflow records eligible leads in `src/data/place-media-review.json` with photographer, claimed licence, original source URL and match evidence. Every lead has `rights: independent-verification-needed` and `identity: candidate-not-verified`.

Before publication, review the **original** linked photo page, establish the photographer/licence and commercial re-use rights, verify that the place or event and locality are correct, and record a specific description. Only then can an owner-authorised verified image be added to `scripts/discover/lib/verified-photo-picks.mjs` or another documented source-verification route. If the photograph depicts a historic edition, say so in alt text or caption. Never change `rights` to `granted` merely because Openverse supplied a licence field.

## Schedule and cost
- `.github/workflows/place-photo-research.yml`: daily at 21:31 UTC, and when the research code changes; independent of the long-running catalogue writer queue.
- **Free, anonymous API**, no Google billing, no new keys, no hosted database, no package dependency.
- At most 14 listings per scheduled pass, with two bounded queries per listing, 1.5s request pacing, 429/503 handling, timeouts and retries.
- Rotate research across missing markets, food businesses and other places, while keeping market and food quotas.
- Store run reports in a GitHub Actions artifact, and preserve only source candidates in GitHub. Existing reviewer decisions must survive repeated discovery and concurrent pushes.
- `check-operations.mjs` watches the new scheduled job for failure or staleness.
- The user-facing coverage report counts **actual catalogue images**, never research leads.

## If it fails
Inspect the latest `openverse-place-photo-research` artifact and `reports/openverse-photo-research.json` inside the workflow. HTTP errors and rate limiting are reported; a majority of failed requests causes workflow failure. A missing service never downgrades an existing photograph. Do not interpret a successfully completed search as proof that more images have been published. After any independently approved image is published, verify its real website detail page with `verify-published-photos.yml`.

## Next optional source adapters
An independent, evidence-driven adapter could later index CC photographs in local-government or cultural-heritage open-data catalogues, where licence and subject identity can be checked from the issuing institution. Do not scrape Google Maps reviews or copy organiser-site photos without permission.
