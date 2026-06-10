/* IPTV Admin SPA — vanilla JS, no build step */
const API = '/api/admin';

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

const $ = id => document.getElementById(id);

// ── Auth ───────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  checkSession();

  $('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    $('login-error').classList.add('hidden');
    try {
      await api('POST', '/login', { password: $('login-password').value });
      showApp();
    } catch (err) {
      $('login-error').textContent = err.message;
      $('login-error').classList.remove('hidden');
    }
  });

  $('logout-btn').addEventListener('click', async () => {
    await api('POST', '/logout').catch(() => {});
    location.reload();
  });

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.add('hidden'));
      btn.classList.add('active');
      $('tab-' + btn.dataset.tab).classList.remove('hidden');
      App.loadTab(btn.dataset.tab);
    });
  });
});

async function checkSession() {
  try {
    await api('GET', '/status');
    showApp();
  } catch {
    showLogin();
  }
}

function showLogin() {
  $('login-screen').classList.remove('hidden');
  $('app-screen').classList.add('hidden');
}

function showApp() {
  $('login-screen').classList.add('hidden');
  $('app-screen').classList.remove('hidden');
  App.loadTab('playlists');
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function openModal(html) {
  $('modal-content').innerHTML = html;
  $('modal-overlay').classList.remove('hidden');
  $('modal-box').addEventListener('click', e => e.stopPropagation(), { once: true });
}
function closeModal() { $('modal-overlay').classList.add('hidden'); }
$('modal-overlay')?.addEventListener('click', closeModal);

// ── App ───────────────────────────────────────────────────────────────────────
const App = {
  _channels: [],
  _rows: [],

  loadTab(tab) {
    if (tab === 'playlists') this.loadPlaylists();
    if (tab === 'channels')  this.loadChannels();
    if (tab === 'rows')      this.loadRows();
    if (tab === 'epg')       this.loadEpg();
    if (tab === 'settings')  this.loadSettings();
  },

  closeModal: closeModal,

  // ── Playlists ──────────────────────────────────────────────────────────────
  async loadPlaylists() {
    const list = await api('GET', '/playlists');
    const el = $('playlists-list');
    if (!list.length) { el.innerHTML = '<p class="empty-state">No hay playlists. Añade una lista M3U.</p>'; return; }
    el.innerHTML = list.map(p => `
      <div class="card">
        <div class="card-icon-placeholder">M3U</div>
        <div class="card-body">
          <div class="card-title">${esc(p.name)}</div>
          <div class="card-subtitle">${esc(p.url)}</div>
          <div style="margin-top:.3rem">
            ${p.last_status === 'OK'
              ? `<span class="badge badge-ok">OK · ${p.channel_count} canales</span>`
              : p.last_status
                ? `<span class="badge badge-err">${esc(p.last_status)}</span>`
                : '<span class="badge badge-idle">Sin refrescar</span>'}
            ${p.last_fetched_at ? `<span style="color:var(--text2);font-size:.78rem;margin-left:.5rem">${relTime(p.last_fetched_at)}</span>` : ''}
          </div>
        </div>
        <div class="card-actions">
          <button class="btn btn-sm" onclick="App.refreshPlaylist(${p.id})">↻ Refrescar</button>
          <button class="btn btn-sm btn-danger" onclick="App.deletePlaylist(${p.id})">✕</button>
        </div>
      </div>
    `).join('');
  },

  openAddPlaylist() {
    openModal(`
      <h3>Añadir playlist M3U</h3>
      <div class="form-group"><label>Nombre</label><input id="pl-name" placeholder="Mi lista IPTV" /></div>
      <div class="form-group"><label>URL (.m3u / .m3u8)</label><input id="pl-url" placeholder="http://..." /></div>
      <div class="form-actions">
        <button class="btn-ghost" onclick="App.closeModal()">Cancelar</button>
        <button class="btn" onclick="App.addPlaylist()">Añadir</button>
      </div>
    `);
  },

  async addPlaylist() {
    const name = $('pl-name').value.trim();
    const url  = $('pl-url').value.trim();
    if (!name || !url) return alert('Rellena todos los campos');
    await api('POST', '/playlists', { name, url });
    closeModal();
    this.loadPlaylists();
  },

  async refreshPlaylist(id) {
    const btn = event.target;
    btn.textContent = '…';
    try {
      const r = await api('POST', `/playlists/${id}/refresh`);
      alert(`Refrescado: ${r.count} canales`);
    } catch (err) { alert(err.message); }
    this.loadPlaylists();
  },

  async deletePlaylist(id) {
    if (!confirm('¿Eliminar esta playlist? Se borrarán sus canales raw.')) return;
    await api('DELETE', `/playlists/${id}`);
    this.loadPlaylists();
  },

  // ── Channels ───────────────────────────────────────────────────────────────
  async loadChannels() {
    const list = await api('GET', '/channels');
    this._channels = list;
    this._renderChannels(list);
  },

  _renderChannels(list) {
    const el = $('channels-list');
    if (!list.length) { el.innerHTML = '<p class="empty-state">No hay canales lógicos aún.</p>'; return; }
    el.innerHTML = list.map(ch => `
      <div class="card">
        ${ch.logo_url
          ? `<img class="card-icon" src="${esc(ch.logo_url)}" onerror="this.style.display='none'" />`
          : `<div class="card-icon-placeholder">TV</div>`}
        <div class="card-body">
          <div class="card-title">${esc(ch.name)}</div>
          <div class="card-subtitle">iptv:${esc(ch.slug)}</div>
        </div>
        <div class="card-actions">
          <button class="btn btn-sm" onclick="App.openSources(${ch.id},'${esc(ch.name)}')">Fuentes</button>
          <button class="btn btn-sm btn-danger" onclick="App.deleteChannel(${ch.id})">✕</button>
        </div>
      </div>
    `).join('');
  },

  filterChannels(q) {
    const filtered = this._channels.filter(c => c.name.toLowerCase().includes(q.toLowerCase()));
    this._renderChannels(filtered);
  },

  openAddChannel() {
    openModal(`
      <h3>Nuevo canal lógico</h3>
      <div class="form-group"><label>Nombre del canal</label><input id="ch-name" placeholder="M+ LaLiga" /></div>
      <div class="form-group"><label>Logo URL (opcional)</label><input id="ch-logo" placeholder="https://…" /></div>
      <div class="form-actions">
        <button class="btn-ghost" onclick="App.closeModal()">Cancelar</button>
        <button class="btn" onclick="App.addChannel()">Crear</button>
      </div>
    `);
  },

  async addChannel() {
    const name = $('ch-name').value.trim();
    const logo = $('ch-logo').value.trim();
    if (!name) return alert('Introduce un nombre');
    await api('POST', '/channels', { name, logo_url: logo });
    closeModal();
    this.loadChannels();
  },

  async deleteChannel(id) {
    if (!confirm('¿Eliminar este canal y sus fuentes?')) return;
    await api('DELETE', `/channels/${id}`);
    this.loadChannels();
  },

  async openSources(channelId, channelName) {
    const sources = await api('GET', `/channels/${channelId}/sources`);
    openModal(`
      <h3>Fuentes · ${esc(channelName)}</h3>
      <div class="sources-list" id="sources-list">
        ${sources.length ? sources.map((s, i) => `
          <div class="source-item" id="src-${s.id}">
            <span class="source-num">${i + 1}</span>
            ${s.tvg_logo ? `<img src="${esc(s.tvg_logo)}" style="width:28px;height:28px;border-radius:4px;object-fit:cover">` : ''}
            <span class="source-name">${esc(s.tvg_name)}</span>
            <span style="color:var(--text2);font-size:.78rem">${esc(s.label || '')}</span>
            <button class="btn btn-sm btn-danger" onclick="App.removeSource(${channelId},${s.id})">✕</button>
          </div>
        `).join('') : '<p style="color:var(--text2);font-size:.88rem">Sin fuentes todavía.</p>'}
      </div>
      <div style="margin-top:1rem">
        <button class="btn btn-sm" onclick="App.openSourcePicker(${channelId})">+ Añadir fuente IPTV</button>
      </div>
    `);
  },

  async removeSource(channelId, srcId) {
    await api('DELETE', `/channels/${channelId}/sources/${srcId}`);
    this.openSources(channelId, '');
  },

  async openSourcePicker(channelId) {
    openModal(`
      <h3>Añadir fuente IPTV</h3>
      <input class="picker-search" id="picker-q" placeholder="Buscar canal raw…" oninput="App.searchRaw(this.value,${channelId})" />
      <div class="picker-list" id="picker-list"><p style="color:var(--text2)">Escribe para buscar…</p></div>
    `);
  },

  async searchRaw(q, channelId) {
    if (q.length < 2) return;
    const results = await api('GET', `/raw-channels?search=${encodeURIComponent(q)}&limit=40`);
    const el = $('picker-list');
    el.innerHTML = results.map(rc => `
      <div class="picker-item" onclick="App.addSource(${channelId},${rc.id},'${esc(rc.tvg_name)}')">
        ${rc.tvg_logo ? `<img src="${esc(rc.tvg_logo)}" onerror="this.src=''" />` : '<div style="width:32px;height:32px;background:var(--bg2);border-radius:4px"></div>'}
        <span>${esc(rc.tvg_name)}</span>
        <span class="badge-group">${esc(rc.group_title || '')}</span>
      </div>
    `).join('') || '<p style="color:var(--text2)">Sin resultados</p>';
  },

  async addSource(channelId, rawId, name) {
    await api('POST', `/channels/${channelId}/sources`, { raw_channel_id: rawId });
    await this.openSources(channelId, name);
  },

  // ── Rows ───────────────────────────────────────────────────────────────────
  async loadRows() {
    const rows = await api('GET', '/rows');
    this._rows = rows;
    const el = $('rows-list');
    if (!rows.length) { el.innerHTML = '<p class="empty-state">No hay filas.</p>'; return; }
    const sections = await Promise.all(rows.map(async r => {
      const chs = await api('GET', `/rows/${r.id}/channels`);
      return { row: r, channels: chs };
    }));
    el.innerHTML = sections.map(({ row, channels }) => `
      <div class="card" style="flex-direction:column;align-items:flex-start">
        <div style="display:flex;align-items:center;width:100%;gap:1rem">
          <div class="card-body">
            <div class="card-title">${esc(row.name)}</div>
            <div class="card-subtitle">Fila ${row.enabled ? '<span class="badge badge-ok">visible</span>' : '<span class="badge badge-idle">oculta</span>'}</div>
          </div>
          <div class="card-actions">
            <button class="btn btn-sm" onclick="App.toggleRow(${row.id},${row.enabled})">
              ${row.enabled ? 'Ocultar' : 'Mostrar'}
            </button>
            <button class="btn btn-sm" onclick="App.openAddToRow(${row.id},'${esc(row.name)}')">+ Canal</button>
          </div>
        </div>
        <div class="row-channels">
          ${channels.map(c => `
            <div class="row-ch-chip">
              ${c.logo_url ? `<img src="${esc(c.logo_url)}" onerror="this.style.display='none'" />` : ''}
              ${esc(c.name)}
              <button onclick="App.removeFromRow(${row.id},${c.id})" title="Quitar">×</button>
            </div>
          `).join('') || '<span style="color:var(--text2);font-size:.82rem">Sin canales</span>'}
        </div>
      </div>
    `).join('');
  },

  async toggleRow(id, enabled) {
    await api('PUT', `/rows/${id}`, { enabled: enabled ? 0 : 1 });
    this.loadRows();
  },

  async removeFromRow(rowId, chId) {
    await api('DELETE', `/rows/${rowId}/channels/${chId}`);
    this.loadRows();
  },

  async openAddToRow(rowId, rowName) {
    const channels = await api('GET', '/channels');
    openModal(`
      <h3>Añadir canal a fila "${esc(rowName)}"</h3>
      <div class="picker-list" style="max-height:360px">
        ${channels.map(c => `
          <div class="picker-item" onclick="App.addToRow(${rowId},${c.id})">
            ${c.logo_url ? `<img src="${esc(c.logo_url)}" onerror="this.src=''" />` : '<div style="width:32px;height:32px;background:var(--bg2);border-radius:4px"></div>'}
            <span>${esc(c.name)}</span>
          </div>
        `).join('') || '<p style="color:var(--text2)">No hay canales lógicos aún.</p>'}
      </div>
    `);
  },

  async addToRow(rowId, chId) {
    await api('POST', `/rows/${rowId}/channels`, { logical_channel_id: chId }).catch(() => {});
    closeModal();
    this.loadRows();
  },

  // ── EPG ────────────────────────────────────────────────────────────────────
  async loadEpg() {
    const sources = await api('GET', '/epg-sources');
    const el = $('epg-sources-list');
    el.innerHTML = sources.length ? sources.map(s => `
      <div class="card">
        <div class="card-icon-placeholder">EPG</div>
        <div class="card-body">
          <div class="card-title">${esc(s.name)}</div>
          <div class="card-subtitle">${esc(s.url)}</div>
          <div style="margin-top:.3rem">
            ${s.last_status?.startsWith('OK')
              ? `<span class="badge badge-ok">${esc(s.last_status)}</span>`
              : s.last_status
                ? `<span class="badge badge-err">${esc(s.last_status)}</span>`
                : '<span class="badge badge-idle">Sin refrescar</span>'}
            ${s.last_fetched_at ? `<span style="color:var(--text2);font-size:.78rem;margin-left:.5rem">${relTime(s.last_fetched_at)}</span>` : ''}
          </div>
        </div>
        <div class="card-actions">
          <button class="btn btn-sm" onclick="App.refreshEpg(${s.id})">↻ Refrescar</button>
          <button class="btn btn-sm btn-danger" onclick="App.deleteEpg(${s.id})">✕</button>
        </div>
      </div>
    `).join('') : '<p class="empty-state">Sin fuentes EPG.</p>';

    this.loadEpgMap();
  },

  openAddEpg() {
    openModal(`
      <h3>Añadir fuente EPG (XMLTV)</h3>
      <div class="form-group"><label>Nombre</label><input id="epg-name" placeholder="EPG dobleM" /></div>
      <div class="form-group"><label>URL (.xml / .xml.gz)</label><input id="epg-url" placeholder="https://…" /></div>
      <div class="form-actions">
        <button class="btn-ghost" onclick="App.closeModal()">Cancelar</button>
        <button class="btn" onclick="App.addEpg()">Añadir</button>
      </div>
    `);
  },

  async addEpg() {
    const name = $('epg-name').value.trim();
    const url  = $('epg-url').value.trim();
    if (!name || !url) return alert('Rellena todos los campos');
    await api('POST', '/epg-sources', { name, url });
    closeModal();
    this.loadEpg();
  },

  async refreshEpg(id) {
    const btn = event.target; btn.textContent = '…'; btn.disabled = true;
    try {
      const r = await api('POST', `/epg-sources/${id}/refresh`);
      alert(`EPG actualizado: ${r.count} programas`);
    } catch (err) { alert(err.message); }
    btn.textContent = '↻ Refrescar'; btn.disabled = false;
    this.loadEpg();
  },

  async deleteEpg(id) {
    if (!confirm('¿Eliminar esta fuente EPG?')) return;
    await api('DELETE', `/epg-sources/${id}`);
    this.loadEpg();
  },

  async loadEpgMap() {
    const map = await api('GET', '/epg-map');
    const el = $('epg-map-list');
    el.innerHTML = map.length ? map.map(m => `
      <div class="epg-map-item">
        ${m.epg_icon ? `<img src="${esc(m.epg_icon)}" onerror="this.style.display='none'" />` : ''}
        <span class="map-ch">${esc(m.channel_name)}</span>
        <span class="map-arrow">→</span>
        <span class="map-epg">${esc(m.epg_name)}</span>
        <span class="badge ${m.auto_matched ? 'badge-idle' : 'badge-ok'}" style="font-size:.72rem">${m.auto_matched ? 'auto' : 'manual'}</span>
        <button class="btn btn-sm btn-danger" onclick="App.removeEpgMap(${m.logical_channel_id})">✕</button>
      </div>
    `).join('') : '<p class="empty-state">Sin mapeos. Usa "Auto-emparejar" o mapea manualmente.</p>';
  },

  async autoMatchEpg() {
    const r = await api('POST', '/epg-map/auto-match');
    alert(`Auto-emparejados: ${r.matched} canales`);
    this.loadEpgMap();
  },

  async removeEpgMap(lcId) {
    await api('DELETE', `/epg-map/${lcId}`);
    this.loadEpgMap();
  },

  // ── Settings ───────────────────────────────────────────────────────────────
  async loadSettings() {
    const s = await api('GET', '/settings');
    const form = $('settings-form');
    for (const [k, v] of Object.entries(s)) {
      const inp = form.querySelector(`[name="${k}"]`);
      if (inp) inp.value = v;
    }
    if (s.addon_token) {
      $('manifest-url').value = `${location.origin}/${s.addon_token}/manifest.json`;
    }
    this.loadStatus();
  },

  async saveSettings(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    delete data.manifest_url;
    await api('POST', '/settings', data);
    alert('Ajustes guardados');
    this.loadSettings();
  },

  async loadStatus() {
    const s = await api('GET', '/status');
    $('status-panel').innerHTML = `
      <h3 style="margin-bottom:1rem">Estado</h3>
      <div class="status-grid">
        ${Object.entries({ Playlists: s.playlists, 'Canales raw': s.raw_channels, 'Canales lógicos': s.logical_channels, 'Fuentes EPG': s.epg_sources, Programas: s.programmes, 'EPG mapeados': s.epg_mapped }).map(([k, v]) => `
          <div class="stat-card"><div class="stat-value">${v}</div><div class="stat-label">${k}</div></div>
        `).join('')}
      </div>
    `;
  },
};

// ── Utils ─────────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function relTime(epochSec) {
  const diff = Math.floor(Date.now() / 1000) - epochSec;
  if (diff < 60) return 'hace un momento';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return `hace ${Math.floor(diff / 86400)} días`;
}
