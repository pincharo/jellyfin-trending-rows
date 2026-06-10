import { randomBytes } from 'node:crypto';

export const PORT = parseInt(process.env.PORT || '7000', 10);
export const DATA_DIR = process.env.DATA_DIR || './data';
export const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
export const ADDON_TOKEN = process.env.ADDON_TOKEN || '';
export const COOKIE_SECRET = process.env.COOKIE_SECRET || randomBytes(32).toString('hex');

export const DEFAULT_EPG_URL = 'https://raw.githubusercontent.com/davidmuma/EPG_dobleM/master/guiafanart_color.xml.gz';

export const DEFAULT_ROWS = [
  { slug: 'canales',    name: 'Canales',    sort_order: 0 },
  { slug: 'futbol',     name: 'Fútbol',     sort_order: 1 },
  { slug: 'baloncesto', name: 'Baloncesto', sort_order: 2 },
  { slug: 'motor',      name: 'Motor',      sort_order: 3 },
];
