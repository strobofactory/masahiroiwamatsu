import { getVercelOidcToken } from '@vercel/oidc';
import { isStudioAuthenticated, studioConfigured } from '../../lib/studio-auth.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });

  let translation = Boolean(process.env.AI_GATEWAY_API_KEY);
  if (!translation) {
    try {
      translation = Boolean(process.env.VERCEL_OIDC_TOKEN || await getVercelOidcToken());
    } catch {
      translation = false;
    }
  }

  return res.status(200).json({
    configured: studioConfigured(),
    authenticated: studioConfigured() && isStudioAuthenticated(req),
    services: {
      github: Boolean(process.env.GITHUB_TOKEN),
      bunnyStorage: Boolean(process.env.BUNNY_STORAGE_ZONE && process.env.BUNNY_STORAGE_PASSWORD && process.env.BUNNY_STORAGE_CDN_URL),
      bunnyStream: Boolean(process.env.BUNNY_STREAM_LIBRARY_ID && process.env.BUNNY_STREAM_API_KEY),
      translation
    }
  });
}
