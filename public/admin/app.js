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

// tiny inline icons for tile tools
const ICONS = {
  left:   '<svg viewBox="0 0 24 24"><path d="m14 6-6 6 6 6"/></svg>',
  right:  '<svg viewBox="0 0 24 24"><path d="m10 6 6 6-6 6"/></svg>',
  eye:    '<svg viewBox="0 0 24 24"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24"><path d="M3 3l18 18M10.5 5.2A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a17.8 17.8 0 0 1-3.2 3.8M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a10 10 0 0 0 4.2-.9"/></svg>',
  x:      '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  pencil: '<svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  gear:   '<svg viewBox="0 0 24 24"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>',
};

// ── Toasts ────────────────────────────────────────────────────────────────────
function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  $('toast-container').appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 4500);
}

// ── Confirm dialog (replaces native confirm) ──────────────────────────────────
function confirmDialog(msg, yesLabel = 'Eliminar') {
  return new Promise(resolve => {
    $('confirm-msg').textContent = msg;
    $('confirm-yes').textContent = yesLabel;
    $('confirm-overlay').classList.remove('hidden');
    const done = val => {
      $('confirm-overlay').classList.add('hidden');
      $('confirm-yes').onclick = $('confirm-no').onclick = $('confirm-overlay').onclick = null;
      resolve(val);
    };
    $('confirm-yes').onclick = () => done(true);
    $('confirm-no').onclick = () => done(false);
    $('confirm-overlay').onclick = e => { if (e.target === $('confirm-overlay')) done(false); };
  });
}

