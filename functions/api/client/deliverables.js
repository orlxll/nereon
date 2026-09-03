function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}})}
function ub64(s){s=s.replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';const bin=atob(s);const a=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);return a}
function txt(s){return new TextEncoder().encode(s)}
async function validSig(payload,sig,secret){const key=await crypto.subtle.importKey('raw',txt(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);return crypto.subtle.verify('HMAC',key,ub64(sig),txt(payload))}
async function parseToken(token,secret){const parts=String(token||'').split('.');if(parts.length!==2)throw new Error('invalid_token');const raw=new TextDecoder().decode(ub64(parts[0]));if(!(await validSig(raw,parts[1],secret)))throw new Error('invalid_token');const p=JSON.parse(raw);if(!p?.pid||Number(p.exp)<Math.floor(Date.now()/1000))throw new Error('token_expired');return p}
export async function onRequestGet({request,env}){
  if(!env?.DB)return json({ok:false,error:'database_not_configured'},503);
  const secret=String(env.PORTAL_SECRET||env.ADMIN_TOKEN||'');if(!secret)return json({ok:false,error:'portal_secret_not_configured'},503);
  try{
    const token=new URL(request.url).searchParams.get('token'), t=await parseToken(token,secret);
    const p=await env.DB.prepare('SELECT lead_id FROM proposals WHERE id=? LIMIT 1').bind(t.pid).first();
    if(!p)return json({ok:false,error:'proposal_not_found'},404);
    const project=await env.DB.prepare('SELECT id FROM projects WHERE lead_id=? ORDER BY created_at DESC LIMIT 1').bind(p.lead_id).first();
    if(!project)return json({ok:true,deliverables:[]});
    const r=await env.DB.prepare('SELECT id,title,description,status,resource_url,created_at,updated_at FROM deliverables WHERE project_id=? ORDER BY created_at DESC').bind(project.id).all();
    return json({ok:true,deliverables:r.results||[]});
  }catch(e){return json({ok:false,error:e.message||'invalid_token'},401)}
}
