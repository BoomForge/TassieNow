# Google Images photo research — free, licence-safe workflow

Google is for **finding the photographer's original image**, not supplying a licence to republish a search-result thumbnail.

## In TassieNow admin
1. Open Catalogue and check **Only listings missing a real photograph**. Priority goes to markets, then food listings, then other places.
2. Select a listing. The photo research panel generates source-specific, exact name/town/Tasmania queries:
   - Google Images — visually discover candidates.
   - Google web search restricted to Wikimedia Commons file pages.
   - Google web search restricted to original Flickr photo pages.
   - Listing's website, when recorded.
3. On Google Images, choose **Tools → Usage rights → Creative Commons licences**. This narrows discovery but does not certify reuse rights.
4. Check the **original photo page**, exact subject and town, photographer, licence version, and any conditions. Correctly credit *Title*, *Author*, *Source*, *Licence* (TASL), plus changes when relevant.
5. Add a licensed photo through the existing admin editor with its attribution, licence, original source URL, and meaningful alt text; otherwise use the photo-source suggestion/permission path.
6. Never claim coverage gains until the new hero photo appears on the public listing and its source/credit is visible.

## Permissible rights evidence
- CC BY, CC BY-SA (respect the share-alike condition), CC0 and genuine public domain.
- Specific permission from the rightsholder covering website display and any transformations, recorded with date and attribution request.
- A reuse-authorised image from an institution, when its **actual licence/terms** permit this site's use.

**Not enough:** credit without a licence, search-engine visibility, a Google Maps review photo, a social media share, an image hosted on an event organiser's website, or a Google Images 'licensable' tag without reviewing the licence.

## Why no autonomous Google scraping
As of 2026 the official Google Custom Search JSON API is closed to new customers, and Google Programmable Search is changing; paid services risk billing. The ordinary browser interface can be used without an API key, but it does not grant machine-readable publishing rights. Do not scrape automated Google search result pages as a supposed free API.

The existing Commons/Wikidata/Openverse runners remain automated and zero-billing. Direct Google links add a faster **human review** lane, not an automatic pipeline that will fill 975 real photo heroes.

Official documentation:
- https://support.google.com/websearch/answer/29508
- https://developers.google.com/custom-search/v1/overview
- https://www.ag.gov.au/rights-and-protections/copyright/copyright-users
- https://au.creativecommons.net/attributing-cc-materials/

## Rights-safe candidate moderation (11 October 2026)
- Owner dashboard → Catalogue → **Saved photo research leads** reads the current research JSON on main via an authenticated endpoint. Each lead starts as needing verification; finding an image does not make it reusable.
- **Review original** opens the source. The reviewer documents actual photo subject/town, named creator, original-page licence version and reuse terms. Mark **source verified** only with both identity/rights checks and an evidence note. Reject incorrect candidates; neither action publishes an image.
- For verified candidates, **Use verified details** copies metadata into the listing editor. Review the alt text and licence details and explicitly check the rights confirmation checkbox. The server refuses new or modified photo heroes without source URL, creator, allowed licence, and owner attestation.
- CC BY/CC BY-SA are normalized to version-specific licence URLs. CC0 and documented public domain are accepted. **Rights-holder permission** requires a dated, scoped non-private evidence note. Do not store email addresses, contact details or private agreements in the public GitHub catalogue. Keep sensitive permission proof in the owner's own secure records.
- An image-only edit keeps the original discovery source identity, allowing routine business updates to continue. Existing licensed images remain unchanged on unrelated listing edits.
- Google Images has a CC-filtered discovery link using a Google query parameter, but filter behavior may change. Confirm visually in Google's **Tools → Usage rights** and then check the original image.
- Manual moderation is **not** production verification: after image publication, check the real listing page, the loaded hero and its creator/rights attribution. Count only proven new photos in the recovery report. The 975 net recovery target remains unmet unless the live catalogue audit shows actual gain.
