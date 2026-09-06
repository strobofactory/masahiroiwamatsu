import crypto from 'node:crypto';
import { setStudioSession, studioConfigured } from '../../lib/studio-auth.js';

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  if (!studioConfigured()) return res.status(503).json({ error: 'Studio authentication is not configured.' });
  const password = req.body?.password || '';
  if (!safeEqual(password, process.env.STUDIO_PASSWORD)) return res.status(401).json({ error: 'Password is incorrect.' });
  setStudioSession(res);
  return res.status(200).json({ ok: true });
}