// ── Skeleton loader ───────────────────────────────────────────────────────────
function skel(el, n = 3) {
  el.innerHTML = Array.from({ length: n }, () => '<div class="skel"></div>').join('');
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

  document.querySelectorAll('.nav-item[data-tab]').forEach(btn => {
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
  App.applyHints();
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
  _rows: [],
  _rowPreviews: {},
  _logsTimer: null,
  _debounceTimer: null,
  _selectedEpg: null,
  _sourcesAddedIds: new Set(),
  _editor: null,
  _editorSources: [],

  switchTab(tab) {
    document.querySelectorAll('.nav-item[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
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

  // ── Dismissible hints ───────────────────────────────────────────────────────
  applyHints() {
    document.querySelectorAll('.banner[data-hint]').forEach(b => {
      if (localStorage.getItem('hint-' + b.dataset.hint) === '1') b.classList.add('hidden');
    });
  },

  dismissHint(btn) {
    const b = btn.closest('.banner');
    localStorage.setItem('hint-' + b.dataset.hint, '1');
    b.classList.add('hidden');
  },

  // ── Home / dashboard ────────────────────────────────────────────────────────
  async loadHome() {
    skel($('setup-steps'), 4);
    const [s, settings] = await Promise.all([api('GET', '/status'), api('GET', '/settings')]);

    $('home-stats').innerHTML = Object.entries({
      'Canales en tu IPTV': s.raw_channels.toLocaleString('es'),
      'Canales creados': s.logical_channels,
      'En filas': s.channels_in_rows,
      'Con guía EPG': s.epg_mapped,
      'Programas cargados': s.programmes.toLocaleString('es'),
    }).map(([k, v]) => `
      <div class="stat-card"><div class="stat-value">${v}</div><div class="stat-label">${k}</div></div>
    `).join('');

    const steps = [
      {
        done: s.playlists > 0 && s.raw_channels > 0,
        title: '1 · Añade tu lista IPTV',
        desc: s.playlists === 0
          ? 'Ve a Lista IPTV, añade la URL de tu proveedor y pulsa ↻ Refrescar.'
          : s.raw_channels === 0
            ? `Tienes ${s.playlists} lista(s) pero sin canales importados — pulsa ↻ Refrescar. Si da error, revisa Logs.`
            : `${s.raw_channels.toLocaleString('es')} canales importados de tu IPTV.`,
        tab: 'playlists',
      },
      {
        done: s.channels_with_sources > 0,
        title: '2 · Crea tus canales',
        desc: s.logical_channels === 0
          ? 'Crea por ejemplo "M+ LaLiga" y añádele como fuentes los canales de tu IPTV que lo emiten.'
          : s.channels_with_sources === 0
            ? `Tienes ${s.logical_channels} canal(es) pero sin fuentes — ábrelos y añade fuentes desde su editor.`
            : `${s.channels_with_sources} canal(es) con fuentes configuradas.`,
        tab: 'channels',
      },
      {
        done: s.channels_in_rows > 0,
        title: '3 · Colócalos en filas',
        desc: s.channels_in_rows === 0
          ? 'Añade tus canales a las secciones donde quieres verlos en Stremio: Canales, Fútbol, Baloncesto, Motor…'
          : `${s.channels_in_rows} canal(es) asignados a filas.`,
        tab: 'rows',
      },
      {
        done: s.programmes > 0 && s.epg_mapped > 0,
        title: '4 · Carga la guía (EPG)',
        desc: s.programmes === 0
          ? 'Ve a Guía EPG y pulsa ↻ Refrescar en la guía dobleM. Después pulsa ⚡ Auto-emparejar.'
          : s.epg_mapped === 0
            ? `Guía cargada (${s.programmes.toLocaleString('es')} programas) — pulsa ⚡ Auto-emparejar para conectarla con tus canales.`
            : `${s.epg_mapped} canal(es) con guía y carátulas.`,
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
          <button class="btn btn-grad" onclick="App.copyManifest('${esc(manifestUrl)}')">Copiar</button>
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
    skel($('playlists-list'), 2);
    const list = await api('GET', '/playlists');
    const el = $('playlists-list');
    if (!list.length) {
      el.innerHTML = `<div class="empty-state">
        <p>No hay ninguna lista todavía.</p>
        <button class="btn btn-grad" onclick="App.openAddPlaylist()" style="margin-top:.8rem">+ Añadir mi lista</button>
      </div>`;
      return;
    }
    el.innerHTML = list.map(p => `
      <div class="card">
        <div class="card-icon-placeholder">M3U</div>
        <div class="card-body">
          <div class="card-title">${esc(p.name)}</div>
          <div class="card-subtitle">${esc(p.url)}</div>
          <div style="margin-top:.4rem">
            ${p.last_status === 'OK'
              ? `<span class="badge badge-ok">✓ ${p.channel_count.toLocaleString('es')} canales</span>`
              : p.last_status
                ? `<span class="badge badge-err" title="${esc(p.last_status)}">✕ ${esc(p.last_status.slice(0, 90))}</span>`
                : '<span class="badge badge-idle">Pendiente de refrescar</span>'}
            ${p.last_fetched_at ? `<span class="time-ago">${relTime(p.last_fetched_at)}</span>` : ''}
          </div>
        </div>
        <div class="card-actions">
          <button class="btn btn-sm" onclick="App.refreshPlaylist(${p.id}, this)">↻ Refrescar</button>
          <button class="btn-sm mini-btn mini-danger" onclick="App.deletePlaylist(${p.id})" title="Eliminar">${ICONS.x}</button>
        </div>
      </div>
    `).join('');
  },

  openAddPlaylist() {
    openModal(`
      <h3>Añadir lista IPTV</h3>
      <div class="form-group"><label>Nombre (para identificarla)</label><input id="pl-name" placeholder="Mi lista IPTV" /></div>
      <div class="form-group"><label>URL (.m3u / .m3u8 / get.php de Xtream…)</label><input id="pl-url" placeholder="http://proveedor.com/get.php?username=…" /></div>
      <div class="form-actions">
        <button class="btn-ghost" onclick="App.closeModal()">Cancelar</button>
        <button class="btn btn-grad" onclick="App.addPlaylist()">Añadir</button>
      </div>
    `);
    $('pl-name').focus();
  },

  async addPlaylist() {
    const name = $('pl-name').value.trim();
    const url  = $('pl-url').value.trim();
    if (!name || !url) return toast('Rellena nombre y URL', 'err');
    try {
      await api('POST', '/playlists', { name, url });
      closeModal();
      toast('Lista añadida — pulsa ↻ Refrescar para importar los canales', 'ok');
      this.loadPlaylists();
    } catch (err) { toast(err.message, 'err'); }
  },

  async refreshPlaylist(id, btn) {
    const orig = btn.textContent;
    btn.textContent = 'Descargando…'; btn.disabled = true;
    try {
      const r = await api('POST', `/playlists/${id}/refresh`);
      toast(`Lista refrescada: ${r.count.toLocaleString('es')} canales importados`, 'ok');
    } catch (err) {
      toast(err.message, 'err');
    }
    btn.textContent = orig; btn.disabled = false;
    this.loadPlaylists();
  },

  async deletePlaylist(id) {
    if (!await confirmDialog('¿Eliminar esta lista? Se borrarán sus canales importados.')) return;
    await api('DELETE', `/playlists/${id}`);
    toast('Lista eliminada', 'ok');
    this.loadPlaylists();
  },

  // ── Channels ───────────────────────────────────────────────────────────────
  async loadChannels() {
    skel($('channels-list'), 3);
    const list = await api('GET', '/channels');
    this._channels = list;
    this._renderChannels(list);
  },

  _renderChannels(list) {
    const el = $('channels-list');
    if (!list.length) {
      el.innerHTML = `<div class="empty-state">
        <p>No hay canales todavía.</p>
        <p style="margin-top:.4rem;font-size:.85rem">Crea uno (ej. "M+ LaLiga") y añádele como fuentes los canales de tu IPTV.</p>
        <button class="btn btn-grad" onclick="App.openAddChannel()" style="margin-top:.8rem">+ Crear mi primer canal</button>
      </div>`;
      return;
    }
    el.innerHTML = list.map(ch => `
      <div class="card clickable ${ch.enabled ? '' : 'card-off'}" onclick="App.openChannelEditor(${ch.id})">
        ${ch.logo_url
          ? `<img class="card-icon" src="${esc(ch.logo_url)}" onerror="this.style.display='none'" />`
          : `<div class="card-icon-placeholder">TV</div>`}
        <div class="card-body">
          <div class="card-title">${esc(ch.name)}
            ${ch.enabled ? '' : '<span class="badge badge-idle">oculto</span>'}
          </div>
          <div style="margin-top:.4rem;display:flex;gap:.4rem;flex-wrap:wrap">
            <span class="badge ${ch.source_count ? 'badge-acc' : 'badge-err'}">${ch.source_count} fuente(s)</span>
            <span class="badge ${ch.has_epg ? 'badge-ok' : 'badge-idle'}">${ch.has_epg ? '✓ EPG' : 'sin EPG'}</span>
            <span class="badge ${ch.row_count ? 'badge-acc' : 'badge-idle'}">${ch.row_count} fila(s)</span>
          </div>
        </div>
        <div class="card-actions">
          <span class="badge badge-idle" style="font-size:.7rem">editar →</span>
        </div>
      </div>
    `).join('');
  },

  filterChannels(q) {
    const filtered = this._channels.filter(c => c.name.toLowerCase().includes(q.toLowerCase()));
    this._renderChannels(filtered);
  },

  // ── Quick create channel ─────────────────────────────────────────────────────
  openAddChannel() {
    App._selectedEpg = null;
    openModal(`
      <h3>Nuevo canal</h3>
      <div class="form-group">
        <label>Nombre del canal (como quieres verlo en Stremio)</label>
        <input id="ch-name" placeholder="M+ LaLiga" />
      </div>
      <div class="form-group">
        <label>Logo URL (opcional — si lo dejas vacío se usará el del EPG)</label>
        <input id="ch-logo" placeholder="https://…" />
      </div>
      <div class="form-group">
        <label>Guía EPG (opcional) — para "Ahora:", carátulas y fanart</label>
        <input id="ch-epg-q" placeholder="🔍 Buscar canal en la guía…" oninput="App.searchEpgForChannel(this.value)" autocomplete="off" />
        <div class="picker-list" id="ch-epg-results" style="margin-top:.4rem;max-height:180px"></div>
        <div id="ch-epg-selected" class="hidden" style="margin-top:.4rem"></div>
      </div>
      <div class="form-actions">
        <button class="btn-ghost" onclick="App.closeModal()">Cancelar</button>
        <button class="btn btn-grad" onclick="App.addChannel()">Crear</button>
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
      `).join('') || '<p class="modal-hint" style="padding:.4rem 0">Sin resultados en la guía</p>';
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
      this.openChannelEditor(r.id, 'fuentes');
    } catch (err) { toast(err.message, 'err'); }
  },

  // ── Unified channel editor ───────────────────────────────────────────────────
  async openChannelEditor(id, section = 'datos') {
    let ch = this._channels.find(c => c.id === id);
    if (!ch) {
      this._channels = await api('GET', '/channels');
      ch = this._channels.find(c => c.id === id);
    }
    if (!ch) return toast('Canal no encontrado', 'err');
    this._editor = { ...ch, section };
    openModal(`
      <div class="ed-head">
        ${ch.logo_url
          ? `<img src="${esc(ch.logo_url)}" onerror="this.style.display='none'" />`
          : '<div class="card-icon-placeholder">TV</div>'}
        <h3>${esc(ch.name)}</h3>
        <button class="mini-btn mini-danger" onclick="App.deleteChannel(${ch.id})" title="Eliminar canal">${ICONS.x}</button>
      </div>
      <div class="ed-tabs">
        <button class="ed-tab" data-sec="datos" onclick="App.editorSection('datos')">Datos</button>
        <button class="ed-tab" data-sec="fuentes" onclick="App.editorSection('fuentes')">Fuentes</button>
        <button class="ed-tab" data-sec="epg" onclick="App.editorSection('epg')">Guía EPG</button>
        <button class="ed-tab" data-sec="filas" onclick="App.editorSection('filas')">Filas</button>
      </div>
      <div class="ed-pane" id="ed-pane"></div>
    `);
    this.editorSection(section);
  },

  editorSection(sec) {
    this._editor.section = sec;
    document.querySelectorAll('.ed-tab').forEach(t => t.classList.toggle('active', t.dataset.sec === sec));
    if (sec === 'datos')   this._edDatos();
    if (sec === 'fuentes') this._edFuentes();
    if (sec === 'epg')     this._edEpg();
    if (sec === 'filas')   this._edFilas();
  },

  _edDatos() {
    const ch = this._editor;
    $('ed-pane').innerHTML = `
      <div class="form-group"><label>Nombre</label><input id="ed-name" value="${esc(ch.name)}" /></div>
      <div class="form-group"><label>Logo URL (vacío = logo del EPG)</label><input id="ed-logo" value="${esc(ch.logo_url || '')}" placeholder="https://…" /></div>
      <label class="switch-label" style="margin:.4rem 0 1rem">
        <span class="switch"><input type="checkbox" id="ed-enabled" ${ch.enabled ? 'checked' : ''} /><span class="track"></span></span>
        Visible en el addon
      </label>
      <div class="form-actions">
        <button class="btn btn-grad" onclick="App.saveChannelData()">Guardar cambios</button>
      </div>
    `;
  },

  async saveChannelData() {
    const ch = this._editor;
    const name = $('ed-name').value.trim();
    const logo = $('ed-logo').value.trim();
    const enabled = $('ed-enabled').checked ? 1 : 0;
    if (!name) return toast('El nombre no puede estar vacío', 'err');
    try {
      await api('PUT', `/channels/${ch.id}`, { name, logo_url: logo, enabled });
      Object.assign(ch, { name, logo_url: logo, enabled });
      toast('Canal guardado', 'ok');
      await this.loadChannels();
      this.openChannelEditor(ch.id, 'datos');
    } catch (err) { toast(err.message, 'err'); }
  },

  async deleteChannel(id) {
    if (!await confirmDialog('¿Eliminar este canal y sus fuentes?')) return;
    await api('DELETE', `/channels/${id}`);
    closeModal();
    toast('Canal eliminado', 'ok');
    this.loadChannels();
  },

  // ── Editor: fuentes ─────────────────────────────────────────────────────────
  async _edFuentes() {
    const ch = this._editor;
    $('ed-pane').innerHTML = `
      <p class="modal-hint">Cada fuente es un canal de tu IPTV. En Stremio aparecen como "Fuente 1, 2…" por orden — usa las flechas para priorizar.</p>
      <div class="sources-list" id="sources-list"><div class="skel" style="height:44px"></div></div>
      <div style="margin-top:1.1rem">
        <input class="picker-search" id="picker-q" placeholder="🔍 Buscar en tu IPTV… (ej: laliga, movistar)" oninput="App.searchRaw(this.value)" autocomplete="off" />
        <div id="picker-hint" class="modal-hint" style="margin:.3rem 0 .2rem"></div>
        <div class="picker-list" id="picker-list"></div>
      </div>
    `;
    await this._refreshSourcesList();
    const q = $('picker-q');
    if (q) { q.focus(); this._doSearchRaw(''); }
  },

  _renderSourceItems() {
    const sources = this._editorSources;
    if (!sources.length) return '<p class="modal-hint">Sin fuentes todavía. Busca abajo y haz clic para añadir.</p>';
    return sources.map((s, i) => `
      <div class="source-item">
        <span class="source-num">${i + 1}</span>
        ${s.tvg_logo ? `<img src="${esc(s.tvg_logo)}" style="width:30px;height:30px;border-radius:5px;object-fit:contain;background:rgba(255,255,255,.08)">` : '<div style="width:30px;height:30px;border-radius:5px;background:var(--glass2);flex-shrink:0"></div>'}
        <div class="source-info">
          <span class="source-name">${esc(s.tvg_name)}</span>
          ${s.group_title ? `<span class="source-group">${esc(s.group_title)}</span>` : ''}
        </div>
        <button class="mini-btn" onclick="App.moveSource(${i},-1)" ${i === 0 ? 'disabled' : ''} title="Subir prioridad">↑</button>
        <button class="mini-btn" onclick="App.moveSource(${i},1)" ${i === sources.length - 1 ? 'disabled' : ''} title="Bajar prioridad">↓</button>
        <button class="mini-btn mini-danger" onclick="App.removeSource(${s.id})" title="Quitar">${ICONS.x}</button>
      </div>
    `).join('');
  },

  async _refreshSourcesList() {
    const ch = this._editor;
    this._editorSources = await api('GET', `/channels/${ch.id}/sources`);
    this._sourcesAddedIds = new Set(this._editorSources.map(s => s.raw_id));
    const el = $('sources-list');
    if (el) el.innerHTML = this._renderSourceItems();
  },

  async moveSource(idx, dir) {
    const arr = this._editorSources;
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    try {
      await api('PUT', `/channels/${this._editor.id}/sources-order`, { order: arr.map(s => s.id) });
      $('sources-list').innerHTML = this._renderSourceItems();
    } catch (err) { toast(err.message, 'err'); }
  },

  async removeSource(srcId) {
    await api('DELETE', `/channels/${this._editor.id}/sources/${srcId}`);
    await this._refreshSourcesList();
    this._doSearchRaw($('picker-q')?.value ?? '');
  },

  searchRaw(q) {
    clearTimeout(this._debounceTimer);
    const delay = q.length === 0 ? 0 : 300;
    this._debounceTimer = setTimeout(() => this._doSearchRaw(q), delay);
  },

  async _doSearchRaw(q) {
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
    if (!results.length) {
      el.innerHTML = '<p class="modal-hint">Sin resultados para esa búsqueda</p>';
      return;
    }
    el.innerHTML = results.map(rc => {
      const added = this._sourcesAddedIds.has(rc.id);
      return `
        <div class="picker-item${added ? ' picker-item-added' : ''}"
          ${!added ? `onclick="App.addSource(${rc.id})"` : ''}>
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

  async addSource(rawId) {
    try {
      await api('POST', `/channels/${this._editor.id}/sources`, { raw_channel_id: rawId });
      toast('Fuente añadida', 'ok');
      await this._refreshSourcesList();
      this._doSearchRaw($('picker-q')?.value ?? '');
    } catch (err) { toast(err.message, 'err'); }
  },

  // ── Editor: EPG ─────────────────────────────────────────────────────────────
  async _edEpg() {
    const ch = this._editor;
    const maps = await api('GET', '/epg-map');
    const current = maps.find(m => m.logical_channel_id === ch.id);
    $('ed-pane').innerHTML = `
      <p class="modal-hint">Conecta el canal con la guía para tener "Ahora:", programación del día y carátulas/fanart.</p>
      <div id="ed-epg-current">
        ${current ? `
          <div class="picker-item epg-chosen">
            ${current.epg_icon ? `<img src="${esc(current.epg_icon)}" onerror="this.style.visibility='hidden'" />` : '<div class="picker-noimg"></div>'}
            <span style="flex:1">${esc(current.epg_name)}</span>
            <span class="badge ${current.auto_matched ? 'badge-idle' : 'badge-ok'}">${current.auto_matched ? 'auto' : 'manual'}</span>
            <button class="btn-ghost btn-sm" onclick="App.editorRemoveEpg()">Quitar</button>
          </div>
        ` : '<p class="modal-hint" style="color:var(--warn)">Sin guía vinculada — búscala abajo.</p>'}
      </div>
      <div class="form-group" style="margin-top:1rem">
        <label>${current ? 'Cambiar canal de la guía' : 'Buscar canal en la guía'}</label>
        <input id="ed-epg-q" placeholder="🔍 Ej: laliga" oninput="App.editorSearchEpg(this.value)" autocomplete="off" />
      </div>
      <div class="picker-list" id="ed-epg-results"></div>
    `;
  },

  editorSearchEpg(q) {
    clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(async () => {
      const el = $('ed-epg-results');
      if (!el) return;
      if (!q.trim()) { el.innerHTML = ''; return; }
      const results = await api('GET', `/epg-channels?search=${encodeURIComponent(q)}&limit=25`);
      el.innerHTML = results.map(ec => `
        <div class="picker-item" onclick="App.editorSetEpg(${ec.epg_source_id},'${escAttr(ec.channel_id)}')">
          ${ec.icon ? `<img src="${esc(ec.icon)}" onerror="this.style.visibility='hidden'" />` : '<div class="picker-noimg"></div>'}
          <span>${esc(ec.display_name)}</span>
        </div>
      `).join('') || '<p class="modal-hint">Sin resultados</p>';
    }, 300);
  },

  async editorSetEpg(epgSourceId, epgChannelId) {
    try {
      await api('POST', '/epg-map', {
        logical_channel_id: this._editor.id,
        epg_source_id: epgSourceId,
        epg_channel_id: epgChannelId,
      });
      toast('Canal vinculado a la guía', 'ok');
      this._edEpg();
    } catch (err) { toast(err.message, 'err'); }
  },

  async editorRemoveEpg() {
    await api('DELETE', `/epg-map/${this._editor.id}`);
    toast('Guía desvinculada', 'ok');
    this._edEpg();
  },

  // ── Editor: filas ───────────────────────────────────────────────────────────
  async _edFilas() {
    const ch = this._editor;
    const rows = await api('GET', '/rows');
    const memberships = await Promise.all(rows.map(async r => {
      const chs = await api('GET', `/rows/${r.id}/channels`);
      return chs.some(c => c.id === ch.id);
    }));
    $('ed-pane').innerHTML = `
      <p class="modal-hint">Marca las filas (secciones de Stremio/Nuvio) donde quieres que aparezca este canal.</p>
      ${rows.map((r, i) => `
        <label class="switch-label" style="padding:.5rem 0;border-bottom:1px solid var(--border)">
          <span class="switch"><input type="checkbox" ${memberships[i] ? 'checked' : ''}
            onchange="App.editorToggleRow(${r.id}, this.checked, this)" /><span class="track"></span></span>
          ${esc(r.name)}
          ${r.enabled ? '' : '<span class="badge badge-idle">fila oculta</span>'}
        </label>
      `).join('')}
    `;
  },

  async editorToggleRow(rowId, on, input) {
    try {
      if (on) {
        await api('POST', `/rows/${rowId}/channels`, { logical_channel_id: this._editor.id });
      } else {
        await api('DELETE', `/rows/${rowId}/channels/${this._editor.id}`);
      }
      toast(on ? 'Añadido a la fila' : 'Quitado de la fila', 'ok');
    } catch (err) {
      input.checked = !on;
      toast(err.message, 'err');
    }
  },

  // ── Rows ───────────────────────────────────────────────────────────────────
  async loadRows() {
    skel($('rows-list'), 3);
    const rows = await api('GET', '/rows');
    this._rows = rows;
    const sections = await Promise.all(rows.map(async r => {
      const prev = await api('GET', `/rows/${r.id}/preview`);
      this._rowPreviews[r.id] = prev;
      return { row: r, ...prev };
    }));
    const el = $('rows-list');
    el.innerHTML = sections.map(({ row, channels, orientation, displayMode }, idx) => {
      const mode = displayMode || row.display_mode || 'epg';
      const modeLabel = mode === 'canal' ? 'Carátula' : 'EPG';
      const modeCls   = mode === 'canal' ? 'badge-accent' : 'badge-idle';
      return `
      <div class="card row-card">
        <div class="row-card-head">
          <div class="row-order-btns">
            <button class="mini-btn" onclick="App.moveRow(${row.id},-1)" ${idx === 0 ? 'disabled' : ''} title="Subir">▲</button>
            <button class="mini-btn" onclick="App.moveRow(${row.id},1)" ${idx === sections.length - 1 ? 'disabled' : ''} title="Bajar">▼</button>
          </div>
          <span class="row-name" id="row-name-${row.id}" onclick="App.editRowName(${row.id})" title="Clic para renombrar">${esc(row.name)}</span>
          <span class="badge ${modeCls}" title="Modo de visualización de la fila">${modeLabel}</span>
          <span class="badge badge-idle">${channels.length} canal(es)</span>
          <div class="card-actions" style="margin-left:auto">
            <button class="mini-btn" onclick="App.openRowSettings(${row.id})" title="Configurar modo de la fila">${ICONS.gear}</button>
            <label class="switch-label" title="Visible en el addon">
              <span class="switch"><input type="checkbox" ${row.enabled ? 'checked' : ''} onchange="App.toggleRow(${row.id}, this.checked)" /><span class="track"></span></span>
            </label>
            <button class="btn btn-sm" onclick="App.openAddToRow(${row.id},'${escAttr(row.name)}')">+ Canal</button>
            <button class="mini-btn mini-danger" onclick="App.deleteRow(${row.id},'${escAttr(row.name)}')" title="Eliminar fila">${ICONS.x}</button>
          </div>
        </div>
        ${channels.length ? `
          <div class="row-preview" title="Previsualización — así aparecerá en Stremio/Nuvio">
            ${channels.map((c, ci) => {
              const hasCustom = !!(c.custom_poster || c.custom_name);
              return `
              <div class="row-preview-card row-preview-${orientation} ${c.enabled ? '' : 'rp-off'} ${hasCustom ? 'rp-custom' : ''}">
                <div class="row-preview-img row-preview-img-${orientation}">
                  ${c.enabled ? '' : '<span class="rp-off-badge">OCULTO</span>'}
                  ${hasCustom ? '<span class="rp-custom-badge" title="Tiene personalización en esta fila">✏</span>' : ''}
                  <img src="${esc(c.poster)}" loading="lazy"
                    onerror="if(this.getAttribute('data-fb')){this.className='rp-placeholder';this.removeAttribute('data-fb');}else{this.setAttribute('data-fb','1');this.src='${escAttr(c.fallback)}'}" />
                  <div class="rp-tools">
                    <button class="rp-tool" onclick="App.moveInRow(${row.id},${ci},-1)" ${ci === 0 ? 'disabled' : ''} title="Mover a la izquierda">${ICONS.left}</button>
                    <button class="rp-tool" onclick="App.toggleChannelEnabled(${c.id},${c.enabled ? 0 : 1})" title="${c.enabled ? 'Ocultar canal en el addon' : 'Mostrar canal en el addon'}">${c.enabled ? ICONS.eyeOff : ICONS.eye}</button>
                    <button class="rp-tool" onclick="App.openRowChannelCustom(${row.id},${c.id},'${escAttr(c.custom_poster||'')}','${escAttr(c.custom_name||'')}','${escAttr(c.name)}')" title="Personalizar en esta fila">${ICONS.pencil}</button>
                    <button class="rp-tool" onclick="App.moveInRow(${row.id},${ci},1)" ${ci === channels.length - 1 ? 'disabled' : ''} title="Mover a la derecha">${ICONS.right}</button>
                    <button class="rp-tool rp-tool-danger" onclick="App.removeFromRow(${row.id},${c.id})" title="Quitar de la fila">${ICONS.x}</button>
                  </div>
                </div>
                <div class="row-preview-name" title="${esc(c.name)}">${esc(c.custom_name || c.name)}</div>
              </div>`;
            }).join('')}
          </div>
        ` : '<p class="row-empty" style="padding:.6rem .3rem">Vacía — pulsa "+ Canal" para añadir</p>'}
      </div>`;
    }).join('') || `<div class="empty-state"><p>No hay filas todavía. Pulsa "+ Nueva fila" para crear una.</p></div>`;
  },

  openAddRow() {
    openModal(`
      <h3>Nueva fila</h3>
      <div class="form-group"><label>Nombre de la sección (ej. Tenis, Cine, Infantil…)</label><input id="row-name" placeholder="Tenis" /></div>
      <div class="form-actions">
        <button class="btn-ghost" onclick="App.closeModal()">Cancelar</button>
        <button class="btn btn-grad" onclick="App.addRow()">Crear</button>
      </div>
    `);
    $('row-name').focus();
  },

  async addRow() {
    const name = $('row-name').value.trim();
    if (!name) return toast('Introduce un nombre', 'err');
    try {
      await api('POST', '/rows', { name });
      closeModal();
      toast('Fila creada', 'ok');
      this.loadRows();
    } catch (err) { toast(err.message, 'err'); }
  },

  async deleteRow(id, name) {
    if (!await confirmDialog(`¿Eliminar la fila "${name}"? Los canales no se borran, solo la sección.`)) return;
    await api('DELETE', `/rows/${id}`);
    toast('Fila eliminada', 'ok');
    this.loadRows();
  },

  async toggleRow(id, on) {
    await api('PUT', `/rows/${id}`, { enabled: on ? 1 : 0 });
    toast(on ? 'Fila visible en el addon' : 'Fila oculta', 'ok');
    this.loadRows();
  },

  async moveRow(rowId, dir) {
    const idx = this._rows.findIndex(r => r.id === rowId);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= this._rows.length) return;
    [this._rows[idx], this._rows[j]] = [this._rows[j], this._rows[idx]];
    await Promise.all(this._rows.map((r, i) => api('PUT', `/rows/${r.id}`, { sort_order: i })));
    this.loadRows();
  },

  editRowName(rowId) {
    const span = $(`row-name-${rowId}`);
    if (!span || span.dataset.editing) return;
    span.dataset.editing = '1';
    const current = span.textContent;
    span.outerHTML = `<input class="row-name-input" id="row-name-${rowId}" value="${esc(current)}" />`;
    const input = $(`row-name-${rowId}`);
    input.focus();
    input.select();
    const save = async () => {
      const name = input.value.trim();
      if (name && name !== current) {
        try {
          await api('PUT', `/rows/${rowId}`, { name });
          toast('Fila renombrada', 'ok');
        } catch (err) { toast(err.message, 'err'); }
      }
      this.loadRows();
    };
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') input.blur();
      if (e.key === 'Escape') { input.value = current; input.blur(); }
    });
    input.addEventListener('blur', save, { once: true });
  },

  openRowSettings(rowId) {
    const row = this._rows.find(r => r.id === rowId);
    if (!row) return;
    const mode = row.display_mode || 'epg';
    openModal(`
      <h3>Configurar fila: ${esc(row.name)}</h3>
      <p class="hint" style="margin-bottom:1rem">Elige cómo se visualizan los canales en Stremio/Nuvio. Puedes personalizar cada canal individualmente con el botón ✏ del tile.</p>
      <div class="orientation-btns" id="row-mode-btns" style="margin-bottom:1rem">
        <button class="orient-btn ${mode === 'epg' ? 'orient-active' : ''}" onclick="App._selectRowMode('epg')" data-mode="epg">
          <span class="orient-label">EPG en directo</span>
          <span class="orient-hint">Título del evento + fanart</span>
        </button>
        <button class="orient-btn ${mode === 'canal' ? 'orient-active' : ''}" onclick="App._selectRowMode('canal')" data-mode="canal">
          <span class="orient-label">Nombre de canal</span>
          <span class="orient-hint">Nombre + carátula fija</span>
        </button>
      </div>
      <div class="form-group">
        <label>Poster por defecto de la fila (URL) <span class="hint">— se usa cuando el modo es "Nombre de canal" y el canal no tiene poster propio</span></label>
        <input id="row-default-poster" value="${esc(row.default_poster || '')}" placeholder="https://…" />
      </div>
      <div class="form-actions">
        <button class="btn-ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-grad" onclick="App.saveRowSettings(${rowId})">Guardar</button>
      </div>
    `);
  },

  _selectRowMode(mode) {
    document.querySelectorAll('#row-mode-btns .orient-btn').forEach(b => {
      b.classList.toggle('orient-active', b.dataset.mode === mode);
    });
  },

  async saveRowSettings(rowId) {
    const mode = document.querySelector('#row-mode-btns .orient-active')?.dataset.mode || 'epg';
    const defaultPoster = $('row-default-poster')?.value.trim() || '';
    try {
      await api('PUT', `/rows/${rowId}`, { display_mode: mode, default_poster: defaultPoster });
      toast('Configuración guardada', 'ok');
      closeModal();
      await this.loadRows();
    } catch (err) { toast(err.message, 'err'); }
  },

  openRowChannelCustom(rowId, chId, customPoster, customName, channelName) {
    openModal(`
      <h3>Personalizar canal en esta fila</h3>
      <p class="hint" style="margin-bottom:1rem">Estos valores solo afectan a <b>${esc(channelName)}</b> <em>dentro de esta fila</em>. El canal sigue igual en las demás filas.</p>
      <div class="form-group">
        <label>Poster custom para esta fila (URL)</label>
        <input id="rc-poster" value="${esc(customPoster)}" placeholder="https://… (vacío = usa el de la fila)" />
      </div>
      <div class="form-group">
        <label>Nombre custom para esta fila</label>
        <input id="rc-name" value="${esc(customName)}" placeholder="${esc(channelName)} (vacío = usa el predeterminado)" />
      </div>
      <div class="form-actions">
        <button class="btn-ghost" onclick="App.clearRowChannelCustom(${rowId},${chId})">Limpiar</button>
        <button class="btn-ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-grad" onclick="App.saveRowChannelCustom(${rowId},${chId})">Guardar</button>
      </div>
    `);
  },

  async saveRowChannelCustom(rowId, chId) {
    const custom_poster = $('rc-poster')?.value.trim() || '';
    const custom_name   = $('rc-name')?.value.trim() || '';
    try {
      await api('PUT', `/rows/${rowId}/channels/${chId}/custom`, { custom_poster, custom_name });
      toast('Personalización guardada', 'ok');
      closeModal();
      await this.loadRows();
    } catch (err) { toast(err.message, 'err'); }
  },

  async clearRowChannelCustom(rowId, chId) {
    try {
      await api('PUT', `/rows/${rowId}/channels/${chId}/custom`, { custom_poster: '', custom_name: '' });
      toast('Personalización eliminada', 'ok');
      closeModal();
      await this.loadRows();
    } catch (err) { toast(err.message, 'err'); }
  },

  async moveInRow(rowId, idx, dir) {
    const prev = this._rowPreviews[rowId];
    if (!prev) return;
    const arr = prev.channels;
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    try {
      await api('PUT', `/rows/${rowId}/channels-order`, { order: arr.map(c => c.id) });
      this.loadRows();
    } catch (err) { toast(err.message, 'err'); }
  },

  async toggleChannelEnabled(chId, enabled) {
    try {
      await api('PUT', `/channels/${chId}`, { enabled });
      toast(enabled ? 'Canal visible en el addon' : 'Canal oculto en el addon', 'ok');
      this.loadRows();
    } catch (err) { toast(err.message, 'err'); }
  },

  async removeFromRow(rowId, chId) {
    await api('DELETE', `/rows/${rowId}/channels/${chId}`);
    this.loadRows();
  },

  async openAddToRow(rowId, rowName) {
    const channels = await api('GET', '/channels');
    if (!channels.length) {
      toast('Primero crea canales en la pestaña Canales', 'err');
      return;
    }
    openModal(`
      <h3>Añadir canal a "${esc(rowName)}"</h3>
      <div class="picker-list" style="max-height:380px">
        ${channels.map(c => `
          <div class="picker-item" onclick="App.addToRow(${rowId},${c.id})">
            ${c.logo_url ? `<img src="${esc(c.logo_url)}" onerror="this.style.visibility='hidden'" />` : '<div class="picker-noimg"></div>'}
            <span>${esc(c.name)}</span>
            ${c.enabled ? '' : '<span class="badge badge-idle" style="flex:0 0 auto">oculto</span>'}
          </div>
        `).join('')}
      </div>
    `);
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
    skel($('epg-sources-list'), 1);
    const sources = await api('GET', '/epg-sources');
    const el = $('epg-sources-list');
    el.innerHTML = sources.length ? sources.map(s => `
      <div class="card">
        <div class="card-icon-placeholder">EPG</div>
        <div class="card-body">
          <div class="card-title">${esc(s.name)}</div>
          <div class="card-subtitle">${esc(s.url)}</div>
          <div style="margin-top:.4rem">
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
          <button class="mini-btn mini-danger" onclick="App.deleteEpg(${s.id})" title="Eliminar">${ICONS.x}</button>
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
        <button class="btn btn-grad" onclick="App.addEpg()">Añadir</button>
      </div>
    `);
    $('epg-name').focus();
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
    if (!await confirmDialog('¿Eliminar esta fuente EPG?')) return;
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
        <button class="mini-btn mini-danger" onclick="App.removeEpgMap(${m.logical_channel_id})" title="Quitar">${ICONS.x}</button>
      </div>
    `).join('') : '<p class="empty-state">Ningún canal emparejado con la guía todavía.<br>Pulsa <b>⚡ Auto-emparejar</b> o vincula cada canal desde su editor.</p>';
  },

  async autoMatchEpg() {
    try {
      const r = await api('POST', '/epg-map/auto-match');
      toast(r.matched > 0
        ? `${r.matched} canal(es) emparejados con la guía`
        : 'Ningún emparejamiento automático — vincula desde el editor de cada canal', r.matched > 0 ? 'ok' : 'err');
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
        <input id="map-q" placeholder="🔍 Ej: laliga" oninput="App.searchEpgChannels(this.value)" autocomplete="off" />
      </div>
      <div class="picker-list" id="map-results"></div>
    `);
    $('map-q').focus();
  },

  searchEpgChannels(q) {
    clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(async () => {
      const el = $('map-results');
      if (!el) return;
      if (!q.trim()) { el.innerHTML = ''; return; }
      const results = await api('GET', `/epg-channels?search=${encodeURIComponent(q)}&limit=30`);
      el.innerHTML = results.map(ec => `
        <div class="picker-item" onclick="App.saveManualMap(${ec.epg_source_id},'${escAttr(ec.channel_id)}')">
          ${ec.icon ? `<img src="${esc(ec.icon)}" onerror="this.style.visibility='hidden'" />` : '<div class="picker-noimg"></div>'}
          <span>${esc(ec.display_name)}</span>
        </div>
      `).join('') || '<p class="modal-hint">Sin resultados</p>';
    }, 300);
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
    if (btn) btn.disabled = true;
    try {
      await api('POST', '/settings/switch-orientation', { orientation });
      this._updateOrientationUI(orientation);
      toast(`Orientación cambiada a ${orientation === 'landscape' ? 'horizontal' : 'vertical'}. Pulsa ↻ Refrescar en Guía EPG para aplicar.`, 'ok');
    } catch (err) { toast(err.message, 'err'); }
    if (btn) btn.disabled = false;
  },

  async clearPosterCache() {
    const btn = document.querySelector('[onclick="App.clearPosterCache()"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Limpiando…'; }
    try {
      const r = await api('POST', '/settings/clear-poster-cache');
      toast(`Caché de pósters limpiada (${r.deleted} archivo${r.deleted !== 1 ? 's' : ''} eliminado${r.deleted !== 1 ? 's' : ''})`, 'ok');
    } catch (err) { toast(err.message, 'err'); }
    if (btn) { btn.disabled = false; btn.textContent = '🗑 Limpiar caché de pósters'; }
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
      <div class="card-static">
        <h3 class="section-label" style="margin-top:0">Estado del servidor</h3>
        <div class="stats-row">
          ${Object.entries({
            'Playlists': s.playlists,
            'Canales IPTV': s.raw_channels.toLocaleString('es'),
            'Canales creados': s.logical_channels,
            'En filas': s.channels_in_rows,
            'Programas EPG': s.programmes.toLocaleString('es'),
            'Con guía': s.epg_mapped,
          }).map(([k, v]) => `
            <div class="stat-card"><div class="stat-value">${v}</div><div class="stat-label">${k}</div></div>
          `).join('')}
        </div>
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
