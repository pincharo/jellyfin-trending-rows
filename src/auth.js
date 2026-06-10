import { createHmac, timingSafeEqual } from 'node:crypto';
import { ADMIN_PASSWORD, COOKIE_SECRET } from './config.js';

const COOKIE_NAME = 'iptv_session';
const COOKIE_TTL = 7 * 24 * 3600; // 7 days in seconds

function sign(payload) {
  const hmac = createHmac('sha256', COOKIE_SECRET).update(payload).digest('hex');
  return `${payload}.${hmac}`;
}

function verify(token) {
  if (!token) return false;
  const lastDot = token.lastIndexOf('.');
  if (lastDot < 0) return false;
  const payload = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  const expected = createHmac('sha256', COOKIE_SECRET).update(payload).digest('hex');
  try {
    if (!timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) return false;
  } catch { return false; }
  const expiry = parseInt(payload, 10);
  return Date.now() / 1000 < expiry;
}

export function login(req, res) {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Falta contraseña' });

  const aLen = Buffer.byteLength(password);
  const bLen = Buffer.byteLength(ADMIN_PASSWORD);
  const maxLen = Math.max(aLen, bLen);
  const aBuf = Buffer.alloc(maxLen); Buffer.from(password).copy(aBuf);
  const bBuf = Buffer.alloc(maxLen); Buffer.from(ADMIN_PASSWORD).copy(bBuf);
  if (!timingSafeEqual(aBuf, bBuf)) {
    return res.status(401).json({ error: 'Contraseña incorrecta' });
  }

  const expiry = Math.floor(Date.now() / 1000) + COOKIE_TTL;
  const token = sign(String(expiry));
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true, sameSite: 'lax', maxAge: COOKIE_TTL * 1000,
  });
  res.json({ ok: true });
}

export function logout(req, res) {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
}

export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (verify(token)) return next();
  res.status(401).json({ error: 'No autenticado' });
}
