export async function onRequest({ env }) {
  const dbConfigured = Boolean(env && env.DB);
  return Response.json({ ok: true, service: 'nereon-api', database: dbConfigured ? 'configured' : 'not-configured', timestamp: new Date().toISOString() });
}
