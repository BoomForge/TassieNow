# Autonomous original photo source links

This is the **no-billing**, **no-Google-scraping** approach to researching missing
photos without hundreds of owner edits.

- \`auto-photo-sources.yml\` runs twice per day, initially on merge and on demand.
- Each run visits up to 110 existing official listing/organiser websites. Markets
  are prioritized, followed by food businesses, events, then other listings.
- The scan only accepts a page with an identity-matching headline/title and
  a plausible OpenGraph photo or a subject-labelled photo on that actual page.
- It saves **the original page URL** as a clickable text link in
  \`src/data/auto-photo-source-links.json\` (never the image URL as a hero).
- Failures and unmatched pages are logged and retried after 21 days, so one
  inaccessible official site cannot permanently monopolise the scan budget.
- Links are merged forward on the latest main branch; concurrent catalogue,
  event and photo-recovery writes cannot overwrite the sidecar index.
- Place/event pages show the original links alongside free per-listing Google
  Images searches if the actual hero is still missing.
- Manual source links in place records are preserved, displayed and de-duplicated.
- Reports show counts of **linked original pages** separately from the genuine
  licensed hero-image target. Zero copyright licences are assumed from backlinks.

**Limit:** A listing without a known official website/source cannot magically
have a source photo discovered from Google without a Google search interface or
approved search API. It still gets its one-click Google Images link. Direct image
embedding/hosting remains governed by the image-rights validator and existing
free Commons/Wikidata image enrichment workflow.

No Google Cloud billing, subscription or paid service.
