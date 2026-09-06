import sharp from 'sharp';
import { requireStudioAuth } from '../../lib/studio-auth.js';

const CINEMA_WIDTH = 1920;
const CINEMA_HEIGHT = Math.round(CINEMA_WIDTH / 2.39);

function cleanSegment(value, fallback = 'file') {
  return String(value || fallback)
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || fallback;
}

async function makePublicImage(input) {
  return sharp(input, { failOn: 'none' })
    .rotate()
    .resize({
      width: CINEMA_WIDTH,
      height: CINEMA_HEIGHT,
      fit: 'cover',
      position: sharp.strategy.attention,
      withoutEnlargement: true
    })
    .webp({ quality: 84, effort: 5 })
    .toBuffer();
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

  let publicImage;
  try {
    publicImage = await makePublicImage(body);
  } catch (error) {
    return res.status(422).json({ error: 'Image smart crop failed.', detail: String(error?.message || error).slice(0, 300) });
  }

  const slug = cleanSegment(req.query?.slug, 'draft');
  const requestedName = cleanSegment(req.query?.name, `image-${Date.now()}.webp`);
  const fileName = requestedName.replace(/\.[^.]+$/, '') + '.webp';
  const path = `notes/${slug}/${Date.now()}-${fileName}`;
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const uploadUrl = `https://${host}/${encodeURIComponent(zone)}/${encodedPath}`;

  const upload = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      AccessKey: password,
      'Content-Type': 'image/webp'
    },
    body: publicImage
  });

  if (!upload.ok) {
    const detail = await upload.text().catch(() => '');
    return res.status(502).json({ error: 'Bunny Storage upload failed.', detail: detail.slice(0, 400) });
  }

  return res.status(200).json({
    ok: true,
    path,
    url: `${cdn}/${path}`,
    crop: {
      ratio: '2.39:1',
      mode: 'content-aware-attention',
      width: CINEMA_WIDTH,
      height: CINEMA_HEIGHT
    }
  });
}
