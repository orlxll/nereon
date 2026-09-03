function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}})}
function authorized(request,env){const e=String(env?.ADMIN_TOKEN||'');const h=request.headers.get('Authorization')||'';return !!e&&h.startsWith('Bearer ')&&h.slice(7)===e}
function now(){return new Date().toISOString()}
export async function onRequestGet({request,env}){
  if(!authorized(request,env))return json({ok:false,error:'unauthorized'},401);
  if(!env?.DB)return json({ok:false,error:'database_not_configured'},503);
  const projectId=new URL(request.url).searchParams.get('project_id'); if(!projectId)return json({ok:false,error:'project_id_required'},400);
  try{const r=await env.DB.prepare('SELECT * FROM onboarding_tasks WHERE project_id=? ORDER BY position ASC,created_at ASC').bind(projectId).all();return json({ok:true,tasks:r.results||[]})}
  catch(e){console.error(e);return json({ok:false,error:'database_read_failed'},500)}
}
export async function onRequestPatch({request,env}){
  if(!authorized(request,env))return json({ok:false,error:'unauthorized'},401);
  if(!env?.DB)return json({ok:false,error:'database_not_configured'},503);
  const id=new URL(request.url).searchParams.get('id');if(!id)return json({ok:false,error:'task_id_required'},400);
  let body={};try{body=await request.json()}catch{return json({ok:false,error:'invalid_json'},400)}
  const statuses=['todo','in_progress','blocked','done'];
  if(body.status!==undefined&&!statuses.includes(String(body.status)))return json({ok:false,error:'invalid_task_status'},400);
  try{
    const row=await env.DB.prepare('SELECT id FROM onboarding_tasks WHERE id=? LIMIT 1').bind(id).first();if(!row)return json({ok:false,error:'task_not_found'},404);
    if(body.status!==undefined){const status=String(body.status);await env.DB.prepare('UPDATE onboarding_tasks SET status=?,completed_at=?,updated_at=? WHERE id=?').bind(status,status==='done'?now():null,now(),id).run()}
    if(body.detail!==undefined) await env.DB.prepare('UPDATE onboarding_tasks SET detail=?,updated_at=? WHERE id=?').bind(String(body.detail),now(),id).run();
    return json({ok:true,task_id:id});
  }catch(e){console.error(e);return json({ok:false,error:'database_update_failed'},500)}
}
