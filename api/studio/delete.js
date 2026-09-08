import { requireStudioAuth } from '../../lib/studio-auth.js';

const REPO = 'strobofactory/masahiroiwamatsu';
const BRANCH = 'main';
const NOTES_DIR = 'src/content/notes';
const LANGS = ['', 'en', 'es', 'zh', 'ko'];

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

async function githubJson(path, options = {}) {
  const response = await githubRequest(path, options);
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const error = new Error(`GitHub API failed (${response.status}).`);
    error.status = response.status;
    error.detail = detail.slice(0, 600);
    throw error;
  }
  return response.json();
}

function safeSlug(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 100);
}

function candidatePaths(slug) {
  const paths = [];
  for (const lang of LANGS) {
    const suffix = lang ? `.${lang}` : '';
    paths.push(`${NOTES_DIR}/${slug}${suffix}.md`);
    paths.push(`${NOTES_DIR}/${slug}${suffix}.mdx`);
  }
  return paths;
}

async function exists(path) {
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  const response = await githubRequest(`/contents/${encoded}?ref=${encodeURIComponent(BRANCH)}`);
  if (response.status === 404) return false;
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const error = new Error(`Could not inspect ${path}.`);
    error.detail = detail.slice(0, 400);
    throw error;
  }
  return true;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  if (!requireStudioAuth(req, res)) return;

  const slug = safeSlug(req.body?.slug);
  if (!slug) return res.status(400).json({ error: 'Invalid slug.' });

  try {
    const candidates = candidatePaths(slug);
    const found = [];
    for (const path of candidates) {
      if (await exists(path)) found.push(path);
    }
    if (!found.length) return res.status(404).json({ error: '記事ファイルが見つかりません。一覧を更新してください。' });

    const ref = await githubJson(`/git/ref/heads/${encodeURIComponent(BRANCH)}`);
    const parentSha = ref.object?.sha;
    if (!parentSha) throw new Error('Could not resolve the current GitHub branch head.');
    const parentCommit = await githubJson(`/git/commits/${encodeURIComponent(parentSha)}`);
    const baseTree = parentCommit.tree?.sha;
    if (!baseTree) throw new Error('Could not resolve the current GitHub tree.');

    const tree = await githubJson('/git/trees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base_tree: baseTree,
        tree: found.map((path) => ({ path, mode: '100644', type: 'blob', sha: null }))
      })
    });

    const commit = await githubJson('/git/commits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Delete field note: ${slug}`,
        tree: tree.sha,
        parents: [parentSha]
      })
    });

    await githubJson(`/git/refs/heads/${encodeURIComponent(BRANCH)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sha: commit.sha, force: false })
    });

    return res.status(200).json({
      ok: true,
      slug,
      deletedPaths: found,
      commitSha: commit.sha,
      mediaDeleted: false,
      note: 'Bunny Storage / Stream assets are intentionally kept to avoid accidental media loss.'
    });
  } catch (error) {
    return res.status(error?.status || 500).json({
      error: error instanceof Error ? error.message : 'Unexpected error.',
      detail: error?.detail || undefined
    });
  }
}
