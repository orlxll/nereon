function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
const clean = (v, max = 5000) => String(v ?? '').trim().slice(0, max);
const text = (v) => new TextEncoder().encode(v);
function b64urlDecode(s) {
  s = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function hmacValid(payload, signature, secret) {
  const key = await crypto.subtle.importKey('raw', text(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  return crypto.subtle.verify('HMAC', key, b64urlDecode(signature), text(payload));
}
async function parsePortalToken(token, secret) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) throw new Error('invalid_token');
  const raw = new TextDecoder().decode(b64urlDecode(parts[0]));
  if (!(await hmacValid(raw, parts[1], secret))) throw new Error('invalid_token');
  const payload = JSON.parse(raw);
  if (!payload?.pid || Number(payload.exp) < Math.floor(Date.now() / 1000)) throw new Error('token_expired');
  return payload;
}
function originOf(request) {
  return new URL(request.url).origin;
}
async function ensureCommercialRecords(env,p){if(!p||p.status!=='accepted')return;const existing=await env.DB.prepare('SELECT id FROM contracts WHERE proposal_id=? LIMIT 1').bind(p.id).first();if(existing)return;const cid='ctr_'+crypto.randomUUID(),iid='inv_'+crypto.randomUUID(),now=new Date().toISOString(),due=new Date(Date.now()+14*24*3600*1000).toISOString();try{await env.DB.batch([env.DB.prepare(`INSERT INTO contracts(id,proposal_id,lead_id,status,title,amount_eur,currency,accepted_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(cid,p.id,p.lead_id,'accepted',p.title,p.price_eur,p.currency,now,now,now),env.DB.prepare(`INSERT INTO invoices(id,contract_id,amount_eur,currency,status,due_date,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)`).bind(iid,cid,p.price_eur,p.currency,'pending',due,now,now)]);}catch(e){const check=await env.DB.prepare('SELECT id FROM contracts WHERE proposal_id=? LIMIT 1').bind(p.id).first();if(!check)throw e;}}
async function stripeRequest(path, params, secret, idempotencyKey) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) body.set(k, String(v));
  const r = await fetch(`https://api.stripe.com${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error('Stripe API error', r.status, data);
    throw new Error('stripe_api_error');
  }
  return data;
}

export async function onRequestPost({ request, env }) {
  if (!env?.DB) return json({ ok: false, error: 'database_not_configured' }, 503);
  const secret = String(env.PORTAL_SECRET || env.ADMIN_TOKEN || '');
  if (!secret) return json({ ok: false, error: 'portal_secret_not_configured' }, 503);
  const stripeKey = String(env.STRIPE_SECRET_KEY || '');
  if (!stripeKey) return json({ ok: false, error: 'stripe_not_configured' }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'invalid_json' }, 400); }
  const token = clean(body.token, 5000);
  try {
    const payload = await parsePortalToken(token, secret);
    const proposal = await env.DB.prepare(`SELECT p.id,p.status,p.price_eur,p.currency,p.title,l.id lead_id,l.company,l.email
      FROM proposals p JOIN leads l ON l.id=p.lead_id WHERE p.id=? LIMIT 1`).bind(payload.pid).first();
    if (!proposal) return json({ ok: false, error: 'proposal_not_found' }, 404);
    if (proposal.status !== 'accepted') return json({ ok: false, error: 'proposal_not_accepted' }, 409);
    await ensureCommercialRecords(env, proposal);

    const invoice = await env.DB.prepare(`SELECT i.*,c.status contract_status FROM invoices i JOIN contracts c ON c.id=i.contract_id
      WHERE c.proposal_id=? ORDER BY i.created_at DESC LIMIT 1`).bind(proposal.id).first();
    if (!invoice) return json({ ok: false, error: 'invoice_not_found' }, 404);
    if (invoice.status === 'paid') return json({ ok: false, error: 'invoice_already_paid' }, 409);

    const existing = await env.DB.prepare(`SELECT * FROM payments WHERE invoice_id=? AND provider='stripe' AND status IN ('pending','processing') ORDER BY created_at DESC LIMIT 1`).bind(invoice.id).first();
    if (existing?.checkout_url) return json({ ok: true, payment: existing, checkout_url: existing.checkout_url, reused: true });

    const paymentId = `pay_${crypto.randomUUID()}`;
    const idempotencyKey = `nereon-${invoice.id}`;
    const origin = originOf(request);
    const successUrl = `${origin}/client/?token=${encodeURIComponent(token)}&payment=success`;
    const cancelUrl = `${origin}/client/?token=${encodeURIComponent(token)}&payment=cancelled`;
    const cents = Math.max(1, Math.round(Number(invoice.amount_eur || 0) * 100));
    if (!Number.isFinite(cents) || cents > 99999999) return json({ ok: false, error: 'invalid_invoice_amount' }, 422);

    const session = await stripeRequest('/v1/checkout/sessions', {
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      'customer_email': String(proposal.email || ''),
      'line_items[0][price_data][currency]': String(invoice.currency || 'EUR').toLowerCase(),
      'line_items[0][price_data][product_data][name]': clean(proposal.title, 240),
      'line_items[0][price_data][product_data][description]': `NEREON services for ${clean(proposal.company, 180)}`,
      'line_items[0][price_data][unit_amount]': cents,
      'line_items[0][quantity]': 1,
      'metadata[invoice_id]': invoice.id,
      'metadata[payment_id]': paymentId,
      'metadata[proposal_id]': proposal.id,
      'payment_intent_data[metadata][invoice_id]': invoice.id,
      'payment_intent_data[metadata][payment_id]': paymentId,
      'payment_intent_data[metadata][proposal_id]': proposal.id,
    }, stripeKey, idempotencyKey);

    const now = new Date().toISOString();
    const payment = {
      id: paymentId,
      invoice_id: invoice.id,
      provider: 'stripe',
      provider_payment_id: String(session.id || ''),
      checkout_url: String(session.url || ''),
      amount_eur: Number(invoice.amount_eur || 0),
      currency: invoice.currency || 'EUR',
      status: 'pending',
      created_at: now,
      updated_at: now,
    };
    await env.DB.prepare(`INSERT INTO payments
      (id,invoice_id,provider,provider_payment_id,checkout_url,amount_eur,currency,status,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(payment.id,payment.invoice_id,payment.provider,payment.provider_payment_id,payment.checkout_url,payment.amount_eur,payment.currency,payment.status,payment.created_at,payment.updated_at).run();
    return json({ ok: true, checkout_url: payment.checkout_url, payment }, 201);
  } catch (e) {
    console.error('Create checkout failed', e);
    return json({ ok: false, error: e.message || 'payment_setup_failed' }, e.message === 'invalid_token' || e.message === 'token_expired' ? 401 : 500);
  }
}
