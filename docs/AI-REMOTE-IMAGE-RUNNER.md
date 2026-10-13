# Daily AI verified remote image publishing

This is the durable contract for the **one daily ChatGPT/TassieNow AI image research run**. The GitHub Actions jobs alone are not an AI browsing agent. ChatGPT can inspect Google results or original sites as leads but may only commit **source-verified reusable media**.

## Input and output
- Target repository: `BoomForge/TassieNow`, branch `main`.
- Current verified feed: `src/data/approved-remote-images.json` with `{"version":1,"approved":[]}`. Never overwrite previous approvals.
- Candidate queues: `src/data/event-media-review.json`, `src/data/place-media-review.json`, `src/data/auto-photo-source-links.json`.
- Prioritize upcoming events, markets and food businesses without real image heroes, then other public listings.
- Research 10-20 *different* missing images daily, attempting 2-5 high-confidence reusable photos. Keep a truthful report even when none qualify.
- Confirm original source metadata explicitly identifies the exact listing and town (and event edition or contextual use), the photograph itself, original creator, exact commercially reusable licence, image URL and source page. Check the original URL is directly loadable and looks like a real image. Site hosting is **not** necessary.
- The web page carrying an image, an OG preview, hotlink ability, a third-party CDN, being a government website, Google or Instagram visibility or a photographer credit **alone** does NOT grant reuse rights. Do not label a merely existing image as CC or rights-approved. Do not assume the organiser grants image rights.
- If actual source confirms CC BY, CC BY-SA, CC0 or a specifically evidenced public-domain basis, append the exact, fully evidenced record below. The original remote photo remains on its external host.
- For individually authorised organiser images, follow the existing permission-grant process; do not fabricate consent.
- Never publish unrelated photos; historical/event-context photos must be explicitly labelled; never displace an existing real photo.
- Never store photographs in GitHub or use a paid API. After updating the feed on GitHub, verify commit and rely on the existing `images.yml` push hook to check HTTP and publish the image; check the workflow and the resulting catalogue audit. A feed commit is **not** a published photograph.
- Failed research or rights blockers remain review-only. Do not retry blindly, and keep a dated report with checked, verified, blocked and actually published counts. No invented positive counts.

## Feed example (structure only — not a real grant)
```json
{
  "version":1,
  "approved":[{
    "kind":"place","slug":"example-market","name":"Example Market","town":"Hobart",
    "image":{
      "url":"https://example.org/photos/example-market.jpg",
      "sourceUrl":"https://example.org/licensed-photo-page",
      "alt":"Example Market stalls in Hobart",
      "attribution":"Named original creator",
      "license":"CC BY 4.0",
      "licenseUrl":"https://creativecommons.org/licenses/by/4.0/"
    },
    "evidence":{
      "status":"verified-open-licence",
      "rightsPage":"https://example.org/licensed-photo-page",
      "checkedAt":"2026-10-13",
      "identity":"Original image explicitly depicts Example Market in Hobart",
      "rightsDetails":"Original rights statement explicitly identifies the creator and licenses this particular image for commercial reuse as CC BY 4.0."
    }
  }]
}
```

## Publication contract
The existing `.github/workflows/images.yml` checks each eligible new image using a bounded HTTPS request and image Content-Type, then merges exact identity matches into `places.json` or `events.json`. The safe rebase phase runs the same verifier again on fresh `main` before committing. No image bytes are downloaded into repository files or Cloudflare. Published image data uses `useMode:external-embed`, `sourceMethod:ai-verified-remote`, credit/licence/source and match evidence. If the source blocks direct access, it is rejected and logged, not silently counted as recovered.

Read `reports/remote-image-publication.json` from the run artifact for outcome counts, then verify a public listing actually renders the image and licence/credit. Do not claim success solely from a green workflow.
