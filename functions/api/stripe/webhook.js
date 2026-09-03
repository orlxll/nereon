function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
const enc = (s) => new TextEncoder().encode(s);
function hex(bytes) { return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join(''); }
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}
async function verifyStripeSignature(payload, header, secret) {
  const parts = String(header || '').split(',').map(x => x.trim());
  const timestamp = parts.find(x => x.startsWith('t='))?.slice(2);
  const signatures = parts.filter(x => x.startsWith('v1=')).map(x => x.slice(3));
  if (!timestamp || !signatures.length || !/^\d+$/.test(timestamp)) return false;
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (age > 300) return false;
  const key = await crypto.subtle.importKey('raw', enc(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = hex(await crypto.subtle.sign('HMAC', key, enc(`${timestamp}.${payload}`)));
  return signatures.some(sig => safeEqual(sig, expected));
}
async function updatePayment(env, paymentId, status) {
  const now = new Date().toISOString();
  await env.DB.prepare('UPDATE payments SET status=?,updated_at=? WHERE id=?').bind(status, now, paymentId).run();
}
async function paymentIdFromObject(env, object) {
  const md = object?.metadata || {};
  if (md.payment_id) return String(md.payment_id);
  if (object?.id) {
    const row = await env.DB.prepare('SELECT id FROM payments WHERE provider_payment_id=? LIMIT 1').bind(String(object.id)).first();
    return row?.id || null;
  }
  return null;
}
async function finalize(env, paymentId) {
  if (!paymentId) return;
  const row = await env.DB.prepare(`SELECT p.id,p.invoice_id,i.contract_id FROM payments p JOIN invoices i ON i.id=p.invoice_id WHERE p.id=? LIMIT 1`).bind(paymentId).first();
  if (!row) return;
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare('UPDATE payments SET status=?,updated_at=? WHERE id=?').bind('succeeded', now, paymentId),
    env.DB.prepare('UPDATE invoices SET status=?,updated_at=? WHERE id=?').bind('paid', now, row.invoice_id),
    env.DB.prepare('UPDATE contracts SET status=?,updated_at=? WHERE id=?').bind('paid', now, row.contract_id),
  ]);
}

export async function onRequestPost({ request, env }) {
  if (!env?.DB) return json({ ok: false, error: 'database_not_configured' }, 503);
  const webhookSecret = String(env.STRIPE_WEBHOOK_SECRET || '');
  if (!webhookSecret) return json({ ok: false, error: 'stripe_webhook_not_configured' }, 503);
  const body = await request.text();
  const signature = request.headers.get('Stripe-Signature') || '';
  if (!(await verifyStripeSignature(body, signature, webhookSecret))) return json({ ok: false, error: 'invalid_signature' }, 400);
  let event;
  try { event = JSON.parse(body); } catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const obj = event.data?.object || {};
        if (obj.payment_status === 'paid') await finalize(env, await paymentIdFromObject(env, obj));
        break;
      }
      case 'checkout.session.async_payment_succeeded':
        await finalize(env, await paymentIdFromObject(env, event.data?.object || {}));
        break;
      case 'checkout.session.async_payment_failed':
      case 'checkout.session.expired': {
        const pid = await paymentIdFromObject(env, event.data?.object || {});
        if (pid) await updatePayment(env, pid, 'failed');
        break;
      }
      case 'payment_intent.succeeded':
        await finalize(env, await paymentIdFromObject(env, event.data?.object || {}));
        break;
      case 'payment_intent.payment_failed': {
        const pid = await paymentIdFromObject(env, event.data?.object || {});
        if (pid) await updatePayment(env, pid, 'failed');
        break;
      }
      default:
        break;
    }
    return json({ ok: true, received: true });
  } catch (e) {
    console.error('Stripe webhook handling failed', e);
    return json({ ok: false, error: 'webhook_processing_failed' }, 500);
  }
}
