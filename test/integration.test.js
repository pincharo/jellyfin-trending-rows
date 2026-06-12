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
