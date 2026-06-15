import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Configure environment BEFORE importing the server (db.js reads DATA_DIR on import)
const tempDir = mkdtempSync(join(tmpdir(), 'iptv-test-'));
process.env.DATA_DIR = tempDir;
process.env.ADMIN_PASSWORD = 'test-password-123';
process.env.ADDON_TOKEN = 'test-token';

let server, baseUrl, db, cookie;

before(async () => {
  const { app, seedDefaults } = await import('../src/server.js');
  db = (await import('../src/db.js')).default;
  seedDefaults();
  await new Promise(resolve => {
    server = app.listen(0, resolve);
  });
  baseUrl = `http://localhost:${server.address().port}`;
});

after(() => {
  server?.close();
  db?.close();
  rmSync(tempDir, { recursive: true, force: true });
});

test('health endpoint responds', async () => {
  const res = await fetch(`${baseUrl}/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
});

test('manifest requires valid token', async () => {
  const bad = await fetch(`${baseUrl}/wrong-token/manifest.json`);
  assert.equal(bad.status, 403);

  const good = await fetch(`${baseUrl}/test-token/manifest.json`);
  assert.equal(good.status, 200);
  assert.equal(good.headers.get('access-control-allow-origin'), '*');

  const manifest = await good.json();
  assert.equal(manifest.types[0], 'tv');
  assert.ok(manifest.catalogs.length >= 4);
  const slugs = manifest.catalogs.map(c => c.id);
  assert.ok(slugs.includes('iptv_canales'));
  assert.ok(slugs.includes('iptv_futbol'));
  assert.ok(slugs.includes('iptv_baloncesto'));
  assert.ok(slugs.includes('iptv_motor'));
});

test('default EPG source is seeded', () => {
  const epg = db.prepare('SELECT * FROM epg_sources').all();
  assert.equal(epg.length, 1);
  assert.match(epg[0].url, /EPG_dobleM/);
});

test('admin API rejects unauthenticated requests', async () => {
  const res = await fetch(`${baseUrl}/api/admin/status`);
  assert.equal(res.status, 401);
});

test('admin login fails with wrong password', async () => {
  const res = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'incorrecta' }),
  });
  assert.equal(res.status, 401);
});

test('admin login succeeds and grants session', async () => {
  const res = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'test-password-123' }),
  });
  assert.equal(res.status, 200);
  cookie = res.headers.get('set-cookie').split(';')[0];
  assert.match(cookie, /iptv_session=/);

  const status = await fetch(`${baseUrl}/api/admin/status`, { headers: { cookie } });
  assert.equal(status.status, 200);
  const body = await status.json();
  assert.equal(typeof body.programmes, 'number');
});

test('full flow: create channel, add source, assign to row, get streams', async () => {
  const headers = { cookie, 'Content-Type': 'application/json' };

  // Simulate an imported raw channel (normally done by playlist refresh)
  db.prepare('INSERT INTO playlists(name,url) VALUES(?,?)').run('Test', 'http://test/list.m3u');
  const plId = db.prepare('SELECT id FROM playlists ORDER BY id DESC LIMIT 1').get().id;
  db.prepare(`INSERT INTO raw_channels(playlist_id,tvg_id,tvg_name,tvg_logo,group_title,stream_url)
    VALUES(?,?,?,?,?,?)`).run(plId, 'MovistarLaLiga.es', 'M+ LaLiga FHD', '', 'DEPORTES', 'http://test/stream/1001');
  const rawId = db.prepare('SELECT id FROM raw_channels ORDER BY id DESC LIMIT 1').get().id;

  // Create logical channel
  const chRes = await fetch(`${baseUrl}/api/admin/channels`, {
    method: 'POST', headers, body: JSON.stringify({ name: 'M+ LaLiga' }),
  });
  assert.equal(chRes.status, 200);
  const { id: chId, slug } = await chRes.json();

  // Add the raw channel as a source
  const srcRes = await fetch(`${baseUrl}/api/admin/channels/${chId}/sources`, {
    method: 'POST', headers, body: JSON.stringify({ raw_channel_id: rawId }),
  });
  assert.equal(srcRes.status, 200);

  // Assign the channel to the Fútbol row
  const futbolRow = db.prepare("SELECT id FROM rows WHERE slug='futbol'").get();
  const rowRes = await fetch(`${baseUrl}/api/admin/rows/${futbolRow.id}/channels`, {
    method: 'POST', headers, body: JSON.stringify({ logical_channel_id: chId }),
  });
  assert.equal(rowRes.status, 200);

  // The Fútbol catalog now lists it
  const cat = await (await fetch(`${baseUrl}/test-token/catalog/tv/iptv_futbol.json`)).json();
  assert.equal(cat.metas.length, 1);
  assert.equal(cat.metas[0].id, `iptv:${slug}`);
  assert.equal(cat.metas[0].name, 'M+ LaLiga');

  // Meta endpoint resolves
  const meta = await (await fetch(`${baseUrl}/test-token/meta/tv/iptv:${slug}.json`)).json();
  assert.equal(meta.meta.name, 'M+ LaLiga');

  // Stream endpoint returns the IPTV source
  const streams = await (await fetch(`${baseUrl}/test-token/stream/tv/iptv:${slug}.json`)).json();
  assert.equal(streams.streams.length, 1);
  assert.equal(streams.streams[0].url, 'http://test/stream/1001');
  assert.equal(streams.streams[0].name, 'Fuente 1');
});

test('EPG mapping enriches catalog description', async () => {
  const headers = { cookie, 'Content-Type': 'application/json' };

  // Insert a fake EPG channel + current programme
  const epgSourceId = db.prepare('SELECT id FROM epg_sources LIMIT 1').get().id;
  db.prepare('INSERT INTO epg_channels(epg_source_id,channel_id,display_name,icon) VALUES(?,?,?,?)')
    .run(epgSourceId, 'M+ LaLiga HD', 'M+ LaLiga', 'https://logos.example/laliga.png');

  const now = Math.floor(Date.now() / 1000);
  db.prepare(`INSERT INTO programmes(epg_source_id,epg_channel_id,start,stop,title,sub_title,description,categories,icon)
    VALUES(?,?,?,?,?,?,?,?,?)`)
    .run(epgSourceId, 'M+ LaLiga HD', now - 1800, now + 5400, 'Real Madrid vs Barcelona', '', '', '["deportes","fútbol"]',
      'https://fanart.example/clasico.jpg');

  // Auto-match should link "M+ LaLiga" logical channel to "M+ LaLiga HD" EPG channel
  const match = await fetch(`${baseUrl}/api/admin/epg-map/auto-match`, { method: 'POST', headers });
  const matchBody = await match.json();
  assert.equal(matchBody.matched, 1);

  // Duplicate programme inserts are ignored (unique index)
  const dup = db.prepare(`INSERT OR IGNORE INTO programmes(epg_source_id,epg_channel_id,start,stop,title,sub_title,description,categories)
    VALUES(?,?,?,?,?,?,?,?)`)
    .run(epgSourceId, 'M+ LaLiga HD', Math.floor(Date.now() / 1000) - 1800, Math.floor(Date.now() / 1000) + 5400, 'Duplicado', '', '', '[]');
  assert.equal(dup.changes, 0);

  // Catalog should now show the current programme
  const cat = await (await fetch(`${baseUrl}/test-token/catalog/tv/iptv_futbol.json`)).json();
  assert.match(cat.metas[0].description, /Ahora: Real Madrid vs Barcelona/);
  // Live programme: name becomes "evento — canal" and its fanart is the landscape poster/background
  assert.equal(cat.metas[0].name, 'Real Madrid vs Barcelona — M+ LaLiga');
  assert.equal(cat.metas[0].poster, 'https://fanart.example/clasico.jpg');
  assert.equal(cat.metas[0].background, 'https://fanart.example/clasico.jpg');
  assert.equal(cat.metas[0].posterShape, 'landscape');
  // Channel logo lives in the logo field (EPG icon fallback)
  assert.equal(cat.metas[0].logo, 'https://logos.example/laliga.png');
});

test('channel list includes counts and editor badges data', async () => {
  const list = await (await fetch(`${baseUrl}/api/admin/channels`, { headers: { cookie } })).json();
  const ch = list.find(c => c.name === 'M+ LaLiga');
  assert.equal(ch.source_count, 1);
  assert.equal(ch.row_count, 1);
  assert.equal(ch.has_epg, 1);
});

test('row channel reorder and disabled channels in preview', async () => {
  const headers = { cookie, 'Content-Type': 'application/json' };
  const futbolRow = db.prepare("SELECT id FROM rows WHERE slug='futbol'").get();
  const first = db.prepare("SELECT id FROM logical_channels WHERE name='M+ LaLiga'").get();

  // add a second channel to the row
  const ch2 = await (await fetch(`${baseUrl}/api/admin/channels`, {
    method: 'POST', headers, body: JSON.stringify({ name: 'DAZN LaLiga' }),
  })).json();
  await fetch(`${baseUrl}/api/admin/rows/${futbolRow.id}/channels`, {
    method: 'POST', headers, body: JSON.stringify({ logical_channel_id: ch2.id }),
  });

  // reorder: DAZN first
  const reorder = await fetch(`${baseUrl}/api/admin/rows/${futbolRow.id}/channels-order`, {
    method: 'PUT', headers, body: JSON.stringify({ order: [ch2.id, first.id] }),
  });
  assert.equal(reorder.status, 200);

  let prev = await (await fetch(`${baseUrl}/api/admin/rows/${futbolRow.id}/preview`, { headers })).json();
  assert.equal(prev.channels[0].id, ch2.id);
  assert.equal(prev.channels[1].id, first.id);
  assert.equal(prev.channels[0].enabled, true);

  // disable the first channel → still listed in preview, marked disabled, gone from catalog
  await fetch(`${baseUrl}/api/admin/channels/${ch2.id}`, {
    method: 'PUT', headers, body: JSON.stringify({ enabled: 0 }),
  });
  prev = await (await fetch(`${baseUrl}/api/admin/rows/${futbolRow.id}/preview`, { headers })).json();
  const disabled = prev.channels.find(c => c.id === ch2.id);
  assert.equal(disabled.enabled, false);
  assert.match(disabled.poster, /^\/poster\/channel\//);

  const cat = await (await fetch(`${baseUrl}/test-token/catalog/tv/iptv_futbol.json`)).json();
  assert.ok(!cat.metas.some(m => m.id === `iptv:${ch2.slug}`));

  // re-enable for any later assertions
  await fetch(`${baseUrl}/api/admin/channels/${ch2.id}`, {
    method: 'PUT', headers, body: JSON.stringify({ enabled: 1 }),
  });
});

test('source reorder endpoint swaps priorities atomically', async () => {
  const headers = { cookie, 'Content-Type': 'application/json' };
  const ch = db.prepare("SELECT id FROM logical_channels WHERE name='M+ LaLiga'").get();
  const plId = db.prepare('SELECT id FROM playlists ORDER BY id LIMIT 1').get().id;

  db.prepare(`INSERT INTO raw_channels(playlist_id,tvg_id,tvg_name,tvg_logo,group_title,stream_url)
    VALUES(?,?,?,?,?,?)`).run(plId, '', 'M+ LaLiga 2 FHD', '', 'DEPORTES', 'http://test/stream/1002');
  const raw2 = db.prepare('SELECT id FROM raw_channels ORDER BY id DESC LIMIT 1').get().id;
  await fetch(`${baseUrl}/api/admin/channels/${ch.id}/sources`, {
    method: 'POST', headers, body: JSON.stringify({ raw_channel_id: raw2 }),
  });

  const sources = await (await fetch(`${baseUrl}/api/admin/channels/${ch.id}/sources`, { headers })).json();
  assert.equal(sources.length, 2);

  // reverse the order
  const reversed = sources.map(s => s.id).reverse();
  const r = await fetch(`${baseUrl}/api/admin/channels/${ch.id}/sources-order`, {
    method: 'PUT', headers, body: JSON.stringify({ order: reversed }),
  });
  assert.equal(r.status, 200);

  const after = await (await fetch(`${baseUrl}/api/admin/channels/${ch.id}/sources`, { headers })).json();
  assert.deepEqual(after.map(s => s.id), reversed);
});

test('row display_mode canal uses channel name and default_poster', async () => {
  const headers = { cookie, 'Content-Type': 'application/json' };
  const futbolRow = db.prepare("SELECT id FROM rows WHERE slug='futbol'").get();

  // Switch to canal mode with a default poster
  const sw = await fetch(`${baseUrl}/api/admin/rows/${futbolRow.id}`, {
    method: 'PUT', headers,
    body: JSON.stringify({ display_mode: 'canal', default_poster: 'https://example.com/futbol-bg.jpg' }),
  });
  assert.equal(sw.status, 200);

  const cat = await (await fetch(`${baseUrl}/test-token/catalog/tv/iptv_futbol.json`)).json();
  const laliga = cat.metas.find(m => m.name === 'M+ LaLiga');
  assert.ok(laliga, 'M+ LaLiga should be in the row');
  // In canal mode: name = channel name (not programme title)
  assert.equal(laliga.name, 'M+ LaLiga');
  // In canal mode: poster = default_poster (no custom_poster set yet)
  assert.equal(laliga.poster, 'https://example.com/futbol-bg.jpg');
  // background still shows fanart from EPG
  assert.equal(laliga.background, 'https://fanart.example/clasico.jpg');
});

test('custom_poster and custom_name per channel-row take highest priority', async () => {
  const headers = { cookie, 'Content-Type': 'application/json' };
  const futbolRow = db.prepare("SELECT id FROM rows WHERE slug='futbol'").get();
  const laligaCh  = db.prepare("SELECT id FROM logical_channels WHERE name='M+ LaLiga'").get();

  // Set per-channel-row overrides
  const r = await fetch(`${baseUrl}/api/admin/rows/${futbolRow.id}/channels/${laligaCh.id}/custom`, {
    method: 'PUT', headers,
    body: JSON.stringify({ custom_poster: 'https://example.com/laliga-custom.jpg', custom_name: 'LaLiga EA Sports' }),
  });
  assert.equal(r.status, 200);

  const cat = await (await fetch(`${baseUrl}/test-token/catalog/tv/iptv_futbol.json`)).json();
  const entry = cat.metas.find(m => m.id === `iptv:${db.prepare("SELECT slug FROM logical_channels WHERE name='M+ LaLiga'").get().slug}`);
  // custom_name wins over channel name (canal mode) and programme title (epg mode)
  assert.equal(entry.name, 'LaLiga EA Sports');
  // custom_poster wins over default_poster and fanart
  assert.equal(entry.poster, 'https://example.com/laliga-custom.jpg');

  // preview endpoint exposes the custom fields
  const prev = await (await fetch(`${baseUrl}/api/admin/rows/${futbolRow.id}/preview`, { headers })).json();
  const pch = prev.channels.find(c => c.id === laligaCh.id);
  assert.equal(pch.custom_poster, 'https://example.com/laliga-custom.jpg');
  assert.equal(pch.custom_name, 'LaLiga EA Sports');
});

test('custom_name in epg mode overrides programme title, row mode reverts to epg', async () => {
  const headers = { cookie, 'Content-Type': 'application/json' };
  const futbolRow = db.prepare("SELECT id FROM rows WHERE slug='futbol'").get();
  const laligaCh  = db.prepare("SELECT id FROM logical_channels WHERE name='M+ LaLiga'").get();

  // Revert row to EPG mode first
  await fetch(`${baseUrl}/api/admin/rows/${futbolRow.id}`, {
    method: 'PUT', headers, body: JSON.stringify({ display_mode: 'epg' }),
  });

  // custom_name should still override the programme title in EPG mode
  const cat = await (await fetch(`${baseUrl}/test-token/catalog/tv/iptv_futbol.json`)).json();
  const slug = db.prepare("SELECT slug FROM logical_channels WHERE name='M+ LaLiga'").get().slug;
  const entry = cat.metas.find(m => m.id === `iptv:${slug}`);
  assert.equal(entry.name, 'LaLiga EA Sports');
  // poster falls back to fanart (EPG mode, custom_poster still set from previous test)
  assert.equal(entry.poster, 'https://example.com/laliga-custom.jpg');

  // Clear the custom overrides
  await fetch(`${baseUrl}/api/admin/rows/${futbolRow.id}/channels/${laligaCh.id}/custom`, {
    method: 'PUT', headers, body: JSON.stringify({ custom_poster: '', custom_name: '' }),
  });
  const cat2 = await (await fetch(`${baseUrl}/test-token/catalog/tv/iptv_futbol.json`)).json();
  const entry2 = cat2.metas.find(m => m.id === `iptv:${slug}`);
  // Back to EPG mode default: programme title — channel name
  assert.equal(entry2.name, 'Real Madrid vs Barcelona — M+ LaLiga');
  assert.equal(entry2.poster, 'https://fanart.example/clasico.jpg');
});

test('show_events: DIRECTO programmes appear as event tiles in catalog', async () => {
  const headers = { cookie, 'Content-Type': 'application/json' };
  const futbolRow = db.prepare("SELECT id FROM rows WHERE slug='futbol'").get();
  const epgSourceId = db.prepare('SELECT id FROM epg_sources LIMIT 1').get().id;
  const now = Math.floor(Date.now() / 1000);

  // Insert: live DIRECTO event (in progress)
  const liveStart = now - 600;
  db.prepare(`INSERT OR IGNORE INTO programmes(epg_source_id,epg_channel_id,start,stop,title,sub_title,description,categories,icon)
    VALUES(?,?,?,?,?,?,?,?,?)`)
    .run(epgSourceId, 'M+ LaLiga HD', liveStart, now + 3600, '🔴 DIRECTO Grupo B: Test en Vivo', '', '', '[]', 'https://fanart.example/live.jpg');

  // Insert: upcoming DIRECTO event (2h from now)
  const futureStart = now + 7200;
  db.prepare(`INSERT OR IGNORE INTO programmes(epg_source_id,epg_channel_id,start,stop,title,sub_title,description,categories,icon)
    VALUES(?,?,?,?,?,?,?,?,?)`)
    .run(epgSourceId, 'M+ LaLiga HD', futureStart, now + 10800, '🔴 DIRECTO Grupo D: Partido Futuro', '', '', '[]', '');

  // Insert: normal programme without DIRECTO marker (should NOT appear as event tile)
  db.prepare(`INSERT OR IGNORE INTO programmes(epg_source_id,epg_channel_id,start,stop,title,sub_title,description,categories,icon)
    VALUES(?,?,?,?,?,?,?,?,?)`)
    .run(epgSourceId, 'M+ LaLiga HD', now + 11000, now + 14400, 'Documental: Historia del Fútbol', '', '', '[]', '');

  // Insert: DIRECTO pre-match studio show (category "Programa deportes") — must NOT
  // appear as an event; only actual matches should. This is the dobleM prepartido case.
  db.prepare(`INSERT OR IGNORE INTO programmes(epg_source_id,epg_channel_id,start,stop,title,sub_title,description,categories,icon)
    VALUES(?,?,?,?,?,?,?,?,?)`)
    .run(epgSourceId, 'M+ LaLiga HD', now - 1200, now + 1800,
      'DIRECTO Prepartido España - Cabo Verde T1 DAZN Mundial', '',
      'Deportes,Programa deportes | 2026 | TP', '["deportes","programa deportes"]', '');

  // Enable show_events on the fútbol row
  const r = await fetch(`${baseUrl}/api/admin/rows/${futbolRow.id}`, {
    method: 'PUT', headers, body: JSON.stringify({ show_events: 1 }),
  });
  assert.equal(r.status, 200);

  // Catalog should include 2 extra event tiles
  const cat = await (await fetch(`${baseUrl}/test-token/catalog/tv/iptv_futbol.json`)).json();
  const eventMetas = cat.metas.filter(m => m.id.includes(':ev:'));
  assert.equal(eventMetas.length, 2, 'should have 2 event tiles');

  // Live event tile has 🔴 LIVE prefix and correct ID
  const liveEvent = eventMetas.find(m => m.name.startsWith('🔴 LIVE'));
  assert.ok(liveEvent, 'live event tile should exist');
  assert.equal(liveEvent.id, `iptv:${db.prepare("SELECT slug FROM logical_channels WHERE name='M+ LaLiga'").get().slug}:ev:${liveStart}`);
  assert.equal(liveEvent.poster, 'https://fanart.example/live.jpg');

  // Future event tile has Próximamente prefix
  const futureEvent = eventMetas.find(m => m.name.startsWith('Próximamente'));
  assert.ok(futureEvent, 'future event tile should exist');
  assert.ok(futureEvent.name.includes('Partido Futuro'), 'title should have DIRECTO stripped');

  // Normal programme does NOT appear as event tile
  assert.ok(!cat.metas.some(m => m.id.includes(':ev:') && m.name.includes('Documental')));

  // Studio/pre-match show (category "Programa deportes") does NOT appear as event tile
  assert.ok(!cat.metas.some(m => m.id.includes(':ev:') && m.name.includes('Prepartido')),
    'prepartido studio show must be filtered out');

  // meta endpoint resolves for event ID
  const metaRes = await (await fetch(`${baseUrl}/test-token/meta/tv/${liveEvent.id}.json`)).json();
  assert.ok(metaRes.meta, 'event meta should resolve');
  assert.ok(metaRes.meta.name.startsWith('🔴 LIVE'));

  // stream endpoint returns the underlying channel streams
  const streamRes = await (await fetch(`${baseUrl}/test-token/stream/tv/${liveEvent.id}.json`)).json();
  assert.ok(streamRes.streams.length > 0, 'event stream should resolve to channel streams');

  // Disabling show_events removes event tiles from catalog
  await fetch(`${baseUrl}/api/admin/rows/${futbolRow.id}`, {
    method: 'PUT', headers, body: JSON.stringify({ show_events: 0 }),
  });
  const cat2 = await (await fetch(`${baseUrl}/test-token/catalog/tv/iptv_futbol.json`)).json();
  assert.ok(!cat2.metas.some(m => m.id.includes(':ev:')), 'event tiles should disappear when show_events=0');
});
