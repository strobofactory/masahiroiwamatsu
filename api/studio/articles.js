import { requireStudioAuth } from '../../lib/studio-auth.js';

const REPO = 'strobofactory/masahiroiwamatsu';
const BRANCH = 'main';
const NOTES_DIR = 'src/content/notes';

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

function decodeValue(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return '';
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value.startsWith('[') || value.startsWith('"')) {
    try { return JSON.parse(value); } catch {}
  }
  return value.replace(/^['"]|['"]$/g, '');
}

function parseArticle(content, fallbackSlug = '') {
  const text = String(content || '').replace(/\r\n/g, '\n');
  const match = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const meta = {};
  let body = text;
  if (match) {
    body = match[2].replace(/^\n+/, '').replace(/\n+$/, '');
    for (const line of match[1].split('\n')) {
      const i = line.indexOf(':');
      if (i < 0) continue;
      meta[line.slice(0, i).trim()] = decodeValue(line.slice(i + 1));
    }
  }
  return {
    slug: fallbackSlug,
    title: String(meta.title || fallbackSlug),
    description: String(meta.description || ''),
    pubDate: String(meta.pubDate || ''),
    updatedDate: String(meta.updatedDate || ''),
    tags: Array.isArray(meta.tags) ? meta.tags.map(String) : [],
    draft: meta.draft === true,
    image: String(meta.image || ''),
    imageAlt: String(meta.imageAlt || ''),
    imageCaption: String(meta.imageCaption || ''),
    body
  };
}

async function fetchArticleFile(file) {
  const response = await githubRequest(`/contents/${file.path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(BRANCH)}`);
  if (!response.ok) throw new Error(`Could not read ${file.name}`);
  const json = await response.json();
  const content = Buffer.from(json.content || '', 'base64').toString('utf8');
  const slug = file.name.replace(/\.mdx?$/i, '');
  return { ...parseArticle(content, slug), sha: json.sha || null };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });
  if (!requireStudioAuth(req, res)) return;

  const slug = String(req.query?.slug || '').trim();
  try {
    if (slug) {
      const safeSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '');
      if (!safeSlug) return res.status(400).json({ error: 'Invalid slug.' });
      for (const ext of ['md', 'mdx']) {
        const path = `${NOTES_DIR}/${safeSlug}.${ext}`;
        const response = await githubRequest(`/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(BRANCH)}`);
        if (response.ok) {
          const json = await response.json();
          const content = Buffer.from(json.content || '', 'base64').toString('utf8');
          return res.status(200).json({ ok: true, article: { ...parseArticle(content, safeSlug), sha: json.sha || null } });
        }
        if (response.status !== 404) {
          const detail = await response.text().catch(() => '');
          return res.status(502).json({ error: 'Could not read article from GitHub.', detail: detail.slice(0, 400) });
        }
      }
      return res.status(404).json({ error: 'Article not found.' });
    }

    const directory = await githubRequest(`/contents/${NOTES_DIR.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(BRANCH)}`);
    if (!directory.ok) {
      const detail = await directory.text().catch(() => '');
      return res.status(502).json({ error: 'Could not list articles from GitHub.', detail: detail.slice(0, 400) });
    }
    const files = (await directory.json()).filter((file) => file.type === 'file' && /\.mdx?$/i.test(file.name) && !/\.(en|es|zh|ko)\.mdx?$/i.test(file.name));
    const articles = await Promise.all(files.map(fetchArticleFile));
    articles.sort((a, b) => String(b.pubDate).localeCompare(String(a.pubDate)) || a.title.localeCompare(b.title, 'ja'));
    return res.status(200).json({ ok: true, articles: articles.map(({ body, sha, ...item }) => item) });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unexpected error.' });
  }
}
