# NEREON Phase 129 — Paid Client Activation

Verified successful Stripe payments now idempotently activate a project and a four-step onboarding checklist. The admin Control Room can list activated projects.

Before testing a new successful payment, run `migrations/0008_paid_client_activation.sql` in the NEREON D1 database.

Also fixes latent client proposal/payment commercial-record insert mismatches: both contracts and invoices now receive the existing environment fields and use the correct invoice placeholder count.
