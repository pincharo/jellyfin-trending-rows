import express from 'express';
import cookieParser from 'cookie-parser';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import db from './db.js';
import { PORT, BASE_URL, ADDON_TOKEN, DEFAULT_EPG_URL } from './config.js';
import addonRouter from './routes/addon.js';
import adminApiRouter from './routes/adminApi.js';
import { requireAuth } from './auth.js';
import { startScheduler } from './services/scheduler.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const app = express();

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

// ── Static placeholder icon ───────────────────────────────────────────────────
app.get('/placeholder.png', (req, res) => {
  res.set('Content-Type', 'image/svg+xml');
  res.send('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#1a1a2e"/><text x="40" y="48" font-size="28" text-anchor="middle" fill="#4a9eff">TV</text></svg>');
});

// ── Admin panel (SPA) ─────────────────────────────────────────────────────────
app.use('/admin', express.static(join(__dirname, '../public/admin')));

// Login / logout (public)
app.post('/api/admin/login', (req, res, next) => {
  import('./auth.js').then(({ login }) => login(req, res)).catch(next);
});

// Protected admin API
app.use('/api/admin', adminApiRouter);

// ── Stremio addon routes ───────────────────────────────────────────────────────
// Route: /:token/manifest.json etc.
app.use('/:token', addonRouter);

// ── Seed default EPG source if none exists ─────────────────────────────────────
function seedDefaults() {
  const epgCount = db.prepare('SELECT COUNT(*) as c FROM epg_sources').get().c;
  if (epgCount === 0) {
    db.prepare("INSERT INTO epg_sources(name,url) VALUES('EPG dobleM',?)")
      .run(DEFAULT_EPG_URL);
    console.log('EPG fuente por defecto añadida:', DEFAULT_EPG_URL);
  }

  // generate and store addon token if not set
  const tokenRow = db.prepare("SELECT value FROM settings WHERE key='addon_token'").get();
  if (!tokenRow) {
    const token = ADDON_TOKEN || generateToken();
    db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES('addon_token',?)").run(token);
    console.log(`\n🔑 Token del addon: ${token}`);
    console.log(`📺 Instala en Stremio: ${BASE_URL}/${token}/manifest.json\n`);
  } else {
    console.log(`📺 Instala en Stremio: ${BASE_URL}/${tokenRow.value}/manifest.json`);
  }
}

function generateToken() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

// ── Start ──────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Servidor arriba en http://localhost:${PORT}`);
  console.log(`Panel admin: http://localhost:${PORT}/admin`);
  seedDefaults();
  startScheduler();
});
