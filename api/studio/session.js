import { isStudioAuthenticated, studioConfigured } from '../../lib/studio-auth.js';

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });
  return res.status(200).json({
    configured: studioConfigured(),
    authenticated: studioConfigured() && isStudioAuthenticated(req),
    services: {
      github: Boolean(process.env.GITHUB_TOKEN),
      bunnyStorage: Boolean(process.env.BUNNY_STORAGE_ZONE && process.env.BUNNY_STORAGE_PASSWORD && process.env.BUNNY_STORAGE_CDN_URL),
      bunnyStream: Boolean(process.env.BUNNY_STREAM_LIBRARY_ID && process.env.BUNNY_STREAM_API_KEY)
    }
  });
}
