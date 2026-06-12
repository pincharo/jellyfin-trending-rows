import { createReadStream } from 'node:fs';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import db from '../db.js';
import { parseXMLTV } from './xmltv.js';
import { normalizeChannelName, fetchWithTimeout } from '../util/index.js';
import { logInfo, logError } from '../util/logger.js';
import { DATA_DIR } from '../config.js';

const CACHE_DIR = join(DATA_DIR, 'epg_cache');

export async function refreshEpgSource(sourceId) {
  const source = db.prepare('SELECT * FROM epg_sources WHERE id=?').get(sourceId);
  if (!source) throw new Error(`EPG source ${sourceId} not found`);

  logInfo(`EPG "${source.name}": descargando guía…`);

  await mkdir(CACHE_DIR, { recursive: true });
  const cacheFile = join(CACHE_DIR, `epg_${sourceId}.xml.gz`);

  let stream;
  try {
    const res = await fetchWithTimeout(source.url, {}, 120000);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(cacheFile, buf);
    stream = Readable.from(buf);
  } catch (err) {
    const msg = err.name === 'AbortError' ? 'Timeout (120s) descargando la guía' : err.message;
    logError(`EPG "${source.name}": ${msg}`);
    db.prepare('UPDATE epg_sources SET last_fetched_at=?,last_status=? WHERE id=?')
      .run(Math.floor(Date.now() / 1000), `Error: ${msg}`, sourceId);
    throw new Error(msg);
  }

  const upsertChannel = db.prepare(`
    INSERT INTO epg_channels(epg_source_id,channel_id,display_name,icon)
    VALUES(?,?,?,?)
    ON CONFLICT(epg_source_id,channel_id) DO UPDATE SET
      display_name=excluded.display_name, icon=excluded.icon
  `);

  // batch programme inserts
  const BATCH = 1000;
  let progBatch = [];

  const flushProgs = db.transaction(batch => {
    const ins = db.prepare(`
      INSERT OR IGNORE INTO programmes
        (epg_source_id,epg_channel_id,start,stop,title,sub_title,description,categories,icon)
      VALUES (?,?,?,?,?,?,?,?,?)
    `);
    for (const p of batch) {
      ins.run(sourceId, p.epg_channel_id, p.start, p.stop,
        p.title, p.sub_title, p.description, JSON.stringify(p.categories), p.icon || '');
    }
  });

  // delete old programmes for this source before inserting fresh ones
  db.prepare('DELETE FROM programmes WHERE epg_source_id=?').run(sourceId);

  await parseXMLTV(stream, {
    onChannel: ch => {
      upsertChannel.run(sourceId, ch.channel_id, ch.display_name, ch.icon);
    },
    onProgramme: prog => {
      progBatch.push(prog);
      if (progBatch.length >= BATCH) {
        flushProgs(progBatch);
        progBatch = [];
      }
    },
  });

  if (progBatch.length) flushProgs(progBatch);

  const progCount = db.prepare('SELECT COUNT(*) as c FROM programmes WHERE epg_source_id=?').get(sourceId).c;

  db.prepare('UPDATE epg_sources SET last_fetched_at=?,last_status=? WHERE id=?')
    .run(Math.floor(Date.now() / 1000), `OK (${progCount} programas)`, sourceId);

  // prune programmes older than 24h
  const cutoff = Math.floor(Date.now() / 1000) - 86400;
  db.prepare('DELETE FROM programmes WHERE stop < ?').run(cutoff);

  logInfo(`EPG "${source.name}": ${progCount} programas cargados`);
  return progCount;
}

export async function refreshAllEpgSources() {
  const sources = db.prepare('SELECT id FROM epg_sources').all();
  for (const s of sources) {
    try { await refreshEpgSource(s.id); } catch (_) {}
  }
}

export function autoMatchEpg() {
  const logicals = db.prepare('SELECT id,slug,name FROM logical_channels').all();
  const sources = db.prepare('SELECT id FROM epg_sources').all();
  if (!sources.length) return 0;

  // gather all epg channels
  const epgChannels = db.prepare('SELECT epg_source_id,channel_id,display_name FROM epg_channels').all();

  // also get tvg_ids of raw channels mapped to each logical
  const rawByLogical = db.prepare(`
    SELECT cs.logical_channel_id, rc.tvg_id, rc.tvg_name
    FROM channel_sources cs
    JOIN raw_channels rc ON rc.id=cs.raw_channel_id
  `).all();

  const tvgIdsByLogical = {};
  const tvgNamesByLogical = {};
  for (const r of rawByLogical) {
    (tvgIdsByLogical[r.logical_channel_id] ||= new Set()).add((r.tvg_id || '').toLowerCase());
    (tvgNamesByLogical[r.logical_channel_id] ||= []).push(normalizeChannelName(r.tvg_name));
  }

  const upsert = db.prepare(`
    INSERT INTO epg_channel_map(logical_channel_id,epg_source_id,epg_channel_id,auto_matched)
    VALUES(?,?,?,1)
    ON CONFLICT(logical_channel_id) DO UPDATE SET
      epg_source_id=excluded.epg_source_id,
      epg_channel_id=excluded.epg_channel_id,
      auto_matched=1
    WHERE auto_matched=1
  `);

  let matched = 0;
  for (const lc of logicals) {
    const tvgIds = tvgIdsByLogical[lc.id] || new Set();
    const tvgNames = tvgNamesByLogical[lc.id] || [];
    const normLogical = normalizeChannelName(lc.name);

    // 1. exact tvg_id match
    let found = epgChannels.find(ec => tvgIds.has(ec.channel_id.toLowerCase()));
    // 2. normalized name match
    if (!found) {
      found = epgChannels.find(ec => {
        const normEpg = normalizeChannelName(ec.display_name);
        return normEpg === normLogical || tvgNames.includes(normEpg);
      });
    }

    if (found) {
      upsert.run(lc.id, found.epg_source_id, found.channel_id);
      matched++;
    }
  }

  logInfo(`Auto-match EPG: ${matched}/${logicals.length} canales emparejados`);
  return matched;
}
