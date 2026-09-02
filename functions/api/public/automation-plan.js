const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/orlxll\.github\.io$/,
  /^https:\/\/[^/]+\.pages\.dev$/,
  /^https:\/\/[^/]+\.nereon\.[^/]+$/
];

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowed = ALLOWED_ORIGIN_PATTERNS.some((re) => re.test(origin));
  return {
    'Access-Control-Allow-Origin': allowed ? origin : 'null',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

function json(data, status, request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(request) },
  });
}

function clean(value, max = 4000) {
  return String(value ?? '').trim().slice(0, max);
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function clientIp(request) {
  return request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
}

const buckets = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const max = 10;
  const bucket = buckets.get(ip) || { started: now, count: 0 };
  if (now - bucket.started > windowMs) {
    buckets.set(ip, { started: now, count: 1 });
    return false;
  }
  bucket.count += 1;
  buckets.set(ip, bucket);
  return bucket.count > max;
}

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export async function onRequestPost({ request, env }) {
  if (rateLimited(clientIp(request))) return json({ ok: false, error: 'rate_limited' }, 429, request);
  if (!env?.DB) return json({ ok: false, error: 'database_not_configured' }, 503, request);

  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'invalid_json' }, 400, request); }

  const name = clean(body.name, 120);
  const email = clean(body.email, 254).toLowerCase();
  const company = clean(body.company, 160);
  const focus = clean(body.focus, 2000);
  const workflow = clean(body.workflow, 5000);
  const assessment = clean(body.assessment, 2000);
  const signal = clean(body.signal, 80);
  const score = Number.isFinite(Number(body.score)) ? Math.max(0, Math.min(100, Number(body.score))) : null;
  const blueprint = Array.isArray(body.blueprint) ? body.blueprint.slice(0, 8).map((item) => ({
    title: clean(item?.title, 180),
    detail: clean(item?.detail, 500),
  })) : [];

  if (!name || !company || !validEmail(email) || (!workflow && !focus)) {
    return json({ ok: false, error: 'validation_failed' }, 422, request);
  }

  const now = new Date().toISOString();
  const leadId = crypto.randomUUID();
  const planId = crypto.randomUUID();
  const blueprintJson = JSON.stringify(blueprint);

  try {
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO leads (id, name, email, company, focus, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(leadId, name, email, company, focus, 'automation_planner', now),
      env.DB.prepare(`INSERT INTO automation_plans (id, lead_id, workflow, assessment, signal, score, blueprint_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(planId, leadId, workflow, assessment, signal, score, blueprintJson, now),
    ]);
  } catch (error) {
    console.error('D1 insert failed', error);
    return json({ ok: false, error: 'database_write_failed' }, 500, request);
  }

  return json({ ok: true, leadId, planId, status: 'captured' }, 201, request);
}

export function onRequestGet({ request }) {
  return json({ ok: false, error: 'method_not_allowed' }, 405, request);
}
