# NEREON Phase 130 — Project & Onboarding Control

Adds a project control view to the admin dashboard using the existing `projects` and `onboarding_tasks` D1 schema.

New admin endpoints:
- `GET/PATCH /api/admin/projects`
- `GET/PATCH /api/admin/onboarding-tasks`

No database migration is required.

Deployment: upload the contents of this folder to the repository root and let Cloudflare Pages redeploy.
