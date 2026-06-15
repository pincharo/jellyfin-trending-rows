import Database from 'better-sqlite3';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { DATA_DIR, DEFAULT_ROWS } from './config.js';

mkdirSync(DATA_DIR, { recursive: true });
const dbPath = join(DATA_DIR, 'addon.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const SCHEMA_VERSION = 6;

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS playlists (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    url             TEXT NOT NULL,
    last_fetched_at INTEGER,
    last_status     TEXT,
    channel_count   INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS raw_channels (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    playlist_id  INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    tvg_id       TEXT,
    tvg_name     TEXT NOT NULL,
    tvg_logo     TEXT,
    group_title  TEXT,
    stream_url   TEXT NOT NULL,
    stale        INTEGER DEFAULT 0,
    UNIQUE(playlist_id, stream_url)
  );

  CREATE TABLE IF NOT EXISTS rows (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    slug           TEXT UNIQUE NOT NULL,
    name           TEXT NOT NULL,
    sort_order     INTEGER DEFAULT 0,
    enabled        INTEGER DEFAULT 1,
    display_mode   TEXT DEFAULT 'epg',
    default_poster TEXT DEFAULT '',
    show_events    INTEGER DEFAULT 0,
    events_only    INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS logical_channels (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    slug       TEXT UNIQUE NOT NULL,
    name       TEXT NOT NULL,
    logo_url   TEXT,
    sort_order INTEGER DEFAULT 0,
    enabled    INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS channel_sources (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    logical_channel_id  INTEGER NOT NULL REFERENCES logical_channels(id) ON DELETE CASCADE,
    raw_channel_id      INTEGER NOT NULL REFERENCES raw_channels(id) ON DELETE CASCADE,
    priority            INTEGER DEFAULT 0,
    label               TEXT,
    UNIQUE(logical_channel_id, raw_channel_id)
  );

  CREATE TABLE IF NOT EXISTS channel_rows (
    logical_channel_id  INTEGER NOT NULL REFERENCES logical_channels(id) ON DELETE CASCADE,
    row_id              INTEGER NOT NULL REFERENCES rows(id) ON DELETE CASCADE,
    sort_order          INTEGER DEFAULT 0,
    custom_poster       TEXT DEFAULT '',
    custom_name         TEXT DEFAULT '',
    PRIMARY KEY(logical_channel_id, row_id)
  );

  CREATE TABLE IF NOT EXISTS epg_sources (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    url             TEXT NOT NULL,
    last_fetched_at INTEGER,
    last_status     TEXT
  );

  CREATE TABLE IF NOT EXISTS epg_channels (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    epg_source_id  INTEGER NOT NULL REFERENCES epg_sources(id) ON DELETE CASCADE,
    channel_id     TEXT NOT NULL,
    display_name   TEXT,
    icon           TEXT,
    UNIQUE(epg_source_id, channel_id)
  );

  CREATE TABLE IF NOT EXISTS epg_channel_map (
    logical_channel_id  INTEGER PRIMARY KEY REFERENCES logical_channels(id) ON DELETE CASCADE,
    epg_source_id       INTEGER NOT NULL REFERENCES epg_sources(id) ON DELETE CASCADE,
    epg_channel_id      TEXT NOT NULL,
    auto_matched        INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS programmes (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    epg_source_id  INTEGER NOT NULL REFERENCES epg_sources(id) ON DELETE CASCADE,
    epg_channel_id TEXT NOT NULL,
    start          INTEGER NOT NULL,
    stop           INTEGER NOT NULL,
    title          TEXT,
    sub_title      TEXT,
    description    TEXT,
    categories     TEXT
  );

  CREATE INDEX IF NOT EXISTS prog_time ON programmes(epg_channel_id, start, stop);
  CREATE INDEX IF NOT EXISTS prog_source ON programmes(epg_source_id);
`);

// Unique index prevents duplicate programmes (dobleM XML repeats entries).
// Existing DBs may already hold duplicates — dedupe first, then create the index.
try {
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS prog_unique ON programmes(epg_source_id, epg_channel_id, start)');
} catch {
  db.exec(`DELETE FROM programmes WHERE id NOT IN (
    SELECT MIN(id) FROM programmes GROUP BY epg_source_id, epg_channel_id, start
  )`);
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS prog_unique ON programmes(epg_source_id, epg_channel_id, start)');
}

// seed default rows if missing
const rowCount = db.prepare('SELECT COUNT(*) as c FROM rows').get().c;
if (rowCount === 0) {
  const insertRow = db.prepare('INSERT OR IGNORE INTO rows(slug,name,sort_order) VALUES(?,?,?)');
  for (const r of DEFAULT_ROWS) insertRow.run(r.slug, r.name, r.sort_order);
}

// schema version tracking + migrations
const storedVersion = db.prepare("SELECT value FROM settings WHERE key='schema_version'").get();
const currentVersion = storedVersion ? Number(storedVersion.value) : 0;

if (currentVersion < 2) {
  try { db.exec("ALTER TABLE programmes ADD COLUMN icon TEXT DEFAULT ''"); } catch {}
  db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES('poster_orientation','landscape')").run();
  db.prepare("INSERT OR REPLACE INTO settings(key,value) VALUES('schema_version','2')").run();
}

if (currentVersion < 3) {
  try { db.exec("ALTER TABLE rows ADD COLUMN display_mode TEXT DEFAULT 'epg'"); } catch {}
  try { db.exec("ALTER TABLE rows ADD COLUMN default_poster TEXT DEFAULT ''"); } catch {}
  try { db.exec("ALTER TABLE channel_rows ADD COLUMN custom_poster TEXT DEFAULT ''"); } catch {}
  try { db.exec("ALTER TABLE channel_rows ADD COLUMN custom_name TEXT DEFAULT ''"); } catch {}
  db.prepare("INSERT OR REPLACE INTO settings(key,value) VALUES('schema_version','3')").run();
}

if (currentVersion < 4) {
  // Switch default landscape EPG to guiafanart_color1 (title-only, no sub-title noise)
  db.prepare("UPDATE epg_sources SET url=? WHERE url=?").run(
    'https://raw.githubusercontent.com/davidmuma/EPG_dobleM/master/guiafanart_color1.xml.gz',
    'https://raw.githubusercontent.com/davidmuma/EPG_dobleM/master/guiafanart_color.xml.gz'
  );
  db.prepare("INSERT OR REPLACE INTO settings(key,value) VALUES('schema_version','4')").run();
}

if (currentVersion < 5) {
  try { db.exec("ALTER TABLE rows ADD COLUMN show_events INTEGER DEFAULT 0"); } catch {}
  db.prepare("INSERT OR REPLACE INTO settings(key,value) VALUES('schema_version','5')").run();
}

if (currentVersion < 6) {
  try { db.exec("ALTER TABLE rows ADD COLUMN events_only INTEGER DEFAULT 0"); } catch {}
  db.prepare("INSERT OR REPLACE INTO settings(key,value) VALUES('schema_version','6')").run();
}

export default db;
