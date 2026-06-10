import { refreshAllPlaylists } from './playlistRefresh.js';
import { refreshAllEpgSources } from './epgRefresh.js';
import db from '../db.js';

function getSetting(key, def) {
  const row = db.prepare('SELECT value FROM settings WHERE key=?').get(key);
  return row ? Number(row.value) : def;
}

let playlistTimer = null;
let epgTimer = null;

function schedulePlaylist() {
  const intervalHours = getSetting('playlist_refresh_hours', 6);
  const ms = intervalHours * 3600 * 1000;
  clearInterval(playlistTimer);
  playlistTimer = setInterval(async () => {
    try { await refreshAllPlaylists(); } catch (_) {}
  }, ms);
}

function scheduleEpg() {
  const intervalHours = getSetting('epg_refresh_hours', 12);
  const ms = intervalHours * 3600 * 1000;
  clearInterval(epgTimer);
  epgTimer = setInterval(async () => {
    try { await refreshAllEpgSources(); } catch (_) {}
  }, ms);
}

export async function startScheduler() {
  // run immediately on boot (non-blocking)
  setTimeout(async () => {
    try { await refreshAllPlaylists(); } catch (_) {}
    try { await refreshAllEpgSources(); } catch (_) {}
  }, 2000);

  schedulePlaylist();
  scheduleEpg();
}

export function reschedule() {
  schedulePlaylist();
  scheduleEpg();
}
