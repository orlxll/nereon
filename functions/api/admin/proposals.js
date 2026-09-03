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

const clean = (v, max = 8000) => String(v ?? '').trim().slice(0, max);
const STATUSES = new Set(['draft','internal_review','approved','sent','accepted','rejected','expired']);

function makeProposalId() {
  return `prop_${crypto.randomUUID()}`;
}

function safeBlueprint(raw) {
  try {
    const xs = JSON.parse(raw || '[]');
    return Array.isArray(xs) ? xs.slice(0, 10).map(x => ({
      title: clean(x?.title, 180),
      detail: clean(x?.detail, 600)
    })) : [];
  } catch { return []; }
}

function estimatePrice(lead) {
  const score = Number(lead.score || 0);
  const signal = String(lead.signal || '').toLowerCase();
  if (signal.includes('high') || score >= 80) return 6500;
  if (score >= 60) return 4500;
  return 3000;
}

function estimateTimeline(scopeCount) {
  if (scopeCount >= 5) return '3–5 weeks';
  if (scopeCount >= 3) return '2–4 weeks';
  return '1–3 weeks';
}

async function getLead(env, id) {
  return env.DB.prepare(`SELECT l.id,l.name,l.email,l.company,l.focus,l.status,l.notes,
    p.workflow,p.assessment,p.signal,p.score,p.blueprint_json,l.environment
    FROM leads l LEFT JOIN automation_plans p ON p.lead_id=l.id WHERE l.id=? LIMIT 1`).bind(id).first();
}

export async function onRequestGet({ request, env }) {
  if (!authorized(request, env)) return json({ ok:false, error:'unauthorized' }, 401);
  if (!env?.DB) return json({ ok:false, error:'database_not_configured' }, 503);
  const url = new URL(request.url);
  const leadId = clean(url.searchParams.get('lead_id') || '', 100);
  try {
    const result = leadId
      ? await env.DB.prepare('SELECT * FROM proposals WHERE lead_id=? ORDER BY created_at DESC').bind(leadId).all()
      : await env.DB.prepare('SELECT * FROM proposals ORDER BY created_at DESC LIMIT 200').all();
    return json({ ok:true, proposals: result.results });
  } catch (e) {
    console.error('Proposal read failed', e);
    return json({ ok:false, error:'database_read_failed' }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  if (!authorized(request, env)) return json({ ok:false, error:'unauthorized' }, 401);
  if (!env?.DB) return json({ ok:false, error:'database_not_configured' }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ ok:false, error:'invalid_json' }, 400); }
  const leadId = clean(body.lead_id || '', 100);
  if (!leadId) return json({ ok:false, error:'lead_id_required' }, 400);
  try {
    const lead = await getLead(env, leadId);
    if (!lead) return json({ ok:false, error:'lead_not_found' }, 404);

    const bp = safeBlueprint(lead.blueprint_json);
    const scope = bp.length ? bp.map((x) => `${x.title}${x.detail ? ' — ' + x.detail : ''}`) : [
      'Workflow discovery and requirements validation',
      'Automation workflow design',
      'Implementation and integration',
      'Testing, handover and documentation'
    ];
    const now = new Date().toISOString();
    const proposal = {
      id: makeProposalId(),
      lead_id: lead.id,
      title: `NEREON Automation Proposal — ${lead.company}`,
      executive_summary: `NEREON proposes a focused automation engagement for ${lead.company}, starting from the workflow described during discovery. The goal is to reduce repetitive manual work while keeping human approval where appropriate.`,
      scope_json: JSON.stringify(scope),
      timeline: estimateTimeline(scope.length),
      price_eur: estimatePrice(lead),
      currency: 'EUR',
      status: 'draft',
      environment: String(lead.environment || 'test'),
      created_at: now,
      updated_at: now,
    };

    await env.DB.prepare(`INSERT INTO proposals
      (id,lead_id,title,executive_summary,scope_json,timeline,price_eur,currency,status,environment,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(
      proposal.id, proposal.lead_id, proposal.title, proposal.executive_summary,
      proposal.scope_json, proposal.timeline, proposal.price_eur, proposal.currency,
      proposal.status, proposal.environment, proposal.created_at, proposal.updated_at
    ).run();

    return json({ ok:true, proposal });
  } catch (e) {
    console.error('Proposal generation failed', e);
    return json({ ok:false, error:'proposal_generation_failed' }, 500);
  }
}

export async function onRequestPatch({ request, env }) {
  if (!authorized(request, env)) return json({ ok:false, error:'unauthorized' }, 401);
  if (!env?.DB) return json({ ok:false, error:'database_not_configured' }, 503);
  const url = new URL(request.url);
  const id = clean(url.searchParams.get('id') || '', 100);
  if (!id) return json({ ok:false, error:'proposal_id_required' }, 400);
  let body;
  try { body = await request.json(); } catch { return json({ ok:false, error:'invalid_json' }, 400); }
  const allowed = {};
  if (body.title !== undefined) allowed.title = clean(body.title, 240);
  if (body.executive_summary !== undefined) allowed.executive_summary = clean(body.executive_summary, 6000);
  if (body.scope_json !== undefined) allowed.scope_json = clean(body.scope_json, 12000);
  if (body.timeline !== undefined) allowed.timeline = clean(body.timeline, 120);
  if (body.price_eur !== undefined) allowed.price_eur = Math.max(0, Math.min(Number(body.price_eur) || 0, 1000000));
  if (body.status !== undefined) {
    const status = clean(body.status, 40);
    if (!STATUSES.has(status)) return json({ ok:false, error:'invalid_status' }, 422);
    allowed.status = status;
  }
  const parts = Object.keys(allowed).map(k => `${k}=?`);
  if (!parts.length) return json({ ok:false, error:'nothing_to_update' }, 400);
  const values = Object.keys(allowed).map(k => allowed[k]);
  values.push(new Date().toISOString(), id);
  try {
    const result = await env.DB.prepare(`UPDATE proposals SET ${parts.join(', ')}, updated_at=? WHERE id=?`).bind(...values).run();
    if (!result.meta?.changes) return json({ ok:false, error:'proposal_not_found' }, 404);
    return json({ ok:true, id });
  } catch (e) {
    console.error('Proposal update failed', e);
    return json({ ok:false, error:'database_write_failed' }, 500);
  }
}
