/* IPTV Admin SPA — vanilla JS, no build step */
const API = '/api/admin';

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error HTTP ${res.status}`);
  return data;
}

const $ = id => document.getElementById(id);

// ── Toasts ────────────────────────────────────────────────────────────────────
function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  $('toast-container').appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 4500);
}

// ── Auth ──────────────────────────────────────────────────────────────────────
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
    btn.addEventListener('click', () => App.switchTab(btn.dataset.tab));
  });

  $('modal-overlay').addEventListener('click', e => {
    if (e.target === $('modal-overlay')) closeModal();
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
  App.switchTab('home');
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function openModal(html) {
  $('modal-content').innerHTML = html;
  $('modal-overlay').classList.remove('hidden');
}
function closeModal() { $('modal-overlay').classList.add('hidden'); }

// ── App ───────────────────────────────────────────────────────────────────────
const App = {
  _channels: [],
  _logsTimer: null,
  _debounceTimer: null,
  _selectedEpg: null,
  _sourcesAddedIds: new Set(),

  switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.add('hidden'));
    $('tab-' + tab).classList.remove('hidden');
    clearInterval(this._logsTimer);
    this.loadTab(tab);
  },

  loadTab(tab) {
    if (tab === 'home')      this.loadHome();
    if (tab === 'playlists') this.loadPlaylists();
    if (tab === 'channels')  this.loadChannels();
    if (tab === 'rows')      this.loadRows();
    if (tab === 'epg')       this.loadEpg();
    if (tab === 'logs')      this.startLogs();
    if (tab === 'settings')  this.loadSettings();
  },

  closeModal: closeModal,

  // ── Home / setup guide ──────────────────────────────────────────────────────
  async loadHome() {
    const [s, settings] = await Promise.all([api('GET', '/status'), api('GET', '/settings')]);

    const steps = [
      {
        done: s.playlists > 0 && s.raw_channels > 0,
        title: '1 · Añade tu lista IPTV',
        desc: s.playlists === 0
          ? 'Ve a Playlists, añade la URL M3U de tu proveedor y pulsa ↻ Refrescar.'
          : s.raw_channels === 0
            ? `Tienes ${s.playlists} playlist pero sin canales importados — pulsa ↻ Refrescar en Playlists. Si da error, revisa la pestaña Logs.`
            : `${s.raw_channels} canales importados de tu IPTV.`,
        tab: 'playlists',
      },
      {
        done: s.channels_with_sources > 0,
        title: '2 · Crea tus canales',
        desc: s.logical_channels === 0
          ? 'Ve a Canales, crea por ejemplo "M+ LaLiga" y añádele como fuentes los canales de tu IPTV que lo emiten (puedes poner varios: serán fuentes alternativas).'
          : s.channels_with_sources === 0
            ? `Tienes ${s.logical_channels} canal(es) pero sin fuentes — entra en cada canal y pulsa "Fuentes" para añadirle canales de tu IPTV.`
            : `${s.channels_with_sources} canal(es) con fuentes configuradas.`,
        tab: 'channels',
      },
      {
        done: s.channels_in_rows > 0,
        title: '3 · Colócalos en filas',
        desc: s.channels_in_rows === 0
          ? 'Ve a Filas y añade tus canales a las secciones donde quieres verlos en Stremio/Nuvio. Puedes usar las filas por defecto (Canales, Fútbol…) o crear las tuyas.'
          : `${s.channels_in_rows} canal(es) asignados a filas.`,
        tab: 'rows',
      },
      {
        done: s.programmes > 0 && s.epg_mapped > 0,
        title: '4 · Carga la guía (EPG)',
        desc: s.programmes === 0
          ? 'Ve a EPG y pulsa ↻ Refrescar en la guía dobleM (tarda unos segundos). Después pulsa ⚡ Auto-emparejar.'
          : s.epg_mapped === 0
            ? `Guía cargada (${s.programmes.toLocaleString('es')} programas) — ahora pulsa ⚡ Auto-emparejar en EPG para conectarla con tus canales.`
            : `${s.epg_mapped} canal(es) con guía. ${s.programmes.toLocaleString('es')} programas cargados.`,
        tab: 'epg',
      },
    ];

    $('setup-steps').innerHTML = steps.map(st => `
      <div class="setup-step ${st.done ? 'done' : ''}" onclick="App.switchTab('${st.tab}')">
        <div class="step-check">${st.done ? '✓' : '○'}</div>
        <div class="step-body">
          <div class="step-title">${st.title}</div>
          <div class="step-desc">${st.desc}</div>
        </div>
        <div class="step-go">→</div>
      </div>
    `).join('');

    const allDone = steps.every(st => st.done);
    const manifestUrl = settings.addon_token
      ? `${location.origin}/${settings.addon_token}/manifest.json`
      : '';

    $('manifest-card').innerHTML = `
      <div class="manifest-card ${allDone ? 'ready' : ''}">
        <div class="step-title">${allDone ? '✓ ¡Todo listo! Instala el addon' : '5 · Instala el addon en Stremio / Nuvio'}</div>
        <div class="step-desc">Copia esta URL y pégala en Stremio (Addons → buscador) o en Nuvio:</div>
        <div class="manifest-url-row">
          <input readonly value="${esc(manifestUrl)}" onclick="this.select()" />
          <button class="btn" onclick="App.copyManifest('${esc(manifestUrl)}')">Copiar</button>
        </div>
        <div class="step-desc" style="margin-top:.5rem">⚠ Para usarlo fuera de casa el servidor debe ser accesible desde internet (cambia BASE_URL en el .env si usas IP/dominio público).</div>
      </div>
    `;
  },

  copyManifest(url) {
    navigator.clipboard.writeText(url)
      .then(() => toast('URL copiada al portapapeles', 'ok'))
      .catch(() => toast('No se pudo copiar — selecciónala a mano', 'err'));
  },

  // ── Playlists ──────────────────────────────────────────────────────────────
  async loadPlaylists() {
    const list = await api('GET', '/playlists');
    const el = $('playlists-list');
    if (!list.length) {
      el.innerHTML = `<div class="empty-state">
        <p>No hay ninguna lista todavía.</p>
        <button class="btn" onclick="App.openAddPlaylist()" style="margin-top:.8rem">+ Añadir mi lista M3U</button>
      </div>`;
      return;
    }
    el.innerHTML = list.map(p => `
      <div class="card">
        <div class="card-icon-placeholder">M3U</div>
        <div class="card-body">
          <div class="card-title">${esc(p.name)}</div>
          <div class="card-subtitle">${esc(p.url)}</div>
          <div style="margin-top:.35rem">
            ${p.last_status === 'OK'
              ? `<span class="badge badge-ok">✓ ${p.channel_count} canales</span>`
              : p.last_status
                ? `<span class="badge badge-err" title="${esc(p.last_status)}">✕ ${esc(p.last_status.slice(0, 90))}</span>`
                : '<span class="badge badge-idle">Pendiente de refrescar</span>'}
            ${p.last_fetched_at ? `<span class="time-ago">${relTime(p.last_fetched_at)}</span>` : ''}
          </div>
        </div>
        <div class="card-actions">
          <button class="btn btn-sm" onclick="App.refreshPlaylist(${p.id}, this)">↻ Refrescar</button>
          <button class="btn btn-sm btn-danger" onclick="App.deletePlaylist(${p.id})">✕</button>
        </div>
      </div>
    `).join('');
  },

  openAddPlaylist() {
    openModal(`
      <h3>Añadir playlist M3U</h3>
      <div class="form-group"><label>Nombre (para identificarla)</label><input id="pl-name" placeholder="Mi lista IPTV" /></div>
      <div class="form-group"><label>URL de la lista (.m3u / .m3u8 / get.php…)</label><input id="pl-url" placeholder="http://proveedor.com/get.php?username=…" /></div>
      <div class="form-actions">
        <button class="btn-ghost" onclick="App.closeModal()">Cancelar</button>
        <button class="btn" onclick="App.addPlaylist()">Añadir</button>
      </div>
    `);
  },

  async addPlaylist() {
    const name = $('pl-name').value.trim();
    const url  = $('pl-url').value.trim();
    if (!name || !url) return toast('Rellena nombre y URL', 'err');
    try {
      await api('POST', '/playlists', { name, url });
      closeModal();
      toast('Playlist añadida — ahora pulsa ↻ Refrescar para importar los canales', 'ok');
      this.loadPlaylists();
    } catch (err) { toast(err.message, 'err'); }
  },

  async refreshPlaylist(id, btn) {
    const orig = btn.textContent;
    btn.textContent = 'Descargando…'; btn.disabled = true;
    try {
      const r = await api('POST', `/playlists/${id}/refresh`);
      toast(`Lista refrescada: ${r.count} canales importados`, 'ok');
    } catch (err) {
      toast(err.message, 'err');
    }
    btn.textContent = orig; btn.disabled = false;
    this.loadPlaylists();
  },

  async deletePlaylist(id) {
    if (!confirm('¿Eliminar esta playlist? Se borrarán sus canales importados.')) return;
    await api('DELETE', `/playlists/${id}`);
    toast('Playlist eliminada', 'ok');
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
    if (!list.length) {
      el.innerHTML = `<div class="empty-state">
        <p>No hay canales lógicos todavía.</p>
        <p style="margin-top:.4rem;font-size:.85rem">Crea uno (ej. "M+ LaLiga") y añádele como fuentes los canales de tu IPTV.</p>
        <button class="btn" onclick="App.openAddChannel()" style="margin-top:.8rem">+ Crear mi primer canal</button>
      </div>`;
      return;
    }
    el.innerHTML = list.map(ch => `
      <div class="card">
        ${ch.logo_url
          ? `<img class="card-icon" src="${esc(ch.logo_url)}" onerror="this.style.display='none'" />`
          : `<div class="card-icon-placeholder">TV</div>`}
        <div class="card-body">
          <div class="card-title">${esc(ch.name)}</div>
          <div class="card-subtitle">id: iptv:${esc(ch.slug)}</div>
        </div>
        <div class="card-actions">
          <button class="btn-ghost btn-sm" onclick="App.openEditChannel(${ch.id},'${escAttr(ch.name)}','${escAttr(ch.logo_url || '')}')">✎ Editar</button>
          <button class="btn btn-sm" onclick="App.openSources(${ch.id},'${escAttr(ch.name)}')">⚙ Fuentes</button>
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
    App._selectedEpg = null;
    openModal(`
      <h3>Nuevo canal lógico</h3>
      <div class="form-group">
        <label>Nombre del canal (como quieres verlo en Stremio)</label>
        <input id="ch-name" placeholder="M+ LaLiga" />
      </div>
      <div class="form-group">
        <label>Logo URL (opcional — si lo dejas vacío se usará el del EPG)</label>
        <input id="ch-logo" placeholder="https://…" />
      </div>
      <div class="form-group">
        <label>Guía EPG (opcional) — da descripción "Ahora:" en Stremio</label>
        <input id="ch-epg-q" placeholder="🔍 Buscar canal en la guía EPG…" oninput="App.searchEpgForChannel(this.value)" autocomplete="off" />
        <div class="picker-list" id="ch-epg-results" style="margin-top:.4rem;max-height:180px"></div>
        <div id="ch-epg-selected" class="hidden" style="margin-top:.4rem"></div>
      </div>
      <div class="form-actions">
        <button class="btn-ghost" onclick="App.closeModal()">Cancelar</button>
        <button class="btn" onclick="App.addChannel()">Crear</button>
      </div>
    `);
    $('ch-name').focus();
  },

  async searchEpgForChannel(q) {
    clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(async () => {
      const el = $('ch-epg-results');
      if (!el) return;
      if (!q.trim()) { el.innerHTML = ''; return; }
      const results = await api('GET', `/epg-channels?search=${encodeURIComponent(q)}&limit=20`);
      el.innerHTML = results.map(ec => `
        <div class="picker-item" onclick="App.selectEpgForChannel(${ec.epg_source_id},'${escAttr(ec.channel_id)}','${escAttr(ec.display_name)}','${escAttr(ec.icon || '')}')">
          ${ec.icon ? `<img src="${esc(ec.icon)}" onerror="this.style.visibility='hidden'" />` : '<div class="picker-noimg"></div>'}
          <span>${esc(ec.display_name)}</span>
        </div>
      `).join('') || '<p class="modal-hint" style="padding:.4rem 0">Sin resultados en la guía EPG</p>';
    }, 300);
  },

  selectEpgForChannel(epgSourceId, epgChannelId, displayName, icon) {
    App._selectedEpg = { epgSourceId, epgChannelId };
    const res = $('ch-epg-results');
    if (res) res.innerHTML = '';
    const q = $('ch-epg-q');
    if (q) q.value = '';
    const sel = $('ch-epg-selected');
    if (!sel) return;
    sel.innerHTML = `
      <div class="picker-item epg-chosen">
        ${icon ? `<img src="${esc(icon)}" onerror="this.style.visibility='hidden'" />` : '<div class="picker-noimg"></div>'}
        <span style="flex:1">${esc(displayName)}</span>
        <span class="badge badge-ok" style="flex-shrink:0">✓ EPG vinculada</span>
        <button class="btn-ghost btn-sm" onclick="App.clearEpgForChannel()" style="flex-shrink:0">✕</button>
      </div>
    `;
    sel.classList.remove('hidden');
  },

  clearEpgForChannel() {
    App._selectedEpg = null;
    const sel = $('ch-epg-selected');
    if (sel) { sel.innerHTML = ''; sel.classList.add('hidden'); }
  },

  async addChannel() {
    const name = $('ch-name').value.trim();
    const logo = $('ch-logo').value.trim();
    if (!name) return toast('Introduce un nombre', 'err');
    try {
      const r = await api('POST', '/channels', { name, logo_url: logo });
      if (App._selectedEpg) {
        await api('POST', '/epg-map', {
          logical_channel_id: r.id,
          epg_source_id: App._selectedEpg.epgSourceId,
          epg_channel_id: App._selectedEpg.epgChannelId,
        }).catch(() => {});
      }
      closeModal();
      toast('Canal creado — ahora añádele fuentes', 'ok');
      await this.loadChannels();
      this.openSources(r.id, name);
    } catch (err) { toast(err.message, 'err'); }
  },

  async deleteChannel(id) {
    if (!confirm('¿Eliminar este canal y sus fuentes?')) return;
    await api('DELETE', `/channels/${id}`);
    toast('Canal eliminado', 'ok');
    this.loadChannels();
  },

  openEditChannel(id, name, logo) {
    openModal(`
      <h3>Editar canal</h3>
      <div class="form-group"><label>Nombre</label><input id="edit-ch-name" value="${esc(name)}" /></div>
      <div class="form-group"><label>Logo URL</label><input id="edit-ch-logo" value="${esc(logo)}" placeholder="https://…" /></div>
      <div class="form-actions">
        <button class="btn-ghost" onclick="App.closeModal()">Cancelar</button>
        <button class="btn" onclick="App.saveChannel(${id})">Guardar</button>
      </div>
    `);
    $('edit-ch-name').focus();
  },

  async saveChannel(id) {
    const name = $('edit-ch-name').value.trim();
    const logo = $('edit-ch-logo').value.trim();
    if (!name) return toast('El nombre no puede estar vacío', 'err');
    try {
      await api('PUT', `/channels/${id}`, { name, logo_url: logo });
      closeModal();
      toast('Canal actualizado', 'ok');
      this.loadChannels();
    } catch (err) { toast(err.message, 'err'); }
  },

  async openSources(channelId, channelName) {
    const sources = await api('GET', `/channels/${channelId}/sources`);
    App._sourcesAddedIds = new Set(sources.map(s => s.raw_id));
    openModal(`
      <h3>Fuentes de "${esc(channelName)}"</h3>
      <p class="modal-hint">Cada fuente es un canal de tu IPTV. En Stremio aparecerán como "Fuente 1", "Fuente 2"… por orden de prioridad.</p>
      <div class="sources-list" id="sources-list">
        ${this._renderSourceItems(sources, channelId, channelName)}
      </div>
      <div style="margin-top:1.1rem">
        <input class="picker-search" id="picker-q" placeholder="🔍 Buscar en tu IPTV… (ej: laliga, movistar, bein)" oninput="App.searchRaw(this.value,${channelId},'${escAttr(channelName)}')" autocomplete="off" />
        <div id="picker-hint" class="modal-hint" style="margin:.3rem 0 .2rem"></div>
        <div class="picker-list" id="picker-list"></div>
      </div>
    `);
    const q = $('picker-q');
    if (q) {
      q.focus();
      this._doSearchRaw('', channelId, channelName);
    }
  },

  _renderSourceItems(sources, channelId, channelName) {
    if (!sources.length) return '<p class="modal-hint">Sin fuentes todavía. Busca abajo y haz clic para añadir.</p>';
    return sources.map((s, i) => `
      <div class="source-item" id="src-${s.id}">
        <span class="source-num">${i + 1}</span>
        ${s.tvg_logo ? `<img src="${esc(s.tvg_logo)}" style="width:30px;height:30px;border-radius:5px;object-fit:contain;background:#fff1">` : '<div style="width:30px;height:30px;border-radius:5px;background:var(--bg3);flex-shrink:0"></div>'}
        <div class="source-info">
          <span class="source-name">${esc(s.tvg_name)}</span>
          ${s.group_title ? `<span class="source-group">${esc(s.group_title)}</span>` : ''}
        </div>
        <button class="btn btn-sm btn-danger" onclick="App.removeSource(${channelId},${s.id},'${escAttr(channelName)}')">✕</button>
      </div>
    `).join('');
  },

  async _refreshSourcesList(channelId, channelName) {
    const sources = await api('GET', `/channels/${channelId}/sources`);
    App._sourcesAddedIds = new Set(sources.map(s => s.raw_id));
    const el = $('sources-list');
    if (el) el.innerHTML = this._renderSourceItems(sources, channelId, channelName);
  },

  async removeSource(channelId, srcId, channelName) {
    await api('DELETE', `/channels/${channelId}/sources/${srcId}`);
    await this._refreshSourcesList(channelId, channelName);
    const q = $('picker-q')?.value ?? '';
    this._doSearchRaw(q, channelId, channelName);
  },

  searchRaw(q, channelId, channelName) {
    clearTimeout(this._debounceTimer);
    const delay = q.length === 0 ? 0 : 300;
    this._debounceTimer = setTimeout(() => this._doSearchRaw(q, channelId, channelName), delay);
  },

  async _doSearchRaw(q, channelId, channelName) {
    const limit = q.length === 0 ? 40 : 60;
    const results = await api('GET', `/raw-channels?search=${encodeURIComponent(q)}&limit=${limit}`);
    const el = $('picker-list');
    if (!el) return;
    const hint = $('picker-hint');
    if (hint) {
      hint.textContent = q
        ? `${results.length} resultado(s) para "${q}"`
        : `${results.length} canales — escribe para filtrar`;
    }
    const addedIds = App._sourcesAddedIds;
    if (!results.length) {
      el.innerHTML = '<p class="modal-hint">Sin resultados para esa búsqueda</p>';
      return;
    }
    el.innerHTML = results.map(rc => {
      const added = addedIds.has(rc.id);
      return `
        <div class="picker-item${added ? ' picker-item-added' : ''}"
          ${!added ? `onclick="App.addSource(${channelId},${rc.id},'${escAttr(channelName)}')"` : ''}>
          ${rc.tvg_logo ? `<img src="${esc(rc.tvg_logo)}" onerror="this.style.visibility='hidden'" />` : '<div class="picker-noimg"></div>'}
          <div class="picker-item-body">
            <span class="picker-item-name">${esc(rc.tvg_name)}</span>
            ${rc.group_title ? `<span class="picker-group-pill">${esc(rc.group_title)}</span>` : ''}
          </div>
          ${added ? '<span class="picker-check">✓ añadida</span>' : '<span class="picker-add-hint">+ añadir</span>'}
        </div>
      `;
    }).join('');
  },

  async addSource(channelId, rawId, channelName) {
    try {
      await api('POST', `/channels/${channelId}/sources`, { raw_channel_id: rawId });
      toast('Fuente añadida', 'ok');
      await this._refreshSourcesList(channelId, channelName);
      const q = $('picker-q')?.value ?? '';
      this._doSearchRaw(q, channelId, channelName);
    } catch (err) { toast(err.message, 'err'); }
  },

  // ── Rows ───────────────────────────────────────────────────────────────────
  async loadRows() {
    const rows = await api('GET', '/rows');
    const el = $('rows-list');
    const sections = await Promise.all(rows.map(async r => {
      const chs = await api('GET', `/rows/${r.id}/preview`);
      return { row: r, channels: chs };
    }));
    el.innerHTML = sections.map(({ row, channels }) => `
      <div class="card row-card">
        <div class="row-card-head">
          <div class="card-body">
            <div class="card-title">${esc(row.name)}
              ${row.enabled ? '<span class="badge badge-ok">visible</span>' : '<span class="badge badge-idle">oculta</span>'}
              <span class="badge badge-idle" style="font-size:.7rem">${channels.length} canal(es)</span>
            </div>
          </div>
          <div class="card-actions">
            <button class="btn-ghost btn-sm" onclick="App.toggleRow(${row.id},${row.enabled})">${row.enabled ? 'Ocultar' : 'Mostrar'}</button>
            <button class="btn btn-sm" onclick="App.openAddToRow(${row.id},'${escAttr(row.name)}')">+ Canal</button>
            <button class="btn btn-sm btn-danger" onclick="App.deleteRow(${row.id},'${escAttr(row.name)}')">✕</button>
          </div>
        </div>
        ${channels.length ? `
          <div class="row-preview" title="Previsualización — así aparecerá en Stremio/Nuvio">
            ${channels.map(c => `
              <div class="row-preview-card">
                <div class="row-preview-img">
                  <img src="${esc(c.poster)}" loading="lazy" onerror="this.className='rp-placeholder'" />
                </div>
                <div class="row-preview-name" title="${esc(c.name)}">${esc(c.name)}</div>
                <button class="row-preview-remove" onclick="App.removeFromRow(${row.id},${c.id})" title="Quitar">×</button>
              </div>
            `).join('')}
          </div>
        ` : '<p class="row-empty" style="padding:.6rem .3rem">Vacía — pulsa "+ Canal" para añadir</p>'}
      </div>
    `).join('') || `<div class="empty-state"><p>No hay filas todavía. Pulsa "+ Nueva fila" para crear una.</p></div>`;
  },

  async toggleRow(id, enabled) {
    await api('PUT', `/rows/${id}`, { enabled: enabled ? 0 : 1 });
    this.loadRows();
  },

  async deleteRow(id, name) {
    if (!confirm(`¿Eliminar la fila "${name}"? Los canales no se borran, solo se quitan de esta fila.`)) return;
    await api('DELETE', `/rows/${id}`);
    toast('Fila eliminada', 'ok');
    this.loadRows();
  },

  async removeFromRow(rowId, chId) {
    await api('DELETE', `/rows/${rowId}/channels/${chId}`);
    this.loadRows();
  },

  openAddRow() {
    openModal(`
      <h3>Nueva fila</h3>
      <div class="form-group">
        <label>Nombre de la sección (aparecerá como título en Stremio/Nuvio)</label>
        <input id="row-name" placeholder="Fútbol, Series, Motor, Liga…" />
      </div>
      <div class="form-actions">
        <button class="btn-ghost" onclick="App.closeModal()">Cancelar</button>
        <button class="btn" onclick="App.addRow()">Crear</button>
      </div>
    `);
    $('row-name').focus();
  },

  async addRow() {
    const name = $('row-name').value.trim();
    if (!name) return toast('Introduce un nombre para la fila', 'err');
    try {
      await api('POST', '/rows', { name });
      closeModal();
      toast(`Fila "${name}" creada`, 'ok');
      this.loadRows();
    } catch (err) { toast(err.message, 'err'); }
  },

  async openAddToRow(rowId, rowName) {
    const [channels, rowChs] = await Promise.all([
      api('GET', '/channels'),
      api('GET', `/rows/${rowId}/channels`),
    ]);
    if (!channels.length) {
      toast('Primero crea canales en la pestaña Canales', 'err');
      return;
    }
    const inRow = new Set(rowChs.map(c => c.id));
    openModal(`
      <h3>Añadir canal a "${esc(rowName)}"</h3>
      <input class="picker-search" id="row-ch-q" placeholder="🔍 Filtrar…" oninput="App._filterRowChannels(this.value)" style="margin-bottom:.5rem" />
      <div class="picker-list" id="row-ch-list" style="max-height:360px">
        ${channels.map(c => `
          <div class="picker-item${inRow.has(c.id) ? ' picker-item-added' : ''}"
            ${!inRow.has(c.id) ? `onclick="App.addToRow(${rowId},${c.id})"` : ''}>
            ${c.logo_url ? `<img src="${esc(c.logo_url)}" onerror="this.style.visibility='hidden'" />` : '<div class="picker-noimg"></div>'}
            <span>${esc(c.name)}</span>
            ${inRow.has(c.id) ? '<span class="picker-check">✓ en fila</span>' : ''}
          </div>
        `).join('')}
      </div>
    `);
    $('row-ch-q').focus();
  },

  _filterRowChannels(q) {
    const items = document.querySelectorAll('#row-ch-list .picker-item');
    items.forEach(el => {
      el.style.display = el.textContent.toLowerCase().includes(q.toLowerCase()) ? '' : 'none';
    });
  },

  async addToRow(rowId, chId) {
    try {
      await api('POST', `/rows/${rowId}/channels`, { logical_channel_id: chId });
      toast('Canal añadido a la fila', 'ok');
    } catch { toast('Ese canal ya estaba en la fila', 'err'); }
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
          <div style="margin-top:.35rem">
            ${s.last_status?.startsWith('OK')
              ? `<span class="badge badge-ok">✓ ${esc(s.last_status.slice(3))}</span>`
              : s.last_status
                ? `<span class="badge badge-err" title="${esc(s.last_status)}">✕ ${esc(s.last_status.slice(0, 90))}</span>`
                : '<span class="badge badge-idle">Pendiente de refrescar</span>'}
            ${s.last_fetched_at ? `<span class="time-ago">${relTime(s.last_fetched_at)}</span>` : ''}
          </div>
        </div>
        <div class="card-actions">
          <button class="btn btn-sm" onclick="App.refreshEpg(${s.id}, this)">↻ Refrescar</button>
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
    if (!name || !url) return toast('Rellena nombre y URL', 'err');
    try {
      await api('POST', '/epg-sources', { name, url });
      closeModal();
      toast('Fuente EPG añadida — pulsa ↻ Refrescar para cargarla', 'ok');
      this.loadEpg();
    } catch (err) { toast(err.message, 'err'); }
  },

  async refreshEpg(id, btn) {
    const orig = btn.textContent;
    btn.textContent = 'Cargando…'; btn.disabled = true;
    try {
      const r = await api('POST', `/epg-sources/${id}/refresh`);
      toast(`Guía cargada: ${r.count.toLocaleString('es')} programas`, 'ok');
    } catch (err) { toast(err.message, 'err'); }
    btn.textContent = orig; btn.disabled = false;
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
    `).join('') : '<p class="empty-state">Ningún canal emparejado con la guía todavía.<br>Pulsa <b>⚡ Auto-emparejar</b> (busca por nombre) o <b>Mapear a mano</b>.</p>';
  },

  async autoMatchEpg() {
    try {
      const r = await api('POST', '/epg-map/auto-match');
      toast(r.matched > 0
        ? `${r.matched} canal(es) emparejados con la guía`
        : 'Ningún emparejamiento automático — prueba "Mapear a mano"', r.matched > 0 ? 'ok' : 'err');
    } catch (err) { toast(err.message, 'err'); }
    this.loadEpgMap();
  },

  async openManualMap() {
    const channels = await api('GET', '/channels');
    if (!channels.length) return toast('Primero crea canales en la pestaña Canales', 'err');
    openModal(`
      <h3>Mapear canal a la guía</h3>
      <div class="form-group">
        <label>1. Elige tu canal</label>
        <select id="map-channel">${channels.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>
      </div>
      <div class="form-group">
        <label>2. Busca el canal en la guía EPG</label>
        <input id="map-q" placeholder="🔍 Ej: laliga" oninput="App.searchEpgChannels(this.value)" />
      </div>
      <div class="picker-list" id="map-results"></div>
    `);
    $('map-q').focus();
  },

  async searchEpgChannels(q) {
    if (q.length < 2) { $('map-results').innerHTML = ''; return; }
    const results = await api('GET', `/epg-channels?search=${encodeURIComponent(q)}&limit=30`);
    $('map-results').innerHTML = results.map(ec => `
      <div class="picker-item" onclick="App.saveManualMap(${ec.epg_source_id},'${escAttr(ec.channel_id)}')">
        ${ec.icon ? `<img src="${esc(ec.icon)}" onerror="this.style.visibility='hidden'" />` : '<div class="picker-noimg"></div>'}
        <span>${esc(ec.display_name)}</span>
      </div>
    `).join('') || '<p class="modal-hint">Sin resultados</p>';
  },

  async saveManualMap(epgSourceId, epgChannelId) {
    const logicalId = Number($('map-channel').value);
    try {
      await api('POST', '/epg-map', {
        logical_channel_id: logicalId,
        epg_source_id: epgSourceId,
        epg_channel_id: epgChannelId,
      });
      toast('Canal mapeado a la guía', 'ok');
      closeModal();
      this.loadEpgMap();
    } catch (err) { toast(err.message, 'err'); }
  },

  async removeEpgMap(lcId) {
    await api('DELETE', `/epg-map/${lcId}`);
    this.loadEpgMap();
  },

  // ── Logs ───────────────────────────────────────────────────────────────────
  startLogs() {
    this.loadLogs();
    this._logsTimer = setInterval(() => {
      if ($('logs-auto')?.checked && !$('tab-logs').classList.contains('hidden')) this.loadLogs();
    }, 4000);
  },

  async loadLogs() {
    const logs = await api('GET', '/logs?limit=200');
    const el = $('logs-list');
    if (!el) return;
    el.innerHTML = logs.length ? logs.map(l => `
      <div class="log-line log-${l.level}">
        <span class="log-ts">${new Date(l.ts).toLocaleTimeString('es-ES')}</span>
        <span class="log-level">${l.level.toUpperCase()}</span>
        <span class="log-msg">${esc(l.msg)}</span>
      </div>
    `).join('') : '<p class="empty-state">Sin actividad todavía.</p>';
  },

  // ── Settings ───────────────────────────────────────────────────────────────
  async loadSettings() {
    const s = await api('GET', '/settings');
    const form = $('settings-form');
    for (const [k, v] of Object.entries(s)) {
      const inp = form.querySelector(`[name="${k}"]`);
      if (inp) inp.value = v;
    }
    this._updateOrientationUI(s.poster_orientation || 'landscape');
    this.loadStatus();
  },

  _updateOrientationUI(active) {
    document.querySelectorAll('.orient-btn').forEach(btn => {
      btn.classList.toggle('orient-active', btn.dataset.orient === active);
    });
  },

  async switchOrientation(orientation) {
    const btn = document.querySelector(`.orient-btn[data-orient="${orientation}"]`);
    const orig = btn?.textContent;
    if (btn) { btn.disabled = true; }
    try {
      await api('POST', '/settings/switch-orientation', { orientation });
      this._updateOrientationUI(orientation);
      toast(`Orientación cambiada a ${orientation === 'landscape' ? 'horizontal' : 'vertical'}. Pulsa ↻ Refrescar en EPG para aplicar.`, 'ok');
    } catch (err) { toast(err.message, 'err'); }
    if (btn) { btn.disabled = false; }
  },

  async saveSettings(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    await api('POST', '/settings', data);
    toast('Ajustes guardados', 'ok');
    this.loadSettings();
  },

  async loadStatus() {
    const s = await api('GET', '/status');
    $('status-panel').innerHTML = `
      <h3 style="margin-bottom:1rem">Estado</h3>
      <div class="status-grid">
        ${Object.entries({
          'Playlists': s.playlists,
          'Canales IPTV': s.raw_channels,
          'Canales creados': s.logical_channels,
          'En filas': s.channels_in_rows,
          'Programas EPG': s.programmes.toLocaleString('es'),
          'Con guía': s.epg_mapped,
        }).map(([k, v]) => `
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

// for use inside single-quoted JS strings in inline handlers
function escAttr(s) {
  return esc(s).replace(/\\/g, '\\\\');
}

function relTime(epochSec) {
  const diff = Math.floor(Date.now() / 1000) - epochSec;
  if (diff < 60) return 'hace un momento';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return `hace ${Math.floor(diff / 86400)} días`;
}
