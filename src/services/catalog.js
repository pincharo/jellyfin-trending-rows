import db from '../db.js';
import { BASE_URL } from '../config.js';
import { formatTime, formatDate } from '../util/index.js';

const TZ = 'Europe/Madrid';

// guiafanart_color1 prefixes titles with "Lunes 2 junio " — strip it
const DATE_PREFIX_RE = /^(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\s+\d{1,2}\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+/i;
function cleanTitle(t) { return t ? t.replace(DATE_PREFIX_RE, '').trim() : t; }

function nowSec() { return Math.floor(Date.now() / 1000); }

function currentProgramme(epgChannelId, epgSourceId) {
  const now = nowSec();
  return db.prepare(`
    SELECT title, sub_title, start, stop, icon
    FROM programmes
    WHERE epg_channel_id=? AND epg_source_id=? AND start<=? AND stop>?
    ORDER BY start DESC LIMIT 1
  `).get(epgChannelId, epgSourceId, now, now);
}

function upcomingProgramme(epgChannelId, epgSourceId) {
  const now = nowSec();
  return db.prepare(`
    SELECT title, start, stop
    FROM programmes
    WHERE epg_channel_id=? AND epg_source_id=? AND start>?
    ORDER BY start ASC LIMIT 1
  `).get(epgChannelId, epgSourceId, now);
}

function epgMap(logicalId) {
  return db.prepare(`
    SELECT epg_source_id, epg_channel_id
    FROM epg_channel_map WHERE logical_channel_id=?
  `).get(logicalId);
}

function buildDescription(ch, map) {
  if (!map) return ch.name;
  const prog = currentProgramme(map.epg_channel_id, map.epg_source_id);
  if (!prog) return ch.name;
  return `Ahora: ${cleanTitle(prog.title)} (${formatTime(prog.start, TZ)}–${formatTime(prog.stop, TZ)})`;
}

export function channelsForRow(rowSlug, skip = 0, limit = 100, { ignoreEnabled = false } = {}) {
  const row = ignoreEnabled
    ? db.prepare('SELECT id, display_mode, default_poster FROM rows WHERE slug=?').get(rowSlug)
    : db.prepare('SELECT id, display_mode, default_poster FROM rows WHERE slug=? AND enabled=1').get(rowSlug);
  if (!row) return [];

  const isCanal = (row.display_mode || 'epg') === 'canal';

  const channels = db.prepare(`
    SELECT lc.id, lc.slug, lc.name, lc.logo_url, lc.sort_order,
           cr.custom_poster, cr.custom_name
    FROM logical_channels lc
    JOIN channel_rows cr ON cr.logical_channel_id=lc.id
    WHERE cr.row_id=? AND lc.enabled=1
    ORDER BY cr.sort_order, lc.sort_order
    LIMIT ? OFFSET ?
  `).all(row.id, limit, skip);

  const posterShape = getPosterShape();
  const isPortrait = posterShape === 'poster';
  return channels.map(ch => {
    const map = epgMap(ch.id);
    const desc = buildDescription(ch, map);
    const channelIcon = ch.logo_url || (map ? getEpgChannelIcon(map.epg_channel_id, map.epg_source_id) : '');
    const prog = map ? currentProgramme(map.epg_channel_id, map.epg_source_id) : null;
    const fanart = prog?.icon || '';
    const generated = `${BASE_URL}/poster/channel/${ch.slug}.webp`;

    // Name: per-row custom_name wins, then mode determines the default
    const name = ch.custom_name || (isCanal ? ch.name : (prog ? `${cleanTitle(prog.title)} — ${ch.name}` : ch.name));

    // Poster: per-row custom_poster wins, then mode determines the default
    let poster;
    if (ch.custom_poster) {
      poster = ch.custom_poster;
    } else if (isCanal) {
      poster = row.default_poster || generated;
    } else {
      // EPG mode: portrait always uses generated (fanart is landscape-shaped)
      poster = isPortrait ? generated : (fanart || generated);
    }

    return {
      id: `iptv:${ch.slug}`,
      type: 'tv',
      name,
      poster,
      posterShape,
      logo: channelIcon || undefined,
      description: desc,
      background: fanart || generated,
    };
  });
}

function getPosterShape() {
  const v = db.prepare("SELECT value FROM settings WHERE key='poster_orientation'").get()?.value;
  return v === 'portrait' ? 'poster' : 'landscape';
}

function getEpgChannelIcon(channelId, sourceId) {
  const row = db.prepare('SELECT icon FROM epg_channels WHERE channel_id=? AND epg_source_id=?').get(channelId, sourceId);
  return row?.icon || '';
}

export function channelMeta(slug) {
  const ch = db.prepare('SELECT * FROM logical_channels WHERE slug=?').get(slug);
  if (!ch) return null;

  const map = epgMap(ch.id);
  const icon = ch.logo_url || (map ? getEpgChannelIcon(map.epg_channel_id, map.epg_source_id) : '');

  // build today's programme list
  let schedule = '';
  if (map) {
    const todayStart = getTodayStart();
    const todayEnd = todayStart + 86400;
    const progs = db.prepare(`
      SELECT title, start, stop FROM programmes
      WHERE epg_channel_id=? AND epg_source_id=? AND stop>? AND start<?
      ORDER BY start ASC LIMIT 20
    `).all(map.epg_channel_id, map.epg_source_id, todayStart, todayEnd);
    if (progs.length) {
      schedule = '\n\nHoy:\n' + progs.map(p =>
        `${formatTime(p.start, TZ)} ${p.title}`
      ).join('\n');
    }
  }

  const currentProg = map ? currentProgramme(map.epg_channel_id, map.epg_source_id) : null;
  const fanart = currentProg?.icon || '';
  const generated = `${BASE_URL}/poster/channel/${ch.slug}.webp`;
  const desc = currentProg
    ? `Ahora: ${cleanTitle(currentProg.title)} (${formatTime(currentProg.start, TZ)}–${formatTime(currentProg.stop, TZ)})${schedule}`
    : ch.name + schedule;

  const shape = getPosterShape();
  return {
    id: `iptv:${ch.slug}`,
    type: 'tv',
    name: currentProg ? `${cleanTitle(currentProg.title)} — ${ch.name}` : ch.name,
    poster: shape === 'poster' ? generated : (fanart || generated),
    posterShape: shape,
    logo: icon || undefined,
    background: fanart || generated,
    description: desc,
  };
}

export function channelStreams(slug) {
  const ch = db.prepare('SELECT * FROM logical_channels WHERE slug=?').get(slug);
  if (!ch) return [];

  const sources = db.prepare(`
    SELECT cs.priority, cs.label, rc.tvg_name, rc.stream_url
    FROM channel_sources cs
    JOIN raw_channels rc ON rc.id=cs.raw_channel_id
    WHERE cs.logical_channel_id=?
    ORDER BY cs.priority
  `).all(ch.id);

  return sources.map((s, i) => ({
    name: s.label || `Fuente ${i + 1}`,
    title: s.tvg_name,
    url: s.stream_url,
    behaviorHints: { notWebReady: true },
  }));
}

function getTodayStart() {
  const d = new Date();
  const tz = new Intl.DateTimeFormat('es-ES', { timeZone: TZ, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const parts = Object.fromEntries(tz.map(p => [p.type, p.value]));
  return Math.floor(new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00+02:00`).getTime() / 1000);
}
