function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}})}
function authorized(request,env){const e=String(env?.ADMIN_TOKEN||'');const h=request.headers.get('Authorization')||'';return !!e&&h.startsWith('Bearer ')&&h.slice(7)===e}
const clean=(v,m=4000)=>String(v??'').trim().slice(0,m)
function safeName(v){return clean(v,180).replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'')||'file'}

export async function onRequestPost({request,env}){
  if(!authorized(request,env))return json({ok:false,error:'unauthorized'},401);
  if(!env?.DB||!env?.DELIVERABLES_BUCKET)return json({ok:false,error:'storage_not_configured'},503);
  const form=await request.formData().catch(()=>null);
  if(!form)return json({ok:false,error:'multipart_required'},400);
  const project_id=clean(form.get('project_id'),100);
  const title=clean(form.get('title'),300);
  const description=clean(form.get('description'),4000);
  const file=form.get('file');
  if(!project_id||!title||!(file instanceof File))return json({ok:false,error:'project_id_title_and_file_required'},400);
  const project=await env.DB.prepare('SELECT id,lead_id FROM projects WHERE id=? LIMIT 1').bind(project_id).first();
  if(!project)return json({ok:false,error:'project_not_found'},404);
  if(file.size>25*1024*1024)return json({ok:false,error:'file_too_large_max_25mb'},413);
  const contentType=clean(file.type||'application/octet-stream',200);
  const key=`deliverables/${project_id}/${crypto.randomUUID()}-${safeName(file.name)}`;
  await env.DELIVERABLES_BUCKET.put(key,file.stream(),{httpMetadata:{contentType},customMetadata:{project_id,lead_id:String(project.lead_id),title}});
  const id='del_'+crypto.randomUUID(), ts=new Date().toISOString();
  await env.DB.prepare(`INSERT INTO deliverables(id,project_id,lead_id,title,description,status,resource_url,created_at,updated_at) VALUES(?,?,?,?,?,'ready',?,?,?)`)
    .bind(id,project_id,project.lead_id,title,description,`r2:${key}`,ts,ts).run();
  return json({ok:true,deliverable_id:id,key,size:file.size,content_type:contentType},201);
}
