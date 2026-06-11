import db from '../db.js';
import { parseM3U } from './m3u.js';
import { parseXtreamUrl, fetchXtreamChannels } from './xtream.js';
import { fetchWithTimeout } from '../util/index.js';
import { logInfo, logError } from '../util/logger.js';

// Many Xtream/IPTV panels reject unknown user agents with odd status codes (e.g. 884)
const PLAYER_HEADERS = {
  'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20',
  'Accept': '*/*',
};

function friendlyHttpError(status) {
  if (status === 401 || status === 403) return `HTTP ${status} — credenciales rechazadas o IP bloqueada`;
  if (status === 404) return `HTTP ${status} — URL incorrecta o lista caducada`;
  if (status >= 500) return `HTTP ${status} — el servidor IPTV está caído o saturado`;
  return `HTTP ${status} — el panel IPTV rechazó la petición (posible límite de conexiones simultáneas, User-Agent bloqueado o lista caducada)`;
}

async function fetchM3UChannels(playlist) {
  const res = await fetchWithTimeout(playlist.url, { headers: PLAYER_HEADERS }, 60000);
  if (!res.ok) throw new Error(friendlyHttpError(res.status));
  const text = await res.text();

  const channels = parseM3U(text);
  if (channels.length === 0) {
    const preview = text.slice(0, 80).replace(/\s+/g, ' ');
    throw new Error(`La respuesta no es una lista M3U válida (empieza por: "${preview}…")`);
  }
  return channels;
}

export async function refreshPlaylist(playlistId) {
  const playlist = db.prepare('SELECT * FROM playlists WHERE id=?').get(playlistId);
  if (!playlist) throw new Error(`Playlist ${playlistId} no encontrada`);

  const xt = parseXtreamUrl(playlist.url);
  logInfo(`Playlist "${playlist.name}": ${xt ? 'panel Xtream detectado, consultando player_api' : 'descargando lista M3U'}…`);

  let channels;
  try {
    if (xt) {
      // Xtream first (works even when get.php downloads are disabled by the provider),
      // falling back to plain M3U download if the panel has no player_api
      try {
        const r = await fetchXtreamChannels(xt);
        channels = r.channels;
        logInfo(`Playlist "${playlist.name}": cuenta ${r.accountInfo.status}, caduca ${r.accountInfo.expires}, ${r.accountInfo.maxConnections} conexión(es) máx.`);
      } catch (xtErr) {
        logError(`Playlist "${playlist.name}": player_api falló (${xtErr.message}), probando descarga M3U directa…`);
        channels = await fetchM3UChannels(playlist);
      }
    } else {
      channels = await fetchM3UChannels(playlist);
    }
  } catch (err) {
    const msg = err.name === 'AbortError' ? 'Timeout — el servidor IPTV no responde' : err.message;
    logError(`Playlist "${playlist.name}": ${msg}`);
    db.prepare('UPDATE playlists SET last_fetched_at=?,last_status=? WHERE id=?')
      .run(Math.floor(Date.now() / 1000), `Error: ${msg}`, playlistId);
    throw new Error(msg);
  }

  const upsert = db.prepare(`
    INSERT INTO raw_channels(playlist_id,tvg_id,tvg_name,tvg_logo,group_title,stream_url,stale)
    VALUES(?,?,?,?,?,?,0)
    ON CONFLICT(playlist_id,stream_url) DO UPDATE SET
      tvg_id=excluded.tvg_id, tvg_name=excluded.tvg_name,
      tvg_logo=excluded.tvg_logo, group_title=excluded.group_title, stale=0
  `);

  // mark all as stale first, then upsert fresh ones
  db.prepare('UPDATE raw_channels SET stale=1 WHERE playlist_id=?').run(playlistId);

  const insertMany = db.transaction(list => {
    for (const ch of list) {
      upsert.run(playlistId, ch.tvg_id, ch.tvg_name || ch.name, ch.tvg_logo, ch.group_title, ch.stream_url);
    }
  });
  insertMany(channels);

  db.prepare('UPDATE playlists SET last_fetched_at=?,last_status=?,channel_count=? WHERE id=?')
    .run(Math.floor(Date.now() / 1000), 'OK', channels.length, playlistId);

  logInfo(`Playlist "${playlist.name}": ${channels.length} canales importados`);
  return channels.length;
}

export async function refreshAllPlaylists() {
  const playlists = db.prepare('SELECT id FROM playlists').all();
  for (const p of playlists) {
    try { await refreshPlaylist(p.id); } catch (_) { /* already logged */ }
  }
}
