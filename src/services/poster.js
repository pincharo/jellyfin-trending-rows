import sharp from 'sharp';
import { join } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import db from '../db.js';
import { sha1hex, fetchWithTimeout } from '../util/index.js';
import { DATA_DIR } from '../config.js';
import { logWarn } from '../util/logger.js';

const POSTER_DIR = join(DATA_DIR, 'posters');

// landscape = 16:9 for fanart/sports rows; portrait = 2:3 for classic TV grid
const DIMS = {
  landscape: { w: 800, h: 450 },
  portrait:  { w: 400, h: 600 },
};

const BG = { r: 13, g: 17, b: 35, alpha: 1 }; // dark navy — no SVG/librsvg needed

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
 * Returns a WebP poster for a logical channel, sized for the given orientation.
 * The square channel logo is composited on a dark background — no SVG/librsvg needed.
 * Results are disk-cached keyed by (slug, logo url, orientation).
 */
export async function channelPoster(slug, orientation = 'landscape') {
  const { w, h } = DIMS[orientation] || DIMS.landscape;
  const ch = db.prepare('SELECT * FROM logical_channels WHERE slug=?').get(slug);
  if (!ch) return null;

  const logo = findChannelLogo(ch);
  await mkdir(POSTER_DIR, { recursive: true });
  const cacheFile = join(POSTER_DIR, `ch_${sha1hex(`${slug}|${logo}|${orientation}`)}.webp`);
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

  // Solid-color background via sharp.create — works on all platforms without librsvg
  const base = sharp({ create: { width: w, height: h, channels: 4, background: BG } });

  if (logoBuf) {
    try {
      const maxLogoW = Math.round(w * 0.55);
      const maxLogoH = Math.round(h * 0.6);
      const logoResized = await sharp(logoBuf)
        .resize(maxLogoW, maxLogoH, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
      const { width: lw, height: lh } = await sharp(logoResized).metadata();
      const left = Math.round((w - lw) / 2);
      const top  = Math.round((h - lh) / 2);
      const out = await base
        .composite([{ input: logoResized, left, top }])
        .webp({ quality: 82 })
        .toBuffer();
      writeFile(cacheFile, out).catch(() => {});
      return out;
    } catch (err) {
      logWarn(`Póster "${slug}": error procesando logo (${err.message}), usando fondo plano`);
    }
  }

  // Fallback: plain dark background (still beats a broken image)
  const out = await base.webp({ quality: 82 }).toBuffer();
  writeFile(cacheFile, out).catch(() => {});
  return out;
}
