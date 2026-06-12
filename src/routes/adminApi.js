import { Router } from 'express';
import db from '../db.js';
import { login, logout, requireAuth } from '../auth.js';
import { refreshPlaylist } from '../services/playlistRefresh.js';
import { refreshEpgSource, autoMatchEpg } from '../services/epgRefresh.js';
import { channelsForRow } from '../services/catalog.js';
import { DOBLEM_EPG_URLS } from '../config.js';
import { slugify, sha1hex } from '../util/index.js';
import { getLogs } from '../util/logger.js';
import { reschedule } from '../services/scheduler.js';

const router = Router();

router.post('/login', login);
router.post('/logout', requireAuth, logout);

router.use(requireAuth);

// ── Playlists ──────────────────────────────────────────────────────────────
router.get('/playlists', (req, res) => {
  res.json(db.prepare('SELECT * FROM playlists ORDER BY id').all());
});

router.post('/playlists', (req, res) => {
  const { name, url } = req.body;
  if (!name || !url) return res.status(400).json({ error: 'name y url requeridos' });
  const r = db.prepare('INSERT INTO playlists(name,url) VALUES(?,?)').run(name, url);
  res.json({ id: r.lastInsertRowid });
});

router.delete('/playlists/:id', (req, res) => {
  db.prepare('DELETE FROM playlists WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

router.post('/playlists/:id/refresh', async (req, res) => {
  try {
    const count = await refreshPlaylist(Number(req.params.id));
    res.json({ ok: true, count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Raw channels ────────────────────────────────────────────────────────────
router.get('/raw-channels', (req, res) => {
  const { search = '', playlist, limit = 100, offset = 0 } = req.query;
  const like = `%${search}%`;
  let query = `SELECT rc.*, p.name as playlist_name
    FROM raw_channels rc JOIN playlists p ON p.id=rc.playlist_id
    WHERE (rc.tvg_name LIKE ? OR rc.tvg_id LIKE ?)`;
  const params = [like, like];
  if (playlist) { query += ' AND rc.playlist_id=?'; params.push(playlist); }
  query += ` ORDER BY rc.tvg_name LIMIT ? OFFSET ?`;
  params.push(Number(limit), Number(offset));
  res.json(db.prepare(query).all(...params));
});

// ── Logical channels ────────────────────────────────────────────────────────
router.get('/channels', (req, res) => {
  const channels = db.prepare(`
    SELECT lc.*,
      (SELECT COUNT(*) FROM channel_sources cs WHERE cs.logical_channel_id=lc.id) AS source_count,
      (SELECT COUNT(*) FROM channel_rows cr WHERE cr.logical_channel_id=lc.id) AS row_count,
      EXISTS(SELECT 1 FROM epg_channel_map m WHERE m.logical_channel_id=lc.id) AS has_epg
    FROM logical_channels lc ORDER BY lc.sort_order, lc.name
  `).all();
  res.json(channels);
});

router.post('/channels', (req, res) => {
  const { name, logo_url = '', sort_order = 0 } = req.body;
  if (!name) return res.status(400).json({ error: 'name requerido' });
  const slug = slugify(name) + '-' + sha1hex(name).slice(0, 4);
  try {
    const r = db.prepare('INSERT INTO logical_channels(slug,name,logo_url,sort_order) VALUES(?,?,?,?)').run(slug, name, logo_url, sort_order);
    res.json({ id: r.lastInsertRowid, slug });
  } catch {
    res.status(409).json({ error: 'Nombre duplicado' });
  }
});

router.put('/channels/:id', (req, res) => {
  const { name, logo_url, sort_order, enabled } = req.body;
  const ch = db.prepare('SELECT * FROM logical_channels WHERE id=?').get(req.params.id);
  if (!ch) return res.status(404).json({ error: 'No encontrado' });
  db.prepare('UPDATE logical_channels SET name=?,logo_url=?,sort_order=?,enabled=? WHERE id=?').run(
    name ?? ch.name, logo_url ?? ch.logo_url, sort_order ?? ch.sort_order, enabled ?? ch.enabled, ch.id
  );
  res.json({ ok: true });
});

router.delete('/channels/:id', (req, res) => {
  db.prepare('DELETE FROM logical_channels WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── Channel sources ──────────────────────────────────────────────────────────
router.get('/channels/:id/sources', (req, res) => {
  res.json(db.prepare(`
    SELECT cs.id, cs.priority, cs.label, rc.id as raw_id, rc.tvg_name, rc.tvg_logo, rc.stream_url, rc.group_title
    FROM channel_sources cs JOIN raw_channels rc ON rc.id=cs.raw_channel_id
    WHERE cs.logical_channel_id=? ORDER BY cs.priority
  `).all(req.params.id));
});

router.post('/channels/:id/sources', (req, res) => {
  const { raw_channel_id, label = '', priority = 0 } = req.body;
  if (!raw_channel_id) return res.status(400).json({ error: 'raw_channel_id requerido' });
  try {
    const r = db.prepare('INSERT INTO channel_sources(logical_channel_id,raw_channel_id,priority,label) VALUES(?,?,?,?)')
      .run(req.params.id, raw_channel_id, priority, label);
    res.json({ id: r.lastInsertRowid });
  } catch {
    res.status(409).json({ error: 'Fuente ya existe' });
  }
});

router.delete('/channels/:id/sources/:srcId', (req, res) => {
  db.prepare('DELETE FROM channel_sources WHERE id=? AND logical_channel_id=?').run(req.params.srcId, req.params.id);
  res.json({ ok: true });
});

router.put('/channels/:id/sources/:srcId', (req, res) => {
  const cur = db.prepare('SELECT * FROM channel_sources WHERE id=? AND logical_channel_id=?')
    .get(req.params.srcId, req.params.id);
  if (!cur) return res.status(404).json({ error: 'Fuente no encontrada' });
  const { priority, label } = req.body;
  db.prepare('UPDATE channel_sources SET priority=?,label=? WHERE id=?')
    .run(priority ?? cur.priority, label ?? cur.label, cur.id);
  res.json({ ok: true });
});

// atomic reorder: array of source ids in the desired order → priority = index
router.put('/channels/:id/sources-order', (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order debe ser un array de ids' });
  const upd = db.prepare('UPDATE channel_sources SET priority=? WHERE id=? AND logical_channel_id=?');
  db.transaction(() => order.forEach((srcId, i) => upd.run(i, srcId, req.params.id)))();
  res.json({ ok: true });
});

// ── Rows ─────────────────────────────────────────────────────────────────────
router.get('/rows', (req, res) => {
  res.json(db.prepare('SELECT * FROM rows ORDER BY sort_order').all());
});

router.post('/rows', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name requerido' });
  const slug = slugify(name) + '-' + sha1hex(name).slice(0, 4);
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order),0) as m FROM rows').get().m;
  try {
    const r = db.prepare('INSERT INTO rows(slug,name,sort_order) VALUES(?,?,?)').run(slug, name, maxOrder + 10);
    res.json({ id: r.lastInsertRowid, slug });
  } catch {
    res.status(409).json({ error: 'Ya existe una fila con ese nombre' });
  }
});

router.delete('/rows/:id', (req, res) => {
  db.prepare('DELETE FROM rows WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

router.put('/rows/:id', (req, res) => {
  const { name, enabled, sort_order } = req.body;
  const row = db.prepare('SELECT * FROM rows WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'No encontrada' });
  db.prepare('UPDATE rows SET name=?,enabled=?,sort_order=? WHERE id=?').run(
    name ?? row.name, enabled ?? row.enabled, sort_order ?? row.sort_order, row.id
  );
  res.json({ ok: true });
});

// preview: exactly what the addon will serve for this row, plus disabled
// channels (dimmed in the UI — the addon itself skips them)
router.get('/rows/:id/preview', (req, res) => {
  const row = db.prepare('SELECT * FROM rows WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'No encontrada' });
  const orientation = db.prepare("SELECT value FROM settings WHERE key='poster_orientation'").get()?.value || 'landscape';

  const metas = channelsForRow(row.slug, 0, 100, { ignoreEnabled: true });
  const metaBySlug = Object.fromEntries(metas.map(m => [m.id.replace('iptv:', ''), m]));

  const all = db.prepare(`
    SELECT lc.id, lc.slug, lc.name, lc.enabled
    FROM channel_rows cr JOIN logical_channels lc ON lc.id=cr.logical_channel_id
    WHERE cr.row_id=? ORDER BY cr.sort_order, lc.sort_order
  `).all(row.id);

  const channels = all.map(c => {
    const generated = `/poster/channel/${c.slug}.webp`;
    const m = metaBySlug[c.slug];
    const poster = m && !m.poster.includes('/poster/channel/') ? m.poster : generated;
    return {
      id: c.id,
      slug: c.slug,
      name: m?.name || c.name,
      poster,
      fallback: generated,
      enabled: !!c.enabled,
    };
  });
  res.json({ orientation, channels });
});

// channels in a row
router.get('/rows/:id/channels', (req, res) => {
  res.json(db.prepare(`
    SELECT lc.id, lc.slug, lc.name, lc.logo_url, cr.sort_order
    FROM channel_rows cr JOIN logical_channels lc ON lc.id=cr.logical_channel_id
    WHERE cr.row_id=? ORDER BY cr.sort_order
  `).all(req.params.id));
});

router.post('/rows/:id/channels', (req, res) => {
  const { logical_channel_id, sort_order = 0 } = req.body;
  if (!logical_channel_id) return res.status(400).json({ error: 'logical_channel_id requerido' });
  try {
    db.prepare('INSERT INTO channel_rows(logical_channel_id,row_id,sort_order) VALUES(?,?,?)').run(logical_channel_id, req.params.id, sort_order);
    res.json({ ok: true });
  } catch {
    res.status(409).json({ error: 'Canal ya en esta fila' });
  }
});

router.delete('/rows/:id/channels/:chId', (req, res) => {
  db.prepare('DELETE FROM channel_rows WHERE row_id=? AND logical_channel_id=?').run(req.params.id, req.params.chId);
  res.json({ ok: true });
});

// atomic reorder: array of logical_channel_ids in the desired order → sort_order = index
router.put('/rows/:id/channels-order', (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order debe ser un array de ids' });
  const upd = db.prepare('UPDATE channel_rows SET sort_order=? WHERE row_id=? AND logical_channel_id=?');
  db.transaction(() => order.forEach((chId, i) => upd.run(i, req.params.id, chId)))();
  res.json({ ok: true });
});

// ── EPG sources ──────────────────────────────────────────────────────────────
router.get('/epg-sources', (req, res) => {
  res.json(db.prepare('SELECT * FROM epg_sources ORDER BY id').all());
});

router.post('/epg-sources', async (req, res) => {
  const { name, url } = req.body;
  if (!name || !url) return res.status(400).json({ error: 'name y url requeridos' });
  const r = db.prepare('INSERT INTO epg_sources(name,url) VALUES(?,?)').run(name, url);
  res.json({ id: r.lastInsertRowid });
});

router.delete('/epg-sources/:id', (req, res) => {
  db.prepare('DELETE FROM epg_sources WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

router.post('/epg-sources/:id/refresh', async (req, res) => {
  const { refreshEpgSource } = await import('../services/epgRefresh.js');
  try {
    const count = await refreshEpgSource(Number(req.params.id));
    res.json({ ok: true, count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── EPG channel map ──────────────────────────────────────────────────────────
router.get('/epg-channels', (req, res) => {
  const { search = '', source, limit = 100, offset = 0 } = req.query;
  const like = `%${search}%`;
  let q = 'SELECT ec.*, es.name as source_name FROM epg_channels ec JOIN epg_sources es ON es.id=ec.epg_source_id WHERE ec.display_name LIKE ?';
  const p = [like];
  if (source) { q += ' AND ec.epg_source_id=?'; p.push(source); }
  q += ' ORDER BY ec.display_name LIMIT ? OFFSET ?'; p.push(Number(limit), Number(offset));
  res.json(db.prepare(q).all(...p));
});

router.get('/epg-map', (req, res) => {
  res.json(db.prepare(`
    SELECT m.logical_channel_id, m.epg_channel_id, m.epg_source_id, m.auto_matched,
           lc.name as channel_name, ec.display_name as epg_name, ec.icon as epg_icon
    FROM epg_channel_map m
    JOIN logical_channels lc ON lc.id=m.logical_channel_id
    JOIN epg_channels ec ON ec.channel_id=m.epg_channel_id AND ec.epg_source_id=m.epg_source_id
    ORDER BY lc.name
  `).all());
});

router.post('/epg-map', (req, res) => {
  const { logical_channel_id, epg_source_id, epg_channel_id } = req.body;
  if (!logical_channel_id || !epg_source_id || !epg_channel_id) {
    return res.status(400).json({ error: 'Faltan campos' });
  }
  db.prepare(`
    INSERT INTO epg_channel_map(logical_channel_id,epg_source_id,epg_channel_id,auto_matched)
    VALUES(?,?,?,0)
    ON CONFLICT(logical_channel_id) DO UPDATE SET
      epg_source_id=excluded.epg_source_id, epg_channel_id=excluded.epg_channel_id, auto_matched=0
  `).run(logical_channel_id, epg_source_id, epg_channel_id);
  res.json({ ok: true });
});

router.post('/epg-map/auto-match', (req, res) => {
  const count = autoMatchEpg();
  res.json({ ok: true, matched: count });
});

router.delete('/epg-map/:lcId', (req, res) => {
  db.prepare('DELETE FROM epg_channel_map WHERE logical_channel_id=?').run(req.params.lcId);
  res.json({ ok: true });
});

// ── Settings ──────────────────────────────────────────────────────────────────
router.get('/settings', (req, res) => {
  const rows = db.prepare("SELECT key,value FROM settings WHERE key NOT IN ('schema_version')").all();
  res.json(Object.fromEntries(rows.map(r => [r.key, r.value])));
});

router.post('/settings', (req, res) => {
  const allowed = ['playlist_refresh_hours', 'epg_refresh_hours', 'addon_token', 'addon_id', 'timezone', 'poster_orientation'];
  const set = db.prepare('INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)');
  const tx = db.transaction(body => {
    for (const [k, v] of Object.entries(body)) {
      if (allowed.includes(k)) set.run(k, String(v));
    }
  });
  tx(req.body);
  reschedule();
  res.json({ ok: true });
});

// convenience: swap the dobleM EPG source URL and set orientation in one shot
router.post('/settings/switch-orientation', (req, res) => {
  const { orientation } = req.body;
  if (!['landscape', 'portrait'].includes(orientation)) {
    return res.status(400).json({ error: 'orientation debe ser landscape o portrait' });
  }
  const newEpgUrl = DOBLEM_EPG_URLS[orientation];
  // update setting
  db.prepare("INSERT OR REPLACE INTO settings(key,value) VALUES('poster_orientation',?)").run(orientation);
  // if the dobleM EPG source exists, update its URL to match
  const known = Object.values(DOBLEM_EPG_URLS);
  db.prepare(`UPDATE epg_sources SET url=? WHERE url IN (${known.map(() => '?').join(',')})`).run(newEpgUrl, ...known);
  reschedule();
  res.json({ ok: true, epg_url: newEpgUrl, orientation });
});

// ── Status / info ─────────────────────────────────────────────────────────────
router.get('/status', (req, res) => {
  res.json({
    playlists: db.prepare('SELECT COUNT(*) as c FROM playlists').get().c,
    raw_channels: db.prepare('SELECT COUNT(*) as c FROM raw_channels WHERE stale=0').get().c,
    logical_channels: db.prepare('SELECT COUNT(*) as c FROM logical_channels').get().c,
    channels_with_sources: db.prepare('SELECT COUNT(DISTINCT logical_channel_id) as c FROM channel_sources').get().c,
    channels_in_rows: db.prepare('SELECT COUNT(DISTINCT logical_channel_id) as c FROM channel_rows').get().c,
    epg_sources: db.prepare('SELECT COUNT(*) as c FROM epg_sources').get().c,
    programmes: db.prepare('SELECT COUNT(*) as c FROM programmes').get().c,
    epg_mapped: db.prepare('SELECT COUNT(*) as c FROM epg_channel_map').get().c,
  });
});

// ── Logs ──────────────────────────────────────────────────────────────────────
router.get('/logs', (req, res) => {
  res.json(getLogs(Number(req.query.limit) || 200));
});

export default router;
