import sharp from 'sharp';
import { join } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import db from '../db.js';
import { sha1hex, fetchWithTimeout } from '../util/index.js';
import { DATA_DIR } from '../config.js';
import { logWarn } from '../util/logger.js';

const POSTER_DIR = join(DATA_DIR, 'posters');
const W = 800;
const H = 450;

function escapeXml(s) {
  return String(s ?? '').replace(/[<>&"']/g, c => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;',
  }[c]));
}

function bgSvg(text = '') {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#10162a"/>
        <stop offset="1" stop-color="#1d2742"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/>
    ${text ? `<text x="${W / 2}" y="${H / 2 + 16}" font-size="46" font-family="DejaVu Sans, Arial, sans-serif"
      font-weight="700" text-anchor="middle" fill="#e6e9f0">${escapeXml(text)}</text>` : ''}
  </svg>`);
}

function findChannelLogo(ch) {
  if (ch.logo_url) return ch.logo_url;
  const map = db.prepare('SELECT epg_source_id, epg_channel_id FROM epg_channel_map WHERE logical_channel_id=?').get(ch.id);
  if (map) {
    const ec = db.prepare('SELECT icon FROM epg_channels WHERE channel_id=? AND epg_source_id=?')
      .get(map.epg_channel_id, map.epg_source_id);
    if (ec?.icon) return ec.icon;
  }
  const src = db.prepare(`
    SELECT rc.tvg_logo FROM channel_sources cs
    JOIN raw_channels rc ON rc.id=cs.raw_channel_id
    WHERE cs.logical_channel_id=? AND rc.tvg_logo != '' ORDER BY cs.priority LIMIT 1
  `).get(ch.id);
  return src?.tvg_logo || '';
}

/**
 * Landscape (800×450) webp poster for a logical channel: its square logo
 * centered on a dark gradient. Used as fallback when the current programme
 * has no fanart, so catalog rows keep a consistent landscape shape.
 * Cached on disk keyed by (slug, logo url).
 */
export async function channelPoster(slug) {
  const ch = db.prepare('SELECT * FROM logical_channels WHERE slug=?').get(slug);
  if (!ch) return null;

  const logo = findChannelLogo(ch);

  await mkdir(POSTER_DIR, { recursive: true });
  const cacheFile = join(POSTER_DIR, `ch_${sha1hex(`${slug}|${logo}`).slice(0, 16)}.webp`);
  try { return await readFile(cacheFile); } catch {}

  let logoBuf = null;
  if (logo) {
    try {
      const res = await fetchWithTimeout(logo, {}, 10000);
      const type = res.headers.get('content-type') || '';
      if (res.ok && (type.startsWith('image') || type === 'application/octet-stream')) {
        logoBuf = Buffer.from(await res.arrayBuffer());
      }
    } catch (err) {
      logWarn(`Póster "${slug}": no se pudo descargar el logo (${err.message})`);
    }
  }

  let composite = null;
  if (logoBuf) {
    try {
      composite = await sharp(logoBuf)
        .resize(Math.round(W * 0.55), Math.round(H * 0.6), { fit: 'inside' })
        .png()
        .toBuffer();
    } catch {
      composite = null; // corrupt/unsupported image — fall back to text
    }
  }

  const base = sharp(bgSvg(composite ? '' : ch.name));
  const img = composite ? base.composite([{ input: composite, gravity: 'centre' }]) : base;
  const out = await img.webp({ quality: 82 }).toBuffer();

  writeFile(cacheFile, out).catch(() => {});
  return out;
}
