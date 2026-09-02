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

export async function onRequestGet({ request, env }) {
  if (!authorized(request, env)) return json({ ok: false, error: 'unauthorized' }, 401);
  if (!env?.DB) return json({ ok: false, error: 'database_not_configured' }, 503);

  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 100), 1), 200);
  const search = String(url.searchParams.get('q') || '').trim().slice(0, 160);

  try {
    const query = search
      ? `SELECT l.id, l.name, l.email, l.company, l.focus, l.source, l.created_at,
                p.id AS plan_id, p.workflow, p.assessment, p.signal, p.score, p.blueprint_json, p.created_at AS plan_created_at
         FROM leads l
         LEFT JOIN automation_plans p ON p.lead_id = l.id
         WHERE l.name LIKE ? OR l.email LIKE ? OR l.company LIKE ? OR l.focus LIKE ? OR p.workflow LIKE ?
         ORDER BY l.created_at DESC LIMIT ?`
      : `SELECT l.id, l.name, l.email, l.company, l.focus, l.source, l.created_at,
                p.id AS plan_id, p.workflow, p.assessment, p.signal, p.score, p.blueprint_json, p.created_at AS plan_created_at
         FROM leads l
         LEFT JOIN automation_plans p ON p.lead_id = l.id
         ORDER BY l.created_at DESC LIMIT ?`;

    const bindings = search
      ? Array(4).fill(`%${search}%`).concat(`%${search}%`, limit)
      : [limit];

    const result = await env.DB.prepare(query).bind(...bindings).all();
    return json({ ok: true, count: result.results.length, leads: result.results });
  } catch (error) {
    console.error('Admin leads query failed', error);
    return json({ ok: false, error: 'database_read_failed' }, 500);
  }
}

export function onRequestPost() {
  return json({ ok: false, error: 'method_not_allowed' }, 405);
}
