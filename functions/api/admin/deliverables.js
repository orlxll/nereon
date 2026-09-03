function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}})}
function authorized(request,env){const e=String(env?.ADMIN_TOKEN||'');const h=request.headers.get('Authorization')||'';return !!e&&h.startsWith('Bearer ')&&h.slice(7)===e}
function now(){return new Date().toISOString()}
const clean=(v,m=4000)=>String(v??'').trim().slice(0,m)

export async function onRequestGet({request,env}){
  if(!authorized(request,env))return json({ok:false,error:'unauthorized'},401);
  if(!env?.DB)return json({ok:false,error:'database_not_configured'},503);
  const pid=new URL(request.url).searchParams.get('project_id');
  try{
    const r=pid
      ? await env.DB.prepare('SELECT * FROM deliverables WHERE project_id=? ORDER BY created_at DESC').bind(pid).all()
      : await env.DB.prepare('SELECT * FROM deliverables ORDER BY created_at DESC LIMIT 200').all();
    return json({ok:true,deliverables:r.results||[]});
  }catch(e){console.error(e);return json({ok:false,error:'database_read_failed'},500)}
}

export async function onRequestPost({request,env}){
  if(!authorized(request,env))return json({ok:false,error:'unauthorized'},401);
  if(!env?.DB)return json({ok:false,error:'database_not_configured'},503);
  let b={};try{b=await request.json()}catch{return json({ok:false,error:'invalid_json'},400)}
  const project_id=clean(b.project_id,100), title=clean(b.title,300), description=clean(b.description,4000), resource_url=clean(b.resource_url,2000);
  if(!project_id||!title)return json({ok:false,error:'project_id_and_title_required'},400);
  const p=await env.DB.prepare('SELECT id,lead_id FROM projects WHERE id=? LIMIT 1').bind(project_id).first();
  if(!p)return json({ok:false,error:'project_not_found'},404);
  const id='del_'+crypto.randomUUID(), ts=now();
  await env.DB.prepare(`INSERT INTO deliverables(id,project_id,lead_id,title,description,status,resource_url,created_at,updated_at) VALUES(?,?,?,?,?,'pending',?,?,?)`)
    .bind(id,project_id,p.lead_id,title,description,resource_url||null,ts,ts).run();
  return json({ok:true,deliverable_id:id},201);
}

export async function onRequestPatch({request,env}){
  if(!authorized(request,env))return json({ok:false,error:'unauthorized'},401);
  if(!env?.DB)return json({ok:false,error:'database_not_configured'},503);
  const id=new URL(request.url).searchParams.get('id'); if(!id)return json({ok:false,error:'deliverable_id_required'},400);
  let b={};try{b=await request.json()}catch{return json({ok:false,error:'invalid_json'},400)}
  const allowed=['pending','in_progress','ready','delivered','accepted','blocked'];
  if(b.status!==undefined&&!allowed.includes(String(b.status)))return json({ok:false,error:'invalid_deliverable_status'},422);
  const current=await env.DB.prepare('SELECT * FROM deliverables WHERE id=? LIMIT 1').bind(id).first();
  if(!current)return json({ok:false,error:'deliverable_not_found'},404);
  const title=b.title!==undefined?clean(b.title,300):current.title;
  const description=b.description!==undefined?clean(b.description,4000):current.description;
  const status=b.status!==undefined?String(b.status):current.status;
  const resource_url=b.resource_url!==undefined?clean(b.resource_url,2000):current.resource_url;
  await env.DB.prepare('UPDATE deliverables SET title=?,description=?,status=?,resource_url=?,updated_at=? WHERE id=?')
    .bind(title,description,status,resource_url||null,now(),id).run();
  return json({ok:true,deliverable_id:id});
}
