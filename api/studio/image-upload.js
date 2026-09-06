import { requireStudioAuth } from '../../lib/studio-auth.js';

function cleanSegment(value, fallback = 'file') {
  return String(value || fallback)
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || fallback;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  if (!requireStudioAuth(req, res)) return;

  const zone = process.env.BUNNY_STORAGE_ZONE;
  const password = process.env.BUNNY_STORAGE_PASSWORD;
  const cdn = (process.env.BUNNY_STORAGE_CDN_URL || '').replace(/\/$/, '');
  const host = process.env.BUNNY_STORAGE_HOSTNAME || 'storage.bunnycdn.com';
  if (!zone || !password || !cdn) return res.status(503).json({ error: 'Bunny Storage is not configured.' });

  const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
  if (!body.length) return res.status(400).json({ error: 'No image data received.' });
  if (body.length > 3.8 * 1024 * 1024) return res.status(413).json({ error: 'Compressed image is still too large.' });

  const slug = cleanSegment(req.query?.slug, 'draft');
  const fileName = cleanSegment(req.query?.name, `image-${Date.now()}.webp`);
  const path = `notes/${slug}/${Date.now()}-${fileName}`;
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const uploadUrl = `https://${host}/${encodeURIComponent(zone)}/${encodedPath}`;

  const upload = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      AccessKey: password,
      'Content-Type': 'application/octet-stream'
    },
    body
  });

  if (!upload.ok) {
    const detail = await upload.text().catch(() => '');
    return res.status(502).json({ error: 'Bunny Storage upload failed.', detail: detail.slice(0, 400) });
  }

  return res.status(200).json({
    ok: true,
    path,
    url: `${cdn}/${path}`
  });
}
