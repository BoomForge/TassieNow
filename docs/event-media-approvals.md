# Event photograph and artwork approvals

TassieNow can now use four forms of relevant event imagery, but a public website displaying an image does **not** establish permission for TassieNow to re-publish it.

| Image type | What can be shown | Public disclosure |
| --- | --- | --- |
| `event-photo` | Verified image of the actual advertised event | Credit and licence |
| `official-artwork` | Organiser-authorised artwork, poster or banner for the named event | Event artwork and credit |
| `historical-event` | A past edition of the same event series | Original year and "Previous edition" |
| `contextual` | Verified image of the actual named venue, not the event | "Venue image" and contextual caption |

Wikimedia Commons content is eligible only when the file identifies the correct subject and the image has a suitable licence that permits public commercial use. Creative Commons BY, BY-SA, CC0 and public domain are supported. Attribution and source links remain attached to each published photograph. NC and ND restrictions are not silently treated as general permission.

## Approving an organiser photograph

Discovered official-site assets are saved in `src/data/event-media-review.json` with `rights: "permission-needed"` and **are not published**.

When the organiser or copyright owner gives explicit permission to republish a specific image on TassieNow (including commercially supported pages), update **that particular candidate** in the queue. Preserve the original URL and sourcePage.

Example *shape only* (not an actual grant):

```json
{
  "url": "https://organiser.example/event-hero.jpg",
  "sourcePage": "https://organiser.example/events/example-event",
  "rights": "granted",
  "eventIdentityVerified": true,
  "imageType": "official-artwork",
  "credit": "Rights holder's required credit",
  "permission": {
    "grantedBy": "Confirmed rights holder",
    "verifiedAt": "2026-10-11",
    "evidenceUrl": "https://organiser.example/permission-record",
    "scope": "TassieNow website including commercial pages"
  }
}
```

The permission evidence URL must identify the actual permission record; a generic organiser homepage does not count. For historical images, also supply `historicalYear` (integer), `caption` explicitly mentioning the original year and that it is not from the current edition, and `imageType: "historical-event"`. For venue photos, use `imageType: "contextual"` and a caption saying they do not depict the advertised event.

The next normal events or image research run will apply these approved candidates to matching active event slugs, run validation and commit eligible improvements through the existing rebase-safe publication process. Discovery updates append new candidates without resetting existing review decisions.

**Do not** mark images approved merely because they are on ticket providers, government websites, media pages or event organisers' public sites. Avoid copying private correspondence into the public repository; request a public permission reference or an appropriately documented rights grant before marking a candidate as approved.

## Operational acceptance

A research run can successfully discover 200+ previews and publish zero images. Treat these as different outcomes. Confirm `src/data/events.json`, the freshly regenerated `src/data/catalogue-audit.json`, and the actual public event-card/detail pages before reporting a coverage gain. Correctly labelled older-edition photos do not become 2026 photographs just because they illustrate a 2026 event.
