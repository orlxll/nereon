function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}})}
function auth(request,env){const e=String(env?.ADMIN_TOKEN||''),h=request.headers.get('Authorization')||'';return !!e&&h.startsWith('Bearer ')&&h.slice(7)===e}
export async function onRequestGet({request,env}){
 if(!auth(request,env))return json({ok:false,error:'unauthorized'},401);
 if(!env?.DB)return json({ok:false,error:'database_not_configured'},503);
 const id=new URL(request.url).searchParams.get('project_id');if(!id)return json({ok:false,error:'project_id_required'},400);
 try{
  const project=await env.DB.prepare(`SELECT p.id,p.name,p.status,p.amount_eur,p.currency,p.environment,p.started_at,p.updated_at,l.name AS lead_name,l.email AS lead_email,l.company AS company,i.status AS invoice_status FROM projects p LEFT JOIN leads l ON l.id=p.lead_id LEFT JOIN invoices i ON i.contract_id=p.contract_id WHERE p.id=? LIMIT 1`).bind(id).first();
  if(!project)return json({ok:false,error:'project_not_found'},404);
  const tasks=(await env.DB.prepare('SELECT id,title,detail,status,position,created_at,completed_at FROM onboarding_tasks WHERE project_id=? ORDER BY position ASC,created_at ASC').bind(id).all()).results||[];
  const messages=(await env.DB.prepare('SELECT id,sender_type,message,created_at,read_at FROM messages WHERE project_id=? ORDER BY created_at DESC LIMIT 100').bind(id).all()).results||[];
  const deliverables=(await env.DB.prepare('SELECT id,title,description,status,resource_url,created_at,updated_at FROM deliverables WHERE project_id=? ORDER BY created_at DESC').bind(id).all()).results||[];
  const done=tasks.filter(x=>['done','completed'].includes(String(x.status).toLowerCase())).length;
  return json({ok:true,project,progress:tasks.length?Math.round(done*100/tasks.length):0,tasks,messages,deliverables});
 }catch(e){console.error(e);return json({ok:false,error:'project_health_failed'},500)}
}
