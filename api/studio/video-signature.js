import crypto from 'node:crypto';
import { requireStudioAuth } from '../../lib/studio-auth.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  if (!requireStudioAuth(req, res)) return;

  const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
  const apiKey = process.env.BUNNY_STREAM_API_KEY;
  if (!libraryId || !apiKey) return res.status(503).json({ error: 'Bunny Stream is not configured.' });

  const title = String(req.body?.title || 'NOMAD FIELD video').slice(0, 180);
  const created = await fetch(`https://video.bunnycdn.com/library/${encodeURIComponent(libraryId)}/videos`, {
    method: 'POST',
    headers: {
      AccessKey: apiKey,
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ title })
  });

  if (!created.ok) {
    const detail = await created.text().catch(() => '');
    return res.status(502).json({ error: 'Could not create Bunny Stream video.', detail: detail.slice(0, 400) });
  }

  const video = await created.json();
  const videoId = video.guid;
  if (!videoId) return res.status(502).json({ error: 'Bunny Stream did not return a video ID.' });

  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
  const signature = crypto
    .createHash('sha256')
    .update(`${libraryId}${apiKey}${expiresAt}${videoId}`)
    .digest('hex');

  const embedUrl = `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}`;
  const markdown = `<div style="position:relative;padding-top:56.25%;margin:36px 0;overflow:hidden"><iframe src="${embedUrl}" loading="lazy" style="border:0;position:absolute;inset:0;width:100%;height:100%" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`;
  return res.status(200).json({
    ok: true,
    endpoint: 'https://video.bunnycdn.com/tusupload',
    videoId,
    libraryId: String(libraryId),
    expiresAt,
    signature,
    embedUrl,
    markdown
  });
}
