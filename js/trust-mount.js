import { loadTrustContent } from './trust.js';
function esc(value=''){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function mount(){
  const principles=document.querySelector('[data-trust-principles]'); const faq=document.querySelector('[data-trust-faq]');
  if(!principles||!faq)return;
  try{const d=await loadTrustContent(); principles.innerHTML=d.principles.map((x,i)=>`<article class="trust-card"><span class="eyebrow">0${i+1}</span><h3>${esc(x.title)}</h3><p>${esc(x.text)}</p></article>`).join(''); faq.innerHTML=d.faqs.map(x=>`<details class="faq-item"><summary>${esc(x.q)}</summary><p>${esc(x.a)}</p></details>`).join('');}
  catch(e){console.error(e); principles.innerHTML=''; faq.innerHTML='<p class="form-status">FAQ unavailable.</p>';}
}
mount();
