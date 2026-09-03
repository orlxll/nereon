function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}})}
function ub64(s){s=s.replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';const bin=atob(s);const a=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);return a}
function txt(s){return new TextEncoder().encode(s)}
async function validSig(payload,sig,secret){const key=await crypto.subtle.importKey('raw',txt(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);return crypto.subtle.verify('HMAC',key,ub64(sig),txt(payload))}
async function parseToken(token,secret){const parts=String(token||'').split('.');if(parts.length!==2)throw new Error('invalid_token');const raw=new TextDecoder().decode(ub64(parts[0]));if(!(await validSig(raw,parts[1],secret)))throw new Error('invalid_token');const p=JSON.parse(raw);if(!p?.pid||Number(p.exp)<Math.floor(Date.now()/1000))throw new Error('token_expired');return p}

export async function onRequestGet({request,env}){
  if(!env?.DB||!env?.DELIVERABLES_BUCKET)return json({ok:false,error:'storage_not_configured'},503);
  const secret=String(env.PORTAL_SECRET||env.ADMIN_TOKEN||'');if(!secret)return json({ok:false,error:'portal_secret_not_configured'},503);
  try{
    const u=new URL(request.url), token=u.searchParams.get('token'), deliverable_id=u.searchParams.get('deliverable_id');
    if(!deliverable_id) return json({ok:false,error:'deliverable_id_required'},400);
    const t=await parseToken(token,secret);
    const p=await env.DB.prepare('SELECT lead_id FROM proposals WHERE id=? LIMIT 1').bind(t.pid).first();
    if(!p)return json({ok:false,error:'proposal_not_found'},404);
    const project=await env.DB.prepare('SELECT id FROM projects WHERE lead_id=? ORDER BY created_at DESC LIMIT 1').bind(p.lead_id).first();
    if(!project)return json({ok:false,error:'project_not_found'},404);
    const d=await env.DB.prepare('SELECT id,title,resource_url FROM deliverables WHERE id=? AND project_id=? LIMIT 1').bind(deliverable_id,project.id).first();
    if(!d)return json({ok:false,error:'deliverable_not_found'},404);
    if(!String(d.resource_url||'').startsWith('r2:'))return json({ok:false,error:'file_not_available'},404);
    const key=String(d.resource_url).slice(3);
    const obj=await env.DELIVERABLES_BUCKET.get(key);
    if(!obj)return json({ok:false,error:'file_not_found'},404);
    const headers=new Headers();
    obj.writeHttpMetadata(headers);
    headers.set('Cache-Control','private, no-store');
    headers.set('Content-Disposition',`attachment; filename="${String(d.title).replace(/["\\]/g,'_')}"`);
    return new Response(obj.body,{headers});
  }catch(e){return json({ok:false,error:e.message||'invalid_token'},401)}
}
