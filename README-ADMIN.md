# NEREON Admin Dashboard

The private dashboard is served at `/admin/` and is read-only.

## Cloudflare secret

In Cloudflare Pages project settings, add a **secret/environment variable** named:

`ADMIN_TOKEN`

Use a long random value (at least 32 characters). Do not commit the token to GitHub.

The dashboard sends `Authorization: Bearer <ADMIN_TOKEN>` to `/api/admin/leads`.

## Notes

- The dashboard is intentionally marked `noindex,nofollow`.
- No customer records are editable or deletable from this first version.
- Never put the admin token in frontend source code or public repository files.
