import db from '../db.js';
import { BASE_URL } from '../config.js';
import { formatTime, formatDate } from '../util/index.js';

const TZ = 'Europe/Madrid';

// guiafanart_color1 prefixes titles with "Lunes 2 junio " — strip it
const DATE_PREFIX_RE = /^(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\s+\d{1,2}\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+/i;
function cleanTitle(t) { return t ? t.replace(DATE_PREFIX_RE, '').trim() : t; }

// matches "🔴 DIRECTO Grupo B: Canadá - Bosnia" style titles from dobleM EPG
const LIVE_EVENT_RE = /🔴|\bDIRECTO\b/i;

// removes the live marker prefix so "🔴 DIRECTO Grupo B" → "Grupo B"
function stripLiveMarker(t) {
  if (!t) return t;
  return t.replace(/^🔴\s*/u, '').replace(/^DIRECTO\s*/i, '').trim();
}

// dobleM tags studio/pre/post/highlight shows with category "Programa deportes";
// actual competitions use the real sport (Fútbol, Tenis, Golf, Ciclismo…). We only
// want the real events — not "Prepartido", "Postpartido", "Dazoneta", "Resúmenes"…
const STUDIO_CAT_RE = /programa\s*deportes/i;
const NON_EVENT_TITLE_RE = /\b(pre-?partido|post-?partido)\b/i;

function isStudioProgramme(categories, description) {
  // categories: parsed <category> stored as JSON like '["deportes","programa deportes"]'
  if (STUDIO_CAT_RE.test(categories || '')) return true;
  // fallback for programmes parsed before <category> support: the dobleM desc begins
  // with the category, e.g. "Deportes,Programa deportes | 2026 | TP | …"
  return STUDIO_CAT_RE.test((description || '').split('|')[0]);
}

// A programme is a real event tile iff it is a live broadcast (DIRECTO/🔴) of an
// actual competition — not a studio/preview/post-match show.
function isRealEvent(p) {
  if (!LIVE_EVENT_RE.test(p.title)) return false;
  if (NON_EVENT_TITLE_RE.test(p.title)) return false;
  if (isStudioProgramme(p.categories, p.description)) return false;
  return true;
}

// color1 titles read "DIRECTO {evento} [tomato]T{temporada}[/] [goldenrod]{programa}[/]";
// after Kodi tags are stripped that tail becomes " T2026 Mundial 2026" noise — drop it.
// "DIRECTO Grupo H: España - Cabo Verde T2026 Mundial 2026" → "Grupo H: España - Cabo Verde"
function eventName(title) {
  return stripLiveMarker(cleanTitle(title)).replace(/\s+T\d+\b.*$/, '').trim();
}

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

// Builds event tiles for programmes matching LIVE_EVENT_RE in the next 24h
function eventsForRow(rowId) {
  const now = nowSec();
  const rows = db.prepare(`
    SELECT p.title, p.start, p.stop, p.icon, p.categories, p.description,
           lc.slug, lc.name AS ch_name, lc.logo_url,
           m.epg_channel_id, m.epg_source_id
    FROM programmes p
    JOIN epg_channel_map m
      ON m.epg_channel_id=p.epg_channel_id AND m.epg_source_id=p.epg_source_id
    JOIN logical_channels lc ON lc.id=m.logical_channel_id
    JOIN channel_rows cr ON cr.logical_channel_id=lc.id
    WHERE cr.row_id=? AND lc.enabled=1 AND p.stop>? AND p.start<?
    ORDER BY p.start ASC
  `).all(rowId, now, now + 86400);

  const posterShape = getPosterShape();
  const events = rows
    .filter(isRealEvent)
    .map(p => {
      const isLive = p.start <= now && now < p.stop;
      const cleanedTitle = eventName(p.title);
      const name = isLive
        ? `🔴 LIVE · ${cleanedTitle}`
        : `Próximamente ${formatTime(p.start, TZ)} · ${cleanedTitle}`;
      const generated = `${BASE_URL}/poster/channel/${p.slug}.webp`;
      const poster = p.icon || generated;
      const icon = p.logo_url || getEpgChannelIcon(p.epg_channel_id, p.epg_source_id);
      return {
        id: `iptv:${p.slug}:ev:${p.start}`,
        type: 'tv',
        name,
        poster,
        posterShape,
        logo: icon || undefined,
        description: `${cleanedTitle} · ${p.ch_name} · ${formatTime(p.start, TZ)}–${formatTime(p.stop, TZ)}`,
        background: p.icon || generated,
        _live: isLive,
        _start: p.start,
      };
    })
    .sort((a, b) => (a._live !== b._live ? (a._live ? -1 : 1) : a._start - b._start));

  // strip internal sort keys
  return events.map(({ _live, _start, ...rest }) => rest);
}

export function channelsForRow(rowSlug, skip = 0, limit = 100, { ignoreEnabled = false } = {}) {
  const row = ignoreEnabled
    ? db.prepare('SELECT id, display_mode, default_poster, show_events, events_only FROM rows WHERE slug=?').get(rowSlug)
    : db.prepare('SELECT id, display_mode, default_poster, show_events, events_only FROM rows WHERE slug=? AND enabled=1').get(rowSlug);
  if (!row) return [];

  // events_only: skip channel tiles entirely, return only event tiles
  if (row.show_events && row.events_only) {
    return skip === 0 ? eventsForRow(row.id) : [];
  }

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
  const channelMetas = channels.map(ch => {
    const map = epgMap(ch.id);
    const desc = buildDescription(ch, map);
    const channelIcon = ch.logo_url || (map ? getEpgChannelIcon(map.epg_channel_id, map.epg_source_id) : '');
    const prog = map ? currentProgramme(map.epg_channel_id, map.epg_source_id) : null;
    const fanart = prog?.icon || '';
    const generated = `${BASE_URL}/poster/channel/${ch.slug}.webp`;

    const name = ch.custom_name || (isCanal ? ch.name : (prog ? `${cleanTitle(prog.title)} — ${ch.name}` : ch.name));

    let poster;
    if (ch.custom_poster) {
      poster = ch.custom_poster;
    } else if (isCanal) {
      poster = row.default_poster || generated;
    } else {
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

  if (row.show_events && skip === 0) {
    return [...channelMetas, ...eventsForRow(row.id)];
  }
  return channelMetas;
}

// Used by the admin preview to show live event tiles alongside channels
export function liveEventsForRow(rowSlug) {
  const row = db.prepare('SELECT id, show_events FROM rows WHERE slug=?').get(rowSlug);
  if (!row?.show_events) return [];
  return eventsForRow(row.id);
}

function getPosterShape() {
  const v = db.prepare("SELECT value FROM settings WHERE key='poster_orientation'").get()?.value;
  return v === 'portrait' ? 'poster' : 'landscape';
}

function getEpgChannelIcon(channelId, sourceId) {
  const row = db.prepare('SELECT icon FROM epg_channels WHERE channel_id=? AND epg_source_id=?').get(channelId, sourceId);
  return row?.icon || '';
}

export function eventMeta(slug, start) {
  const ch = db.prepare('SELECT * FROM logical_channels WHERE slug=?').get(slug);
  if (!ch) return null;
  const map = epgMap(ch.id);
  if (!map) return null;
  const prog = db.prepare(`
    SELECT title, start, stop, icon FROM programmes
    WHERE epg_channel_id=? AND epg_source_id=? AND start=?
  `).get(map.epg_channel_id, map.epg_source_id, Number(start));
  if (!prog) return null;

  const now = nowSec();
  const isLive = prog.start <= now && now < prog.stop;
  const cleanedTitle = eventName(prog.title);
  const name = isLive
    ? `🔴 LIVE · ${cleanedTitle}`
    : `Próximamente ${formatTime(prog.start, TZ)} · ${cleanedTitle}`;
  const icon = ch.logo_url || getEpgChannelIcon(map.epg_channel_id, map.epg_source_id);
  const generated = `${BASE_URL}/poster/channel/${ch.slug}.webp`;
  const shape = getPosterShape();
  return {
    id: `iptv:${slug}:ev:${start}`,
    type: 'tv',
    name,
    poster: prog.icon || generated,
    posterShape: shape,
    logo: icon || undefined,
    background: prog.icon || generated,
    description: `${cleanedTitle} · ${ch.name} · ${formatTime(prog.start, TZ)}–${formatTime(prog.stop, TZ)}`,
  };
}

export function channelMeta(slug) {
  const ch = db.prepare('SELECT * FROM logical_channels WHERE slug=?').get(slug);
  if (!ch) return null;

  const map = epgMap(ch.id);
  const icon = ch.logo_url || (map ? getEpgChannelIcon(map.epg_channel_id, map.epg_source_id) : '');

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
