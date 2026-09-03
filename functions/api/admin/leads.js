function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function authorized(request, env) {
  const expected = String(env?.ADMIN_TOKEN || '');
  const header = request.headers.get('Authorization') || '';
  if (!expected || !header.startsWith('Bearer ')) return false;
  return header.slice(7) === expected;
}

const STATUSES = new Set(['new', 'contacted', 'replied', 'discovery', 'proposal', 'won', 'lost']);
const clean = (value, max = 4000) => String(value ?? '').trim().slice(0, max);

async function listLeads(env, search = '', status = '', limit = 200) {
  const where = [];
  const binds = [];
  if (search) {
    where.push('(l.name LIKE ? OR l.email LIKE ? OR l.company LIKE ? OR l.focus LIKE ? OR p.workflow LIKE ?)');
    binds.push(...Array(5).fill(`%${search}%`));
  }
  if (status && STATUSES.has(status)) {
    where.push('l.status = ?');
    binds.push(status);
  }
  const sql = `SELECT l.id, l.name, l.email, l.company, l.focus, l.source, l.created_at, l.status, l.notes, l.next_action_at, l.last_contacted_at, l.environment, l.won_at,
                p.id AS plan_id, p.workflow, p.assessment, p.signal, p.score, p.blueprint_json, p.created_at AS plan_created_at
         FROM leads l LEFT JOIN automation_plans p ON p.lead_id = l.id
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
         ORDER BY l.created_at DESC LIMIT ?`;
  binds.push(limit);
  const result = await env.DB.prepare(sql).bind(...binds).all();
  return result.results;
}

export async function onRequestGet({ request, env }) {
  if (!authorized(request, env)) return json({ ok: false, error: 'unauthorized' }, 401);
  if (!env?.DB) return json({ ok: false, error: 'database_not_configured' }, 503);

  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 200), 1), 200);
  const q = clean(url.searchParams.get('q') || '', 160);
  const status = clean(url.searchParams.get('status') || '', 40);

  try {
    const leads = await listLeads(env, q, status, limit);
    const counts = { new: 0, contacted: 0, replied: 0, discovery: 0, proposal: 0, won: 0, lost: 0 };
    const all = await listLeads(env, '', '', 200);
    for (const lead of all) counts[STATUSES.has(lead.status) ? lead.status : 'new'] += 1;
    return json({ ok: true, count: leads.length, leads, counts });
  } catch (error) {
    console.error('Admin leads query failed', error);
    return json({ ok: false, error: 'database_read_failed' }, 500);
  }
}

export async function onRequestPatch({ request, env }) {
  if (!authorized(request, env)) return json({ ok: false, error: 'unauthorized' }, 401);
  if (!env?.DB) return json({ ok: false, error: 'database_not_configured' }, 503);
  const url = new URL(request.url);
  const id = clean(url.searchParams.get('id') || '', 80);
  if (!id) return json({ ok: false, error: 'lead_id_required' }, 400);
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'invalid_json' }, 400); }
  const status = clean(body.status || '', 40);
  if (status && !STATUSES.has(status)) return json({ ok: false, error: 'invalid_status' }, 422);
  const notes = body.notes == null ? null : clean(body.notes, 4000);
  const nextActionAt = body.next_action_at == null ? null : clean(body.next_action_at, 64);
  const now = new Date().toISOString();

  try {
    const parts = [], binds = [];
    if (status) { parts.push('status = ?'); binds.push(status); }
    if (notes !== null) { parts.push('notes = ?'); binds.push(notes); }
    if (body.next_action_at !== undefined) { parts.push('next_action_at = ?'); binds.push(nextActionAt || null); }
    if (body.contacted === true) { parts.push('last_contacted_at = ?'); binds.push(now); }
    if (!parts.length) return json({ ok: false, error: 'nothing_to_update' }, 400);
    binds.push(id);
    const result = await env.DB.prepare(`UPDATE leads SET ${parts.join(', ')} WHERE id = ?`).bind(...binds).run();
    if (!result.meta?.changes) return json({ ok: false, error: 'lead_not_found' }, 404);
    return json({ ok: true, id });
  } catch (error) {
    console.error('Admin lead update failed', error);
    return json({ ok: false, error: 'database_write_failed' }, 500);
  }
}

export function onRequestPost() { return json({ ok: false, error: 'method_not_allowed' }, 405); }
