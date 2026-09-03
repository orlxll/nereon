(() => {
  const $ = (id) => document.getElementById(id);
  const tokenInput=$('token'), connect=$('connect'), loginStatus=$('loginStatus'), loginCard=$('loginCard'), dashboard=$('dashboard'), list=$('list'), search=$('search'), statusFilter=$('statusFilter'), priorityFilter=$('priorityFilter'), refresh=$('refresh'), logout=$('logout');
  let token='', timer=null, cached=[];
  const statuses=['new','contacted','replied','discovery','proposal','won','lost'];
  const labels={new:'New',contacted:'Contacted',replied:'Replied',discovery:'Discovery',proposal:'Proposal',won:'Won',lost:'Lost'};
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const fmt=v=>v?new Date(v).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}):'—';
  const isoDate=d=>d?new Date(d):null;
  function priority(lead){
    if (lead.status==='won'||lead.status==='lost') return lead.status==='won'?'won':'closed';
    let s=Number(lead.score||0);
    if (String(lead.signal||'').toLowerCase().includes('high')) s+=15;
    if (lead.status==='proposal') s+=12; else if (lead.status==='discovery') s+=8; else if (lead.status==='replied') s+=5;
    const next=isoDate(lead.next_action_at); const now=new Date();
    if(next){ if(next < now) s+=25; else if(next-now < 48*3600*1000) s+=10; }
    if(s>=75) return 'hot'; if(s>=45) return 'warm'; return 'cold';
  }
  function actionLabel(lead){
    if(lead.status==='won') return 'Won';
    if(lead.status==='lost') return 'Closed';
    if(!lead.next_action_at) return 'Set next action';
    const next=new Date(lead.next_action_at), now=new Date();
    if(next<now) return 'Overdue';
    const day=new Date(now); day.setHours(23,59,59,999);
    if(next<=day) return 'Today';
    return fmt(next);
  }
  const blueprint=raw=>{try{const xs=JSON.parse(raw||'[]');return xs.length?`<ol>${xs.slice(0,6).map(x=>`<li><b>${esc(x.title)}</b><span>${esc(x.detail)}</span></li>`).join('')}</ol>`:'<span class="muted">No blueprint</span>'}catch{return '<span class="muted">Invalid blueprint</span>'}};
  const statusSelect=(lead)=>`<select class="stage" data-id="${esc(lead.id)}">${statuses.map(s=>`<option value="${s}" ${s===lead.status?'selected':''}>${labels[s]}</option>`).join('')}</select>`;
  async function api(url,opts={}){const r=await fetch(url,{...opts,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...(opts.headers||{})},cache:'no-store'});const d=await r.json().catch(()=>({}));if(r.status===401)throw new Error('Invalid Admin Token.');if(!r.ok||!d.ok)throw new Error(d.error||'Request failed.');return d;}
  async function updateLead(id,patch){return api(`/api/admin/leads?id=${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify(patch)})}
  function renderPipeline(counts){$('pipeline').innerHTML=statuses.map(s=>`<button type="button" class="pipe ${s===statusFilter.value?'active':''}" data-status="${s}"><span>${labels[s]}</span><strong>${counts[s]||0}</strong></button>`).join('')+'<div class="pipe total"><span>Total</span><strong>'+Object.values(counts).reduce((a,b)=>a+b,0)+'</strong></div>';document.querySelectorAll('.pipe[data-status]').forEach(b=>b.onclick=()=>{statusFilter.value=b.dataset.status;load()});}
  function renderPriority(counts){$('priority').innerHTML=['hot','warm','cold'].map(s=>`<button type="button" class="priority-card ${s===priorityFilter.value?'active':''}" data-priority="${s}"><span>${s.toUpperCase()}</span><strong>${counts[s]||0}</strong></button>`).join('');document.querySelectorAll('.priority-card').forEach(b=>b.onclick=()=>{priorityFilter.value=b.dataset.priority;renderList();});}
  function renderList(){
    let leads=cached.slice();
    const pf=priorityFilter.value; if(pf) leads=leads.filter(l=>priority(l)===pf);
    const q=search.value.trim().toLowerCase(); if(q) leads=leads.filter(l=>[l.name,l.email,l.company,l.focus,l.workflow].some(v=>String(v||'').toLowerCase().includes(q)));
    if(!leads.length){list.innerHTML='<div class="panel empty">No leads found.</div>';return;}
    list.innerHTML=leads.map(l=>{const p=priority(l); return `<article class="lead panel"><div class="lead-head"><div><p class="eyebrow">${esc(l.source||'lead')} · ${p.toUpperCase()}</p><h2>${esc(l.company)}</h2><p class="person">${esc(l.name)} · ${esc(l.email)}</p></div><div>${statusSelect(l)}<div class="date">${fmt(l.created_at)}</div></div></div><div class="lead-grid"><div><span class="label">Priority</span><p><strong class="badge ${p}">${p.toUpperCase()}</strong> · score ${esc(l.score??'—')}/100</p></div><div><span class="label">Workflow</span><p>${esc(l.workflow||l.focus||'—')}</p></div><div><span class="label">Next action</span><input class="next-action" data-id="${esc(l.id)}" type="datetime-local" value="${l.next_action_at?new Date(l.next_action_at).toISOString().slice(0,16):''}"><small class="action-state">${esc(actionLabel(l))}</small></div></div><div class="notes"><span class="label">Notes</span><textarea class="note" data-id="${esc(l.id)}" rows="3" placeholder="Discovery notes, objections, next steps…">${esc(l.notes)}</textarea><div class="actions"><button type="button" class="save-note" data-id="${esc(l.id)}">Save notes</button><button type="button" class="mark-contacted ghost" data-id="${esc(l.id)}">Mark contacted</button></div></div><details><summary>Suggested blueprint</summary>${blueprint(l.blueprint_json)}</details></article>`;}).join('');
    document.querySelectorAll('.stage').forEach(el=>el.onchange=async()=>{try{await updateLead(el.dataset.id,{status:el.value});await load()}catch(e){alert(e.message)}});
    document.querySelectorAll('.save-note').forEach(b=>b.onclick=async()=>{const note=document.querySelector(`.note[data-id="${CSS.escape(b.dataset.id)}"]`).value;const input=document.querySelector(`.next-action[data-id="${CSS.escape(b.dataset.id)}"]`).value;try{await updateLead(b.dataset.id,{notes:note,next_action_at:input?new Date(input).toISOString():null});b.textContent='Saved';setTimeout(()=>b.textContent='Save notes',900);await load()}catch(e){alert(e.message)}});
    document.querySelectorAll('.next-action').forEach(el=>el.onchange=async()=>{try{await updateLead(el.dataset.id,{next_action_at:el.value?new Date(el.value).toISOString():null});await load()}catch(e){alert(e.message)}});
    document.querySelectorAll('.mark-contacted').forEach(b=>b.onclick=async()=>{try{await updateLead(b.dataset.id,{status:'contacted',contacted:true});await load()}catch(e){alert(e.message)}});
  }
  async function load(){list.innerHTML='<div class="panel empty">Loading leads…</div>';try{const d=await api(`/api/admin/leads?limit=200`);cached=d.leads.map(x=>({...x,status:x.status||'new'}));
      const filtered=cached.filter(l=>{const q=search.value.trim().toLowerCase();return !q||[l.name,l.email,l.company,l.focus,l.workflow].some(v=>String(v||'').toLowerCase().includes(q))}).filter(l=>!statusFilter.value||l.status===statusFilter.value);
      $('count').textContent=cached.length; $('high').textContent=cached.filter(x=>priority(x)==='hot').length; $('won').textContent=d.counts.won||0;
      const actionable=cached.filter(x=>x.next_action_at&&x.status!=='won'&&x.status!=='lost');
      const today=new Date(); today.setHours(23,59,59,999); const start=new Date(); start.setHours(0,0,0,0);
      const overdue=actionable.filter(x=>new Date(x.next_action_at)<start).length; const todayCount=actionable.filter(x=>{const t=new Date(x.next_action_at);return t>=start&&t<=today}).length;
      $('next').textContent=overdue?`${overdue} overdue`:todayCount?`${todayCount} today`:'—';
      const pc={hot:0,warm:0,cold:0};cached.forEach(l=>{const p=priority(l);if(pc[p]!=null)pc[p]++});renderPipeline(d.counts);renderPriority(pc);renderList();
      $('overdue').textContent=overdue; $('today').textContent=todayCount;
    }catch(e){loginStatus.textContent=e.message;loginStatus.className='status error';if(e.message.includes('Invalid Admin Token'))lock()}}
  async function connectAdmin(){const c=tokenInput.value.trim();if(!c){loginStatus.textContent='Enter the Admin Token.';loginStatus.className='status error';return}token=c;loginStatus.textContent='Connecting…';loginStatus.className='status';try{await api('/api/admin/leads?limit=1');loginCard.classList.add('hidden');dashboard.classList.remove('hidden');await load()}catch(e){token='';loginStatus.textContent=e.message;loginStatus.className='status error'}}
  function lock(){token='';loginCard.classList.remove('hidden');dashboard.classList.add('hidden');tokenInput.value='';if(timer)clearTimeout(timer)}
  connect.onclick=connectAdmin;tokenInput.onkeydown=e=>{if(e.key==='Enter')connectAdmin()};refresh.onclick=load;logout.onclick=lock;statusFilter.onchange=load;priorityFilter.onchange=renderList;search.oninput=()=>{clearTimeout(timer);timer=setTimeout(renderList,150)};
})();
