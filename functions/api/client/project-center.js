function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store'}})}
function ub64(s){s=s.replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';const b=atob(s),a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a}
const enc=new TextEncoder()
async function sigOk(raw,sig,secret){const k=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);return crypto.subtle.verify('HMAC',k,ub64(sig),enc.encode(raw))}
async function parseToken(token,secret){const p=String(token||'').split('.');if(p.length!==2)throw new Error('invalid_token');const raw=new TextDecoder().decode(ub64(p[0]));if(!(await sigOk(raw,p[1],secret)))throw new Error('invalid_token');const o=JSON.parse(raw);if(!o?.pid||Number(o.exp)<Math.floor(Date.now()/1000))throw new Error('token_expired');return o}
export async function onRequestGet({request,env}){
 if(!env?.DB)return json({ok:false,error:'database_not_configured'},503);
 const secret=String(env.PORTAL_SECRET||env.ADMIN_TOKEN||'');if(!secret)return json({ok:false,error:'portal_secret_not_configured'},503);
 try{
  const token=new URL(request.url).searchParams.get('token');const t=await parseToken(token,secret);
  const p=await env.DB.prepare('SELECT id,lead_id FROM proposals WHERE id=? LIMIT 1').bind(t.pid).first();
  if(!p)return json({ok:false,error:'proposal_not_found'},404);
  const project=await env.DB.prepare('SELECT id,name,status,amount_eur,currency,environment,started_at,created_at,updated_at FROM projects WHERE lead_id=? ORDER BY created_at DESC LIMIT 1').bind(p.lead_id).first();
  if(!project)return json({ok:true,project:null});
  const tasks=(await env.DB.prepare('SELECT id,title,detail,status,position,created_at FROM onboarding_tasks WHERE project_id=? ORDER BY position ASC,created_at ASC').bind(project.id).all()).results||[];
  const done=tasks.filter(x=>['done','completed'].includes(String(x.status).toLowerCase())).length;
  const progress=tasks.length?Math.round(done*100/tasks.length):0;
  const next=tasks.find(x=>!['done','completed'].includes(String(x.status).toLowerCase()))||null;
  return json({ok:true,project:{...project,progress,open_tasks:tasks.length-done,total_tasks:tasks.length,next_task:next}});
 }catch(e){return json({ok:false,error:e.message||'invalid_token'},401)}
}
