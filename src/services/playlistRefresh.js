import db from '../db.js';
import { parseM3U } from './m3u.js';
import { fetchWithTimeout } from '../util/index.js';

export async function refreshPlaylist(playlistId) {
  const playlist = db.prepare('SELECT * FROM playlists WHERE id=?').get(playlistId);
  if (!playlist) throw new Error(`Playlist ${playlistId} not found`);

  let text;
  try {
    const res = await fetchWithTimeout(playlist.url, {}, 60000);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    text = await res.text();
  } catch (err) {
    db.prepare('UPDATE playlists SET last_fetched_at=?,last_status=? WHERE id=?')
      .run(Math.floor(Date.now() / 1000), `Error: ${err.message}`, playlistId);
    throw err;
  }

  const channels = parseM3U(text);

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

  return channels.length;
}

export async function refreshAllPlaylists() {
  const playlists = db.prepare('SELECT id FROM playlists').all();
  for (const p of playlists) {
    try { await refreshPlaylist(p.id); } catch (_) {}
  }
}
