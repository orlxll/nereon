# NEREON Phase 133 — Client / Studio Messaging

Adds project-scoped messaging between the client portal and NEREON admin.

## D1 migration
Run `migrations/0009_project_messages.sql` once in D1 Console.

## Client
`GET/POST /api/client/messages?token=...`

## Admin
`GET/POST /api/admin/messages?project_id=...` with `Authorization: Bearer ADMIN_TOKEN`.
