# NEREON Phase 126 — Commercial Schema Sync

Fixes the existing D1 schema mismatch used by the Client Portal.

Adds:
- contracts.title
- contracts.updated_at
- invoices.updated_at

Run `migrations/0006_commercial_schema_sync.sql` once in:
Cloudflare → D1 → nereon-leads → Console
