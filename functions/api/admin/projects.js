function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}})}
function authorized(request,env){const e=String(env?.ADMIN_TOKEN||'');const h=request.headers.get('Authorization')||'';return !!e&&h.startsWith('Bearer ')&&h.slice(7)===e}
function now(){return new Date().toISOString()}
export async function onRequestGet({request,env}){
  if(!authorized(request,env))return json({ok:false,error:'unauthorized'},401);
  if(!env?.DB)return json({ok:false,error:'database_not_configured'},503);
  try{
    const r=await env.DB.prepare(`
      SELECT p.*,l.name lead_name,l.company,l.email,c.title contract_title,
        i.id invoice_id,i.status invoice_status,
        (SELECT COUNT(*) FROM onboarding_tasks t WHERE t.project_id=p.id) task_total,
        (SELECT COUNT(*) FROM onboarding_tasks t WHERE t.project_id=p.id AND t.status='done') task_done
      FROM projects p
      JOIN leads l ON l.id=p.lead_id
      JOIN contracts c ON c.id=p.contract_id
      LEFT JOIN invoices i ON i.contract_id=c.id
      ORDER BY p.created_at DESC LIMIT 200`).all();
    return json({ok:true,projects:r.results||[]});
  }catch(e){console.error(e);return json({ok:false,error:'database_read_failed'},500)}
}
export async function onRequestGetOne({request,env}){
  if(!authorized(request,env))return json({ok:false,error:'unauthorized'},401);
  if(!env?.DB)return json({ok:false,error:'database_not_configured'},503);
  const id=new URL(request.url).searchParams.get('id'); if(!id)return json({ok:false,error:'project_id_required'},400);
  try{
    const project=await env.DB.prepare(`SELECT p.*,l.name lead_name,l.company,l.email,c.title contract_title,i.status invoice_status,i.amount_eur invoice_amount FROM projects p JOIN leads l ON l.id=p.lead_id JOIN contracts c ON c.id=p.contract_id LEFT JOIN invoices i ON i.contract_id=c.id WHERE p.id=? LIMIT 1`).bind(id).first();
    if(!project)return json({ok:false,error:'project_not_found'},404);
    const tasks=await env.DB.prepare('SELECT * FROM onboarding_tasks WHERE project_id=? ORDER BY position ASC,created_at ASC').bind(id).all();
    return json({ok:true,project,tasks:tasks.results||[]});
  }catch(e){console.error(e);return json({ok:false,error:'database_read_failed'},500)}
}

export async function onRequestPatch({request,env}){
  if(!authorized(request,env))return json({ok:false,error:'unauthorized'},401);
  if(!env?.DB)return json({ok:false,error:'database_not_configured'},503);
  const id=new URL(request.url).searchParams.get('id');
  if(!id)return json({ok:false,error:'project_id_required'},400);
  let body={};try{body=await request.json()}catch{return json({ok:false,error:'invalid_json'},400)}
  const allowedStatuses=['onboarding','active','blocked','complete','archived'];
  if(body.status!==undefined&&!allowedStatuses.includes(String(body.status)))return json({ok:false,error:'invalid_project_status'},400);
  try{
    const row=await env.DB.prepare('SELECT id FROM projects WHERE id=? LIMIT 1').bind(id).first();
    if(!row)return json({ok:false,error:'project_not_found'},404);
    if(body.status!==undefined) await env.DB.prepare('UPDATE projects SET status=?,updated_at=? WHERE id=?').bind(String(body.status),now(),id).run();
    return json({ok:true,project_id:id});
  }catch(e){console.error(e);return json({ok:false,error:'database_update_failed'},500)}
}
