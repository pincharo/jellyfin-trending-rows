import { Router } from 'express';
import db from '../db.js';
import { BASE_URL, ADDON_TOKEN } from '../config.js';
import { channelsForRow, channelMeta, channelStreams } from '../services/catalog.js';

const router = Router({ mergeParams: true });

// token middleware
router.use((req, res, next) => {
  const { token } = req.params;
  const expected = db.prepare("SELECT value FROM settings WHERE key='addon_token'").get()?.value || ADDON_TOKEN;
  if (expected && token !== expected) return res.status(403).json({ error: 'Token inválido' });
  next();
});

// CORS for all addon routes
router.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// manifest
router.get('/manifest.json', (req, res) => {
  const rows = db.prepare('SELECT slug,name FROM rows WHERE enabled=1 ORDER BY sort_order').all();

  const catalogs = rows.map(row => ({
    type: 'tv',
    id: `iptv_${row.slug}`,
    name: row.name,
    extra: [
      { name: 'skip', isRequired: false },
    ],
    behaviorHints: { notForHome: row.slug !== 'canales' },
  }));

  const addonId = db.prepare("SELECT value FROM settings WHERE key='addon_id'").get()?.value
    || 'org.private.iptv';

  res.json({
    id: addonId,
    version: '1.0.0',
    name: 'IPTV Privado',
    description: 'Canales IPTV privados con EPG y filas deportivas',
    resources: [
      { name: 'catalog', types: ['tv'] },
      { name: 'meta',    types: ['tv'], idPrefixes: ['iptv:'] },
      { name: 'stream',  types: ['tv'], idPrefixes: ['iptv:'] },
    ],
    types: ['tv'],
    catalogs,
    behaviorHints: { adult: false, p2p: false },
  });
});

// catalog
router.get('/catalog/tv/:catalogId.json', (req, res) => {
  const { catalogId } = req.params;
  const skip = parseInt(req.query.skip || '0', 10);

  const rowSlug = catalogId.replace(/^iptv_/, '');
  const metas = channelsForRow(rowSlug, skip, 100);
  res.json({ metas });
});

// meta
router.get('/meta/tv/:id.json', (req, res) => {
  const id = req.params.id;
  if (!id.startsWith('iptv:')) return res.json({ meta: null });

  const slug = id.slice(5);
  const meta = channelMeta(slug);
  res.json({ meta: meta || null });
});

// stream
router.get('/stream/tv/:id.json', (req, res) => {
  const id = req.params.id;
  if (!id.startsWith('iptv:')) return res.json({ streams: [] });

  const slug = id.slice(5);
  const streams = channelStreams(slug);
  res.json({ streams });
});

export default router;
