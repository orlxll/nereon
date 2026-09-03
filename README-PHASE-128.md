# NEREON Phase 128 — Production Hardening

- Explicit test/live environment columns on commercial records.
- Stripe secret key prefix must match configured environment.
- Stripe webhook `livemode` must match configured environment.
- Verified successful payment marks invoice + contract paid and lead won.

Run `migrations/0007_environment_hardening.sql` once in D1.

Current sandbox settings:
APP_ENV=test
STRIPE_ENVIRONMENT=test
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=<matching test endpoint secret>
