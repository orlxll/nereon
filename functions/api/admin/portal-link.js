function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function authorized(request, env) {
  const expected = String(env?.ADMIN_TOKEN || '');
  const header = request.headers.get('Authorization') || '';
  return !!expected && header.startsWith('Bearer ') && header.slice(7) === expected;
}

const clean = (v, max = 4000) => String(v ?? '').trim().slice(0, max);
const enc = (s) => new TextEncoder().encode(s);
const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)))
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/g, '');

async function sign(payload, secret) {
  const key = await crypto.subtle.importKey(
    'raw', enc(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return b64url(await crypto.subtle.sign('HMAC', key, enc(payload)));
}

export async function onRequestPost({ request, env }) {
  if (!authorized(request, env)) return json({ ok: false, error: 'unauthorized' }, 401);
  if (!env?.DB) return json({ ok: false, error: 'database_not_configured' }, 503);

  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  const proposalId = clean(body.proposal_id, 100);
  if (!proposalId) return json({ ok: false, error: 'proposal_id_required' }, 400);

  const secret = String(env.PORTAL_SECRET || env.ADMIN_TOKEN || '');
  if (!secret) return json({ ok: false, error: 'portal_secret_not_configured' }, 503);

  const proposal = await env.DB.prepare(`
    SELECT p.id, p.lead_id, p.status
    FROM proposals p
    WHERE p.id=? LIMIT 1
  `).bind(proposalId).first();

  if (!proposal) return json({ ok: false, error: 'proposal_not_found' }, 404);

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 14 * 24 * 60 * 60;
  const raw = JSON.stringify({ pid: proposal.id, exp: expiresAt });
  const encoded = b64url(enc(raw));
  const signature = await sign(raw, secret);
  const token = `${encoded}.${signature}`;
  const origin = new URL(request.url).origin;
  const clientUrl = `${origin}/client/?token=${encodeURIComponent(token)}`;

  return json({ ok: true, client_url: clientUrl, expires_at: new Date(expiresAt * 1000).toISOString() });
}
