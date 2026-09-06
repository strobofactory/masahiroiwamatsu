import { requireStudioAuth } from '../../lib/studio-auth.js';

const REPO = 'strobofactory/masahiroiwamatsu';
const BRANCH = 'main';

function slugify(input) {
  return String(input || '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100);
}

function yamlString(value) {
  return JSON.stringify(String(value ?? ''));
}

function yamlArray(values) {
  return `[${(values || []).map((v) => yamlString(v)).join(', ')}]`;
}

async function githubRequest(path, options = {}) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN is not configured.');
  return fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {})
    }
  });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  if (!requireStudioAuth(req, res)) return;

  const title = String(req.body?.title || '').trim();
  const description = String(req.body?.description || '').trim();
  const body = String(req.body?.body || '').trim();
  const tags = Array.isArray(req.body?.tags) ? req.body.tags.map((x) => String(x).trim()).filter(Boolean).slice(0, 12) : [];
  const draft = req.body?.draft !== false;
  const requestedSlug = String(req.body?.slug || '').trim();
  const slug = slugify(requestedSlug || title);
  const originalSlug = slugify(String(req.body?.originalSlug || '').trim());
  const image = String(req.body?.image || '').trim();
  const imageAlt = String(req.body?.imageAlt || '').trim();
  const imageCaption = String(req.body?.imageCaption || '').trim();

  if (!title || !description || !body) return res.status(400).json({ error: 'Title, description and body are required.' });
  if (!slug) return res.status(400).json({ error: 'A valid ASCII slug is required.' });
  if (originalSlug && originalSlug !== slug) return res.status(400).json({ error: '既存記事のURL（slug）はStudioから変更できません。新しい記事として作成してください。' });

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const filePath = `src/content/notes/${slug}.md`;
  const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');

  let currentSha = null;
  const existing = await githubRequest(`/contents/${encodedPath}?ref=${encodeURIComponent(BRANCH)}`);
  if (existing.ok) {
    const json = await existing.json();
    currentSha = json.sha || null;
  } else if (existing.status !== 404) {
    const detail = await existing.text().catch(() => '');
    return res.status(502).json({ error: 'Could not read article from GitHub.', detail: detail.slice(0, 400) });
  }

  const isEditing = Boolean(currentSha && originalSlug);
  const pubDate = String(req.body?.pubDate || today).slice(0, 10);
  const lines = [
    '---',
    `title: ${yamlString(title)}`,
    `description: ${yamlString(description)}`,
    `pubDate: ${pubDate}`
  ];
  if (isEditing) lines.push(`updatedDate: ${today}`);
  lines.push(
    `tags: ${yamlArray(tags)}`,
    `draft: ${draft ? 'true' : 'false'}`
  );
  if (image) lines.push(`image: ${yamlString(image)}`);
  if (imageAlt) lines.push(`imageAlt: ${yamlString(imageAlt)}`);
  if (imageCaption) lines.push(`imageCaption: ${yamlString(imageCaption)}`);
  lines.push('---', '', body, '');
  const content = lines.join('\n');

  const message = isEditing
    ? (draft ? `Update draft: ${title}` : `Update field note: ${title}`)
    : (draft ? `Save draft: ${title}` : `Publish field note: ${title}`);
  const payload = {
    message,
    content: Buffer.from(content, 'utf8').toString('base64'),
    branch: BRANCH
  };
  if (currentSha) payload.sha = currentSha;

  const saved = await githubRequest(`/contents/${encodedPath}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!saved.ok) {
    const detail = await saved.text().catch(() => '');
    return res.status(502).json({ error: 'GitHub save failed.', detail: detail.slice(0, 500) });
  }

  const result = await saved.json();
  return res.status(200).json({
    ok: true,
    draft,
    editing: isEditing,
    slug,
    filePath,
    commitSha: result.commit?.sha || null,
    url: draft ? null : `https://www.masahiroiwamatsu.com/notes/${slug}/`
  });
}
