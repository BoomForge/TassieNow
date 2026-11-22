# TassieNow — secure owner email notifications

Status: implemented on a review branch; **NOT enabled in production merely by merging this code**. Cloudflare Email Service must be configured first, and the owner must approve deployment.

## What triggers an email

After the original Cloudflare D1 record is committed, the site queues a notification for:

- A new advertising enquiry from `/advertise/`.
- A new listing correction from `/suggest-update/`.
- A new community report submitted by a signed-in member.

Notifications go **only** to `theevansorrell@gmail.com`. The address is constant in server code. The user cannot select a recipient and the app does not use their email address as the mail From address. Each message is plain text, with a short summary and link to the authenticated owner dashboard, not HTML supplied by visitors. Existing Turnstile, origin, member authentication and rate limits remain in place; advertising enquiries also have a five-per-email-per-day limit.

The canonical submissions remain in Cloudflare D1. Email is a separate, best-effort notification. Failed deliveries remain in `site_notification_outbox`, visible from the owner's **Email alerts** admin tab. Automatic attempts have a 15-minute retry delay and a five-attempt cap. A fresh submission can retry pending records; the owner can also press **Retry undelivered notifications** on `/admin/`. Owner-only status and retry actions are protected by the existing admin session and same-origin checks. A successful API response means *accepted by Cloudflare* (delivered or queued), not proof that Gmail received it.

## Zero-cost requirement — verified destination only

**Non-negotiable: $0 recurring or per-message email charges.** Cloudflare's official documentation confirms that sending **only to destination addresses verified in Email Routing** is free on Workers Free **and** Workers Paid, and does **not** consume the monthly/daily paid sending allowance. Sending to arbitrary/unverified recipients requires Workers Paid and is not allowed for this project.

- Official pricing: https://developers.cloudflare.com/email-service/platform/pricing/
- Verified destination limits: https://developers.cloudflare.com/email-service/platform/limits/
- Destination verification: https://developers.cloudflare.com/email-service/get-started/route-emails/

The code fixes the sole recipient to `theevansorrell@gmail.com`. It additionally **fails closed** unless `NOTIFY_VERIFIED_DESTINATION` exactly confirms that address. Never configure this assertion until the actual verification email has been accepted by Cloudflare. This is an operator acknowledgement; it does not replace Cloudflare's independent verified-recipient enforcement. Never change the recipient to an unverified address or enable paid sending to arbitrary recipients.

### Required Cloudflare setup (owner action, no subscription upgrade)

1. **Keep the existing Workers Free plan. Do not purchase Workers Paid, add pay-as-you-go, or submit payment details for email notifications.** A Workers Paid account can also send to verified destinations for free, but no upgrade is required.
2. In the Cloudflare account owning `tassienow.com`, go to **Compute → Email Service → Email Routing**. Configure the **routing domain** if not already configured; check current DNS/MX before onboarding so existing mail handling is not disrupted. Do not configure Email Sending to arbitrary recipients. Cloudflare DNS is required for Email Service.
3. Under **Email Routing → Destination Addresses**, add `theevansorrell@gmail.com`. Open the verification email Cloudflare sends to Gmail and verify it. Confirm Cloudflare displays the destination as **Verified**.
4. Use the current `tassienow.com` routing domain for sender `notifications@tassienow.com` (or an appropriately configured routing subdomain). Cloudflare allows sending to verified destination addresses from routing domains without a full outbound-sending-domain upgrade.
5. Create a **separate, account-scoped Cloudflare API token** with only the **Email Sending: Edit** permission. Do not use a global API key; never paste credentials into GitHub or project documents. If the dashboard requires an upgrade to produce the needed token or send to the verified address, **STOP — do not pay**. Reassess the integration first.
6. On **Workers & Pages → TassieNow Pages project → Settings → Variables and Secrets**, set for production:
   - Secret `NOTIFY_CF_EMAIL_TOKEN`: scoped API token.
   - Variable `NOTIFY_CF_ACCOUNT_ID`: Cloudflare account ID (32 hexadecimal characters).
   - Variable `NOTIFY_FROM_EMAIL`: routing-domain sender, e.g. `notifications@tassienow.com`.
   - Variable `NOTIFY_VERIFIED_DESTINATION`: **`theevansorrell@gmail.com`**, set **only after** verifying that destination in Cloudflare.
7. After owner approval, merge the reviewed PR and redeploy the existing Pages project on its free allocation. Check **/admin → Email alerts** for `Email service configured`. Submit ONE controlled Turnstile-verified advertising enquiry and verify the D1 record, Cloudflare API acceptance and actual Gmail receipt. Repeat once for a listing correction and, if needed, a member report.
8. If delivery fails, leave submissions saved in D1 and inspect the outbox; press **Retry undelivered notifications** when configured. Never pay to clear a backlog and do not generate repeated public test submissions.

Do not replace or delete existing DNS/MX records blindly. Cloudflare free plan execution and D1 quotas are still subject to fair-use/resource limits; this implementation adds no paid service and must halt/retry rather than incur charges if free quotas are exhausted.

## Limits / follow-up

- There is **no current Cloudflare account/D1 admin connector** exposed to ChatGPT; this implementation delivers new submissions **from the site**, avoiding the need for ChatGPT to poll private D1.
- Old submissions in the database are *not* backfilled or sent automatically. Review these through the existing owner dashboard to avoid spamming duplicate historical messages.
- The existing 6 pm scheduled ChatGPT site-message check should be treated as an email-delivery/archive health review until an authorised D1 read integration exists; Gmail Sent and inbox searches alone cannot prove the private queues are empty.
- This PR neither changes credentials nor triggers a production merge/deploy or purchases an email service plan.
