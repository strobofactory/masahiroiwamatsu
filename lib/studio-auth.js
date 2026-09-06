import crypto from 'node:crypto';

const COOKIE_NAME = 'nomad_studio';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 14;

function getSecret() {
  return process.env.STUDIO_SESSION_SECRET || '';
}

export function studioConfigured() {
  return Boolean(process.env.STUDIO_PASSWORD && getSecret());
}

export function getStudioToken() {
  const secret = getSecret();
  if (!secret) return '';
  return crypto.createHmac('sha256', secret).update('nomad-field-studio-v1').digest('hex');
}

function readCookie(req, name) {
  if (req.cookies && typeof req.cookies === 'object' && req.cookies[name]) return req.cookies[name];
  const header = req.headers?.cookie || '';
  for (const pair of header.split(';')) {
    const [key, ...rest] = pair.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return '';
}

function safeEqual(a, b) {
  if (!a || !b) return false;
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function isStudioAuthenticated(req) {
  return safeEqual(readCookie(req, COOKIE_NAME), getStudioToken());
}

export function setStudioSession(res) {
  const token = getStudioToken();
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${COOKIE_MAX_AGE}`);
}

export function clearStudioSession(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
}

export function requireStudioAuth(req, res) {
  if (!studioConfigured()) {
    res.status(503).json({ error: 'Studio authentication is not configured.' });
    return false;
  }
  if (!isStudioAuthenticated(req)) {
    res.status(401).json({ error: 'Authentication required.' });
    return false;
  }
  return true;
}
