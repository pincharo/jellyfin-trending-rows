import { createHash, timingSafeEqual } from 'node:crypto';

export function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function sha1hex(text) {
  return createHash('sha1').update(text).digest('hex');
}

export function safeEqual(a, b) {
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

export function normalizeChannelName(name) {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\b(hd|fhd|uhd|sd|720|1080|4k|tv|\.tv)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function formatTime(epochSec, tz = 'Europe/Madrid') {
  return new Date(epochSec * 1000).toLocaleTimeString('es-ES', {
    timeZone: tz, hour: '2-digit', minute: '2-digit',
  });
}

export function formatDate(epochSec, tz = 'Europe/Madrid') {
  return new Date(epochSec * 1000).toLocaleDateString('es-ES', {
    timeZone: tz, day: 'numeric', month: 'short',
  });
}

export function parseXmltvTime(str) {
  // "20260610153500 +0200"
  const m = str.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})?/);
  if (!m) return 0;
  const [, year, month, day, hour, min, sec, tz = '+0000'] = m;
  const sign = tz[0] === '-' ? -1 : 1;
  const tzHours = parseInt(tz.slice(1, 3), 10);
  const tzMins = parseInt(tz.slice(3, 5), 10);
  const offsetSec = sign * (tzHours * 3600 + tzMins * 60);
  const utcSec = Date.UTC(+year, +month - 1, +day, +hour, +min, +sec) / 1000;
  return utcSec - offsetSec;
}

export function extractSubtitleCategories(subtitle) {
  if (!subtitle) return [];
  const m = subtitle.match(/\[COLOR SlateBlue\]([^\[]+)\[\/COLOR\]/i);
  if (!m) return [];
  return m[1].split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

// Strips Kodi formatting tags ([COLOR x]...[/COLOR], [B], [I]) used by dobleM guides
export function stripKodiTags(text) {
  return String(text || '')
    .replace(/\[\/?COLOR[^\]]*\]/gi, '')
    .replace(/\[\/?[BI]\]/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
