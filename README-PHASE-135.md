# NEREON Phase 135 — Deliverables

Adds project deliverables for studio/admin and client portals.

- Admin API: list/create/update deliverables
- Admin page: `/admin/deliverables/?project_id=...`
- Client API: `/api/client/deliverables?token=...`
- Client portal: deliverables section
- D1 migration: `migrations/0010_deliverables.sql`

Binary file storage is intentionally not added in this phase; `resource_url` is an optional external/storage URL.
