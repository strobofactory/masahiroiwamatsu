import { clearStudioSession } from '../../lib/studio-auth.js';

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  clearStudioSession(res);
  return res.status(200).json({ ok: true });
}
