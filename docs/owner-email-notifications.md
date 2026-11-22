# TassieNow — secure owner email notifications

Status: implemented on a review branch; **NOT enabled in production merely by merging this code**. Cloudflare Email Service must be configured first, and the owner must approve deployment.

## What triggers an email

After the original Cloudflare D1 record is committed, the site queues a notification for:

- A new advertising enquiry from `/advertise/`.
- A new listing correction from `/suggest-update/`.
- A new community report submitted by a signed-in member.

Notifications go **only** to `theevansorrell@gmail.com`. The address is constant in server code. The user cannot select a recipient and the app does not use their email address as the mail From address. Each message is plain text, with a short summary and link to the authenticated owner dashboard, not HTML supplied by visitors. Existing Turnstile, origin, member authentication and rate limits remain in place; advertising enquiries also have a five-per-email-per-day limit.

The canonical submissions remain in Cloudflare D1. Email is a separate, best-effort notification. Failed deliveries remain in `site_notification_outbox`, visible from the owner's **Email alerts** admin tab. Automatic attempts have a 15-minute retry delay and a five-attempt cap. A fresh submission can retry pending records; the owner can also press **Retry undelivered notifications** on `/admin/`. Owner-only status and retry actions are protected by the existing admin session and same-origin checks. A successful API response means *accepted by Cloudflare* (delivered or queued), not proof that Gmail received it.

## Required Cloudflare setup (owner action)

1. On the Cloudflare account hosting TassieNow, open **Email Service → Send emails**, complete sending-domain onboarding for `tassienow.com` and the DNS/authentication checks for the sender. Choose `notifications@tassienow.com` as the fixed send-from identity, or another address under `tassienow.com`. Do not guess sender verification status.
2. Add and verify `theevansorrell@gmail.com` as a Cloudflare Email Routing destination if this account requires it. Cloudflare currently supports sending to a verified destination before full sending-domain onboarding.
3. Create a **separate, narrowly scoped Cloudflare API token** with the Email Sending: Edit permission, limited to the applicable Cloudflare account. Do not reuse a global API key or paste it into GitHub, Google Docs or public source.
4. On **Workers & Pages → TassieNow Pages project → Settings → Variables and Secrets**, configure for the *production* environment:
   - Secret `NOTIFY_CF_EMAIL_TOKEN` = scoped API token.
   - Environment variable `NOTIFY_CF_ACCOUNT_ID` = Cloudflare account ID (32 hexadecimal characters).
   - Environment variable `NOTIFY_FROM_EMAIL` = verified sender, e.g. `notifications@tassienow.com`.
5. After owner approval, merge the reviewed pull request and redeploy the Pages project so the variables are available to Functions. Never use the token in client-side JavaScript, Astro public variables, GitHub workflow logs, or a third-party redirect.
6. On `/admin/`, open **Email alerts**. Confirm `Email service configured`. Submit ONE controlled test advertising enquiry with valid Turnstile from the public form and check all three: the enquiry exists in D1/admin, the outbox reports accepted, and the email arrived in Gmail. Repeat with a listing correction and, if appropriate, a member report. A provider acceptance is not a Gmail delivery receipt.
7. If delivery fails, review the safe outbox status and configuration, then press **Retry undelivered notifications**. Do not repeatedly post public test enquiries. Do not retry after five failed attempts without diagnosis.

Cloudflare API reference: https://developers.cloudflare.com/email-service/api/send-emails/rest-api/
Cloudflare Pages bindings: https://developers.cloudflare.com/pages/functions/bindings/

## Limits / follow-up

- There is **no current Cloudflare account/D1 admin connector** exposed to ChatGPT; this implementation delivers new submissions **from the site**, avoiding the need for ChatGPT to poll private D1.
- Old submissions in the database are *not* backfilled or sent automatically. Review these through the existing owner dashboard to avoid spamming duplicate historical messages.
- The existing 6 pm scheduled ChatGPT site-message check should be treated as an email-delivery/archive health review until an authorised D1 read integration exists; Gmail Sent and inbox searches alone cannot prove the private queues are empty.
- This PR neither changes credentials nor triggers a production merge/deploy or purchases an email service plan.
