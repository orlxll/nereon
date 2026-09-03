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
  const row = await env.DB.prepare(`SELECT p.id,p.invoice_id,p.environment,i.contract_id,i.environment invoice_environment,i.lead_id,i.amount_eur,i.currency,c.title FROM payments p JOIN invoices i ON i.id=p.invoice_id JOIN contracts c ON c.id=i.contract_id WHERE p.id=? LIMIT 1`).bind(paymentId).first();
  if (!row) return;
  const now = new Date().toISOString();
  const project=await env.DB.prepare('SELECT id FROM projects WHERE contract_id=? LIMIT 1').bind(row.contract_id).first();
  const projectId=project?.id||`prj_${crypto.randomUUID()}`;
  const statements=[
    env.DB.prepare('UPDATE payments SET status=?,updated_at=?,paid_at=? WHERE id=?').bind('succeeded', now, now, paymentId),
    env.DB.prepare('UPDATE invoices SET status=?,updated_at=?,paid_at=? WHERE id=?').bind('paid', now, now, row.invoice_id),
    env.DB.prepare('UPDATE contracts SET status=?,updated_at=? WHERE id=?').bind('paid', now, row.contract_id),
    env.DB.prepare("UPDATE leads SET status='won', won_at=? WHERE id=?").bind(now, row.lead_id),
  ];
  if (!project) {
    statements.push(env.DB.prepare(`INSERT INTO projects(id,contract_id,lead_id,name,status,amount_eur,currency,environment,started_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(projectId,row.contract_id,row.lead_id,row.title||'NEREON Project','onboarding',row.amount_eur,row.currency,row.environment||'test',now,now,now));
    const tasks=[['Confirm kickoff date','schedule a kickoff call and confirm attendees'],['Collect access requirements','request systems, credentials process, and workspace details'],['Confirm success metric','agree on the measurable outcome for the automation'],['Prepare implementation plan','translate the accepted scope into delivery milestones']];
    for (let i=0;i<tasks.length;i++) statements.push(env.DB.prepare(`INSERT INTO onboarding_tasks(id,project_id,title,detail,status,position,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)`).bind(`tsk_${crypto.randomUUID()}`,projectId,tasks[i][0],tasks[i][1],'todo',i,now,now));
  }
  await env.DB.batch(statements);
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

  const expectedEnvironment = String(env.STRIPE_ENVIRONMENT || env.APP_ENV || 'test').toLowerCase() === 'live' ? 'live' : 'test';
  const eventEnvironment = event.livemode ? 'live' : 'test';
  if (eventEnvironment !== expectedEnvironment) return json({ ok: false, error: 'stripe_event_environment_mismatch' }, 400);

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
