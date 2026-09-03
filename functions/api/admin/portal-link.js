function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}})}
function authorized(request,env){const expected=String(env?.ADMIN_TOKEN||''); const h=request.headers.get('Authorization')||''; return !!expected && h.startsWith('Bearer ') && h.slice(7)===expected}
function b64u(bytes){let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function txt(s){return new TextEncoder().encode(s)}
async function sign(payload,secret){const key=await crypto.subtle.importKey('raw',txt(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return b64u(await crypto.subtle.sign('HMAC',key,txt(payload)))}
const clean=(v,m=200)=>String(v??'').trim().slice(0,m)
export async function onRequestPost({request,env}){
  if(!authorized(request,env)) return json({ok:false,error:'unauthorized'},401)
  if(!env?.DB) return json({ok:false,error:'database_not_configured'},503)
  const secret=String(env.PORTAL_SECRET||env.ADMIN_TOKEN||''); if(!secret) return json({ok:false,error:'portal_secret_not_configured'},503)
  let body; try{body=await request.json()}catch{return json({ok:false,error:'invalid_json'},400)}
  const proposalId=clean(body.proposal_id); if(!proposalId)return json({ok:false,error:'proposal_id_required'},400)
  const proposal=await env.DB.prepare(`SELECT p.id,p.title,p.status,l.company FROM proposals p JOIN leads l ON l.id=p.lead_id WHERE p.id=? LIMIT 1`).bind(proposalId).first()
  if(!proposal)return json({ok:false,error:'proposal_not_found'},404)
  const exp=Math.floor(Date.now()/1000)+14*24*60*60; const payload=JSON.stringify({v:1,pid:proposal.id,exp}); const token=b64u(txt(payload))+'.'+await sign(payload,secret)
  const origin=new URL(request.url).origin; return json({ok:true,proposal_id:proposal.id,status:proposal.status,client_path:`/client/?token=${encodeURIComponent(token)}`,client_url:`${origin}/client/?token=${encodeURIComponent(token)}`,expires_at:new Date(exp*1000).toISOString()})
}
