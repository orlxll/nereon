# NEREON Phase 134 — Project Activity Timeline

Adds project activity APIs for client and admin views without changing the D1 schema.

Client: GET /api/client/activity?token=...
Admin: GET /api/admin/activity?id=... with Authorization Bearer ADMIN_TOKEN

Client Portal now shows a read-only project timeline derived from tasks and messages.
