import { fetchWithTimeout } from '../util/index.js';

const PLAYER_HEADERS = {
  'User-Agent': 'IPTV Smarters Player',
  'Accept': '*/*',
};

/**
 * Detects an Xtream Codes URL (get.php / player_api.php with username+password).
 * Returns { base, username, password, output } or null if it's a plain M3U URL.
 */
export function parseXtreamUrl(url) {
  let u;
  try { u = new URL(url); } catch { return null; }
  if (!/(get|player_api|panel_api)\.php$/.test(u.pathname)) return null;
  const username = u.searchParams.get('username');
  const password = u.searchParams.get('password');
  if (!username || !password) return null;
  return {
    base: `${u.protocol}//${u.host}`,
    username,
    password,
    output: u.searchParams.get('output') || '',
  };
}

/**
 * Fetches live channels via the Xtream player API (works even when the
 * provider has disabled M3U downloads on get.php).
 * Returns channels in the same shape as parseM3U().
 */
export async function fetchXtreamChannels(xt) {
  const call = async action => {
    const url = `${xt.base}/player_api.php?username=${encodeURIComponent(xt.username)}&password=${encodeURIComponent(xt.password)}${action ? `&action=${action}` : ''}`;
    const res = await fetchWithTimeout(url, { headers: PLAYER_HEADERS }, 60000);
    if (!res.ok) throw new Error(`HTTP ${res.status} en player_api.php`);
    return res.json();
  };

  const info = await call('');
  if (!info?.user_info?.auth) {
    throw new Error('El panel Xtream rechazó las credenciales (usuario/contraseña incorrectos o cuenta caducada)');
  }

  const { status, exp_date, max_connections } = info.user_info;
  if (status && status !== 'Active') {
    throw new Error(`Cuenta Xtream no activa (estado: ${status})`);
  }

  const allowed = info.user_info.allowed_output_formats || [];
  const ext = xt.output && allowed.includes(xt.output)
    ? xt.output
    : (allowed.includes('ts') ? 'ts' : (allowed[0] || 'ts'));

  const cats = await call('get_live_categories').catch(() => []);
  const catMap = Object.fromEntries(
    (Array.isArray(cats) ? cats : []).map(c => [String(c.category_id), c.category_name])
  );

  const streams = await call('get_live_streams');
  if (!Array.isArray(streams)) throw new Error('Respuesta inesperada del panel en get_live_streams');

  const channels = streams.map(s => ({
    tvg_id:      s.epg_channel_id || '',
    tvg_name:    s.name || `Canal ${s.stream_id}`,
    tvg_logo:    s.stream_icon || '',
    group_title: catMap[String(s.category_id)] || '',
    name:        s.name || '',
    stream_url:  `${xt.base}/live/${encodeURIComponent(xt.username)}/${encodeURIComponent(xt.password)}/${s.stream_id}.${ext}`,
  }));

  return {
    channels,
    accountInfo: {
      status,
      expires: exp_date ? new Date(exp_date * 1000).toLocaleDateString('es-ES') : '?',
      maxConnections: max_connections,
    },
  };
}
