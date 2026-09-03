# NEREON Phase 119 — Client Portal

Adds a private proposal portal with signed, expiring links.

## Migration
Run `migrations/0004_client_portal.sql` in the Cloudflare D1 Console.

## Secret
Optional secret: `PORTAL_SECRET`. If absent, the system falls back to `ADMIN_TOKEN` so the portal works without another setup step. For production, prefer a separate random `PORTAL_SECRET`.

## Admin
In `/admin/`, open a proposal and click **Create client link**. The 14-day secure link is copied to your clipboard.

## Client
The client can review scope/timeline/investment and either accept the proposal or request changes. The proposal status is updated in D1.

## Important
This phase does not process payments or send email automatically. It creates the secure client review/decision surface; payment and contract automation remain separate phases.
