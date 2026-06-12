import sharp from 'sharp';
import { join } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import db from '../db.js';
import { sha1hex, fetchWithTimeout } from '../util/index.js';
import { DATA_DIR } from '../config.js';
import { logWarn } from '../util/logger.js';

const POSTER_DIR = join(DATA_DIR, 'posters');

// bump this when the generation algorithm changes to invalidate stale cache files
const CACHE_V = 3;

// landscape = 16:9 for fanart/sports rows; portrait = 2:3 for classic TV grid
const DIMS = {
  landscape: { w: 800, h: 450 },
  portrait:  { w: 400, h: 600 },
};

const BG = { r: 13, g: 17, b: 35 };

// Derive a unique hue (0-359) from a slug so each channel gets a different accent
function slugHue(slug) {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) & 0xffff;
  return h % 360;
}

// HSL → RGB (all inputs 0-360/0-100/0-100, output 0-255 ints)
function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h / 30) % 12;
    return Math.round((l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)) * 255);
  };
  return [f(0), f(8), f(4)];
}

// Build a raw RGBA buffer with a radial gradient: accent colour at centre → BG at edges.
// Gives each channel a subtly distinctive look even without a logo.
function makeGradientBg(w, h, hue) {
  const [ar, ag, ab] = hslToRgb(hue, 55, 14); // dark saturated accent
  const cx = w / 2, cy = h / 2;
  const maxD = Math.sqrt(cx * cx + cy * cy);
  const buf = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = Math.min(1, Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / maxD * 1.25);
      const idx = (y * w + x) * 4;
      buf[idx]   = Math.round(ar * (1 - t) + BG.r * t);
      buf[idx+1] = Math.round(ag * (1 - t) + BG.g * t);
      buf[idx+2] = Math.round(ab * (1 - t) + BG.b * t);
      buf[idx+3] = 255;
    }
  }
  return buf;
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
 * Returns a WebP poster for a logical channel, sized for the given orientation.
 * - Logo is composited centred on a channel-unique radial-gradient background.
 * - SVG logos are skipped (sharp needs librsvg to render them, not available in prebuilts).
 * - Results are disk-cached; CACHE_V in the key invalidates stale files.
 */
export async function channelPoster(slug, orientation = 'landscape') {
  const { w, h } = DIMS[orientation] || DIMS.landscape;
  const ch = db.prepare('SELECT * FROM logical_channels WHERE slug=?').get(slug);
  if (!ch) return null;

  const logo = findChannelLogo(ch);
  await mkdir(POSTER_DIR, { recursive: true });
  const cacheFile = join(POSTER_DIR, `ch_v${CACHE_V}_${sha1hex(`${slug}|${logo}|${orientation}`)}.webp`);
  try {
    const cached = await readFile(cacheFile);
    if (cached.length > 100) return cached;
  } catch {}

  const hue = slugHue(slug);
  const gradBuf = makeGradientBg(w, h, hue);
  const base = sharp(gradBuf, { raw: { width: w, height: h, channels: 4 } });

  let logoBuf = null;
  if (logo) {
    try {
      const res = await fetchWithTimeout(logo, {}, 10000);
      const type = res.headers.get('content-type') || '';
      // SVG requires librsvg which isn't in sharp's prebuilt binaries — skip silently
      const isSvg = type.includes('svg') || logo.toLowerCase().endsWith('.svg');
      if (res.ok && !isSvg && (type.startsWith('image') || type === 'application/octet-stream')) {
        logoBuf = Buffer.from(await res.arrayBuffer());
      } else if (isSvg) {
        logWarn(`Póster "${slug}": logo SVG omitido — no puede procesarse sin librsvg`);
      }
    } catch (err) {
      logWarn(`Póster "${slug}": no se pudo descargar el logo (${err.message})`);
    }
  }

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
      logWarn(`Póster "${slug}": error al procesar logo (${err.message}), usando fondo degradado`);
    }
  }

  // No logo or logo processing failed — return the gradient background alone
  const out = await base.webp({ quality: 82 }).toBuffer();
  writeFile(cacheFile, out).catch(() => {});
  return out;
}
