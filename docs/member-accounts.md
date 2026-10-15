# Member accounts

Member UI: `/account/`; visitor reviews/photos and save/plan controls: `/place/<slug>/#community`; owner moderation: `/community-admin/` after logging in at `/admin/`.

Uses the existing Cloudflare Pages `DB` D1 binding, `SESSION_SECRET`, `PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, and `TURNSTILE_EXPECTED_HOSTNAME`. No additional paid service or storage binding is required. Additive `member_*` tables initialise on first request using idempotent D1 statements. Existing admin tables are untouched. Build and account tests generate the small server-side place catalogue from active, visible listings.

Accounts use salted native PBKDF2-SHA256 (100,000 iterations, the Workers runtime limit) with an HMAC pepper derived from `SESSION_SECRET`. Do not rotate this secret casually: existing password and recovery checks depend on it. A secret rotation needs a planned member recovery/migration procedure. Session cookies are host-only, Secure, HttpOnly, SameSite=Lax; only token hashes are stored in D1. Sessions expire after 30 days and can be revoked. Mutations require the same Origin. CAPTCHA verification is mandatory on signup, login, recovery, reviews and photos and fails closed if unconfigured.

There is no transactional mail dependency. Account email addresses are unverified identifiers. Signup shows a random 256-bit recovery code once; the member must save it. Recovery requires email, recovery code, a new password and CAPTCHA. It consumes and replaces the code and revokes existing sessions. There is no backdoor or email-only reset. Changing a password revokes other sessions. Deleting an account removes its saved places, plans, contributions, reports and sessions from live D1 storage.

Plans and saved places are private to their member. Plan updates use a version to reject stale concurrent writes. Limits: 500 saved places, 50 plans, 50 unique stops per plan. Submitted reviews and photos are visible only to their author and owner while pending/rejected. The owner must approve them before public display. Editing a review returns it to pending. Published contributions have a member report action.

Photo originals (JPEG/PNG/WebP up to 15 MB) are resized in the browser, converted to JPEG, and reduced to 300,000 bytes or less. The server validates JPEG structure/dimensions and strips application metadata/EXIF/GPS/comments before saving a D1 blob. Images are never uploaded to GitHub and require no deployment to appear. Quotas: 30 photos per member, 12 upload attempts/day, 100,000,000 total stored image bytes. The global limit protects the existing free D1 database. A later R2 migration can expand capacity without changing the member interface. Pending photos require author or owner authentication; image responses use no-store to honour deletion/unpublication.

IP-based authentication limits use short-lived salted hashes, not raw IP storage. Member contributions have additional per-account rate limits. Reviews/photos can be rejected or unpublished in the owner moderation screen.

## Checks

- `npm run test:members`: real SQLite query/ownership/auth/CAPTCHA/session/recovery/moderation/upload/deletion integration coverage.
- `npm run test:discovery`: existing catalogue regression coverage.
- `npm run build`: generates member place catalogue and all static pages.
- Browser acceptance exercised signup, save-place persistence, private plan creation/reload, review submission, actual canvas photo compression/upload, owner approval, guest rendering, 390px/1440px layouts, logout/login, and account deletion against an isolated local database with a mocked test-only CAPTCHA service. Production CAPTCHA remains independently enforced by Turnstile.

## Automated moderation and signup records

See `docs/member-moderation-runner.md` for the private twice-daily review bridge and task contract. Rejections require a specific explanation and create a private account message. Owner-only `/api/member/members.csv` generates the current deduplicated name/email/signup-date CSV on demand, with spreadsheet-formula neutralisation. It contains no credentials and is never public.
