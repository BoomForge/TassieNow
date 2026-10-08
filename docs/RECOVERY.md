# TassieNow production recovery

Do not overwrite production records, Cloudflare settings, Git history or D1 databases as part of a test.

## 1. Identify a known-good revision
1. Inspect the GitHub Actions quality workflow and the last successful deployment.
2. Record the commit SHA and inspect its catalogue audit, automated import and validation evidence.
3. Do not treat a heartbeat as proof of import success.

## 2. Revert a faulty automated import
1. Suspend the **specific** data-writing workflow temporarily if it is still producing bad records.
2. Create a recovery branch from the current main branch; never reset or force-push main.
3. Restore only affected data files from the verified SHA with `git restore --source=<GOOD_SHA> -- src/data/places.json src/data/events.json src/data/place-overrides.json` (omit files not affected). Do not copy unrelated stale data.
4. Re-run `npm run validate:data`, `npm run test:discovery` and `npm run build`.
5. Compare counts, region distribution, image licences, suppressed records, current events and corrections against the selected known-good revision.
6. Open a PR, obtain CI success and deploy through the normal main branch.
7. Run production checks and re-enable the affected workflow only after its cause is fixed.

## 3. Cloudflare Pages rollback
In Cloudflare Pages, find the last tested production deployment and use the dashboard's rollback action if supported for the site. Confirm the correct target commit, then test the homepage, discovery, an event and a place page. Retain the faulty build's logs for diagnosis. A Pages rollback changes deployed assets, **not** Git source data or D1 state. This repository does not grant programmatic access to the Cloudflare deployment control plane.

## 4. Recovery drill evidence
`node scripts/test-catalogue-recovery.mjs` simulates corrupting **temporary copies** and restoring Git-tracked places, events and overrides. CI includes this test. It does not assert that a real Cloudflare Pages rollback succeeded.

## 5. Monitoring and escalation
`operations-monitor.yml` runs on a schedule and publishes `src/data/operations-report.json`. Check /status/ and the workflow artifact. A missing or delayed scheduled run must be recorded as stale, missing or unknown, never converted into a fabricated success. If a refresh or deployment fails, inspect its job logs before resetting anything. Monitor schedule delivery separately from workflow completion.

## 6. D1 and owner-controlled records
Do not roll back D1 schemas/data by checking out older files. Use forward-only migrations and restore from separately verified backups when explicitly necessary. Preserve business-owner corrections and audit history.
