# NEREON Phase 121 — Stripe Checkout + Webhooks

This phase adds a real Stripe Checkout integration foundation to the existing NEREON client portal.

## Environment secrets
Set these in Cloudflare Pages/Workers -> Settings -> Variables and Secrets:

- `STRIPE_SECRET_KEY` — Stripe secret API key (`sk_test_...` for sandbox, `sk_live_...` only for real production).
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret (`whsec_...`).

No Stripe secret belongs in GitHub.

## D1 migration
Run:

`migrations/0006_stripe_checkout.sql`

It adds `checkout_url` to `payments`.

## Endpoints

- `POST /api/client/pay` — validates the private proposal token, confirms proposal is accepted, creates/reuses a Stripe Checkout Session, records the payment, and returns the Checkout URL.
- `POST /api/stripe/webhook` — verifies `Stripe-Signature` using the raw request body and webhook secret; updates payment/invoice/contract state for relevant events.

## Stripe webhook events handled

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`

Stripe requires publicly reachable HTTPS webhook endpoints and signature verification. The handler uses the raw body for verification and keeps the secret server-side.

## Test flow

1. Accept a proposal in the client portal.
2. Ensure an invoice exists.
3. Configure Stripe test secrets in Cloudflare.
4. Open the client portal and click **Pay invoice**.
5. Complete a Stripe test checkout.
6. Stripe sends the webhook.
7. Verify `payments.status = succeeded`, `invoices.status = paid`, and `contracts.status = paid`.

Production should use Stripe live keys only after domain/HTTPS, legal, invoicing, and business setup are ready.
