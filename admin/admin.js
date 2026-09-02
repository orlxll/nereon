(() => {
  const tokenInput = document.getElementById('token');
  const connect = document.getElementById('connect');
  const loginStatus = document.getElementById('loginStatus');
  const loginCard = document.getElementById('loginCard');
  const dashboard = document.getElementById('dashboard');
  const list = document.getElementById('list');
  const search = document.getElementById('search');
  const refresh = document.getElementById('refresh');
  const logout = document.getElementById('logout');
  const count = document.getElementById('count');
  const high = document.getElementById('high');
  const latest = document.getElementById('latest');

  let token = '';
  let timer = null;

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const fmtDate = (value) => value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';
  const blueprint = (raw) => {
    try {
      const items = JSON.parse(raw || '[]');
      if (!Array.isArray(items) || !items.length) return '<span class="muted">No blueprint</span>';
      return `<ol>${items.slice(0, 8).map((x) => `<li><b>${escapeHtml(x.title)}</b><span>${escapeHtml(x.detail)}</span></li>`).join('')}</ol>`;
    } catch { return '<span class="muted">Invalid blueprint</span>'; }
  };

  async function load() {
    list.innerHTML = '<div class="panel empty">Loading leads…</div>';
    const params = new URLSearchParams({ limit: '200' });
    const q = search.value.trim();
    if (q) params.set('q', q);
    try {
      const response = await fetch(`/api/admin/leads?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) throw new Error('Invalid Admin Token.');
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not load leads.');

      count.textContent = data.count;
      const highCount = data.leads.filter((lead) => String(lead.signal || '').toLowerCase() === 'high signal').length;
      high.textContent = highCount;
      latest.textContent = data.leads[0]?.created_at ? fmtDate(data.leads[0].created_at) : '—';

      if (!data.leads.length) {
        list.innerHTML = '<div class="panel empty">No leads found.</div>';
        return;
      }

      list.innerHTML = data.leads.map((lead) => `
        <article class="lead panel">
          <div class="lead-head">
            <div><p class="eyebrow">${escapeHtml(lead.source || 'lead')}</p><h2>${escapeHtml(lead.company)}</h2><p class="person">${escapeHtml(lead.name)} · ${escapeHtml(lead.email)}</p></div>
            <div class="date">${fmtDate(lead.created_at)}</div>
          </div>
          <div class="lead-grid">
            <div><span class="label">Workflow</span><p>${escapeHtml(lead.workflow || lead.focus || '—')}</p></div>
            <div><span class="label">Assessment</span><p>${escapeHtml(lead.assessment || '—')}</p></div>
            <div><span class="label">Signal</span><p><strong>${escapeHtml(lead.signal || '—')}</strong>${lead.score != null ? ` · ${escapeHtml(lead.score)}/100` : ''}</p></div>
          </div>
          <details><summary>Suggested blueprint</summary>${blueprint(lead.blueprint_json)}</details>
        </article>`).join('');
    } catch (error) {
      loginStatus.textContent = error.message;
      loginStatus.className = 'status error';
      if (error.message.includes('Invalid Admin Token')) lock();
    }
  }

  async function connectAdmin() {
    const candidate = tokenInput.value.trim();
    if (!candidate) { loginStatus.textContent = 'Enter the Admin Token.'; loginStatus.className = 'status error'; return; }
    token = candidate;
    loginStatus.textContent = 'Connecting…';
    loginStatus.className = 'status';
    try {
      const response = await fetch('/api/admin/leads?limit=1', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      if (response.status === 401) throw new Error('Invalid Admin Token.');
      if (!response.ok) throw new Error('Could not connect to NEREON API.');
      loginCard.classList.add('hidden');
      dashboard.classList.remove('hidden');
      await load();
    } catch (error) {
      token = '';
      loginStatus.textContent = error.message;
      loginStatus.className = 'status error';
    }
  }

  function lock() {
    token = '';
    loginCard.classList.remove('hidden');
    dashboard.classList.add('hidden');
    tokenInput.value = '';
    loginStatus.textContent = 'Dashboard locked.';
    loginStatus.className = 'status';
    if (timer) clearTimeout(timer);
  }

  connect.addEventListener('click', connectAdmin);
  tokenInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') connectAdmin(); });
  refresh.addEventListener('click', load);
  logout.addEventListener('click', lock);
  search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(load, 250); });
})();
