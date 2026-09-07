import { getVercelOidcToken } from '@vercel/oidc';
import { requireStudioAuth } from '../../lib/studio-auth.js';

export const config = { maxDuration: 60 };

const REPO = 'strobofactory/masahiroiwamatsu';
const BRANCH = 'main';
const LOCALIZED_LANGS = ['en', 'es', 'zh', 'ko'];
const LANGUAGE_NAMES = {
  en: 'English',
  es: 'Spanish',
  zh: 'Simplified Chinese',
  ko: 'Korean'
};

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

async function githubJson(path, options = {}) {
  const response = await githubRequest(path, options);
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const error = new Error(`GitHub API failed (${response.status}).`);
    error.detail = detail.slice(0, 600);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

async function readRepoFile(path) {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const response = await githubRequest(`/contents/${encodedPath}?ref=${encodeURIComponent(BRANCH)}`);
  if (response.status === 404) return null;
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const error = new Error(`Could not read ${path} from GitHub.`);
    error.detail = detail.slice(0, 500);
    throw error;
  }
  const json = await response.json();
  return Buffer.from(json.content || '', 'base64').toString('utf8');
}

function setDraftFlag(content, draft) {
  const next = String(content || '');
  if (/^draft:\s*(true|false)\s*$/m.test(next)) {
    return next.replace(/^draft:\s*(true|false)\s*$/m, `draft: ${draft ? 'true' : 'false'}`);
  }
  return next.replace(/^---\n/, `---\ndraft: ${draft ? 'true' : 'false'}\n`);
}

function buildJapaneseContent({ title, description, body, pubDate, updatedDate, tags, draft, slug, image, imageAlt, imageCaption }) {
  const lines = [
    '---',
    `title: ${yamlString(title)}`,
    `description: ${yamlString(description)}`,
    `pubDate: ${pubDate}`
  ];
  if (updatedDate) lines.push(`updatedDate: ${updatedDate}`);
  lines.push(
    `tags: ${yamlArray(tags)}`,
    `draft: ${draft ? 'true' : 'false'}`,
    'lang: "ja"',
    `translationKey: ${yamlString(slug)}`
  );
  if (image) lines.push(`image: ${yamlString(image)}`);
  if (imageAlt) lines.push(`imageAlt: ${yamlString(imageAlt)}`);
  if (imageCaption) lines.push(`imageCaption: ${yamlString(imageCaption)}`);
  lines.push('---', '', body, '');
  return lines.join('\n');
}

function buildLocalizedContent({ lang, translated, pubDate, updatedDate, tags, slug, image }) {
  const lines = [
    '---',
    `title: ${yamlString(translated.title)}`,
    `description: ${yamlString(translated.description)}`,
    `pubDate: ${pubDate}`
  ];
  if (updatedDate) lines.push(`updatedDate: ${updatedDate}`);
  lines.push(
    `tags: ${yamlArray(tags)}`,
    'draft: false',
    `lang: ${yamlString(lang)}`,
    `translationKey: ${yamlString(slug)}`
  );
  if (image) lines.push(`image: ${yamlString(image)}`);
  if (image && translated.imageAlt) lines.push(`imageAlt: ${yamlString(translated.imageAlt)}`);
  if (translated.imageCaption) lines.push(`imageCaption: ${yamlString(translated.imageCaption)}`);
  lines.push('---', '', translated.body, '');
  return lines.join('\n');
}

const translationLeafSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    body: { type: 'string' },
    imageAlt: { type: 'string' },
    imageCaption: { type: 'string' }
  },
  required: ['title', 'description', 'body', 'imageAlt', 'imageCaption']
};

const translationSchema = {
  type: 'object',
  additionalProperties: false,
  properties: Object.fromEntries(LOCALIZED_LANGS.map((lang) => [lang, translationLeafSchema])),
  required: LOCALIZED_LANGS
};

async function gatewayToken() {
  if (process.env.AI_GATEWAY_API_KEY) return process.env.AI_GATEWAY_API_KEY;
  if (process.env.VERCEL_OIDC_TOKEN) return process.env.VERCEL_OIDC_TOKEN;
  try {
    return (await getVercelOidcToken()) || '';
  } catch {
    return '';
  }
}

async function translateWithClaude({ title, description, body, imageAlt, imageCaption }) {
  const token = await gatewayToken();
  if (!token) {
    const error = new Error('Claude translation is not configured. Vercel OIDC could not be obtained; set AI_GATEWAY_API_KEY as a fallback.');
    error.status = 503;
    throw error;
  }

  const source = { title, description, body, imageAlt, imageCaption };
  const targetList = LOCALIZED_LANGS.map((lang) => `${lang}: ${LANGUAGE_NAMES[lang]}`).join('\n');
  const prompt = `Translate this Japanese NOMAD FIELD article into four languages.\n\nTargets:\n${targetList}\n\nRules:\n- Translate faithfully. Do not summarize, add, remove, or reorder ideas.\n- Preserve Markdown structure exactly as much as possible, including headings, bold, lists, links, raw HTML, iframes, code blocks, URLs, file paths, and media embed markup.\n- Never translate or alter URLs.\n- Keep these brand names unchanged: NOMAD FIELD, STROBOFACTORY, HAPIVERI, NEXT ACADEMY, HAPIVERI Healthcare.ai.\n- Keep technical product names and model names unchanged unless a standard localized form is clearly established.\n- Render 岩松正浩 as Masahiro Iwamatsu in English and Spanish, 岩松正浩 in Simplified Chinese, and 이와마츠 마사히로 in Korean when it appears in prose.\n- imageAlt and imageCaption must be translated naturally; if the source value is empty, return an empty string.\n- Return only the structured result required by the schema.\n\nSource JSON:\n${JSON.stringify(source)}`;

  const response = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-5',
      messages: [
        { role: 'system', content: 'You are a professional multilingual editor. Preserve factual meaning, Markdown, URLs, embeds, and brand names exactly while translating natural-language text.' },
        { role: 'user', content: prompt }
      ],
      stream: false,
      temperature: 0.15,
      max_tokens: 16000,
      response_format: {
        type: 'json',
        name: 'nomad_field_translations',
        description: 'Four faithful translations of one NOMAD FIELD article.',
        schema: translationSchema
      }
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const error = new Error('Claude translation failed via Vercel AI Gateway.');
    error.status = 502;
    error.detail = detail.slice(0, 900);
    throw error;
  }

  const json = await response.json();
  let content = json?.choices?.[0]?.message?.content;
  if (Array.isArray(content)) content = content.map((part) => part?.text || '').join('');
  if (typeof content !== 'string' || !content.trim()) {
    const error = new Error('Claude returned an empty translation result.');
    error.status = 502;
    throw error;
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    const error = new Error('Claude returned invalid structured translation data.');
    error.status = 502;
    error.detail = content.slice(0, 900);
    throw error;
  }

  for (const lang of LOCALIZED_LANGS) {
    const item = parsed?.[lang];
    if (!item || typeof item.title !== 'string' || typeof item.description !== 'string' || typeof item.body !== 'string') {
      const error = new Error(`Claude translation result is missing ${lang}.`);
      error.status = 502;
      throw error;
    }
    item.imageAlt = typeof item.imageAlt === 'string' ? item.imageAlt : '';
    item.imageCaption = typeof item.imageCaption === 'string' ? item.imageCaption : '';
  }
  return parsed;
}

async function createBlob(content) {
  const blob = await githubJson('/git/blobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, encoding: 'utf-8' })
  });
  return blob.sha;
}

async function commitFiles(files, message) {
  const ref = await githubJson(`/git/ref/heads/${encodeURIComponent(BRANCH)}`);
  const parentSha = ref.object?.sha;
  if (!parentSha) throw new Error('Could not resolve the current GitHub branch head.');
  const parentCommit = await githubJson(`/git/commits/${encodeURIComponent(parentSha)}`);
  const baseTree = parentCommit.tree?.sha;
  if (!baseTree) throw new Error('Could not resolve the current GitHub tree.');

  const treeEntries = [];
  for (const file of files) {
    const sha = await createBlob(file.content);
    treeEntries.push({ path: file.path, mode: '100644', type: 'blob', sha });
  }

  const tree = await githubJson('/git/trees', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base_tree: baseTree, tree: treeEntries })
  });
  const commit = await githubJson('/git/commits', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, tree: tree.sha, parents: [parentSha] })
  });
  await githubJson(`/git/refs/heads/${encodeURIComponent(BRANCH)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sha: commit.sha, force: false })
  });
  return commit.sha;
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

  const today = new Date().toISOString().slice(0, 10);
  const pubDate = String(req.body?.pubDate || today).slice(0, 10);
  const japanesePath = `src/content/notes/${slug}.md`;

  try {
    const existingJapanese = await readRepoFile(japanesePath);
    if (!originalSlug && existingJapanese) return res.status(409).json({ error: '同じslugの記事がすでに存在します。別のslugを指定してください。' });
    if (originalSlug && !existingJapanese) return res.status(404).json({ error: '編集対象の記事がGitHubに見つかりません。記事一覧を再読み込みしてください。' });

    const isEditing = Boolean(originalSlug && existingJapanese);
    const updatedDate = isEditing ? today : '';
    const files = [{
      path: japanesePath,
      content: buildJapaneseContent({ title, description, body, pubDate, updatedDate, tags, draft, slug, image, imageAlt, imageCaption })
    }];

    let translatedLanguages = [];
    let translationModel = null;

    if (draft) {
      for (const lang of LOCALIZED_LANGS) {
        const path = `src/content/notes/${slug}.${lang}.md`;
        const existing = await readRepoFile(path);
        if (existing) files.push({ path, content: setDraftFlag(existing, true) });
      }
    } else {
      const translations = await translateWithClaude({ title, description, body, imageAlt, imageCaption });
      for (const lang of LOCALIZED_LANGS) {
        files.push({
          path: `src/content/notes/${slug}.${lang}.md`,
          content: buildLocalizedContent({ lang, translated: translations[lang], pubDate, updatedDate, tags, slug, image })
        });
      }
      translatedLanguages = [...LOCALIZED_LANGS];
      translationModel = 'anthropic/claude-sonnet-5';
    }

    const message = draft
      ? (isEditing ? `Update draft: ${title}` : `Save draft: ${title}`)
      : (isEditing ? `Update multilingual field note: ${title}` : `Publish multilingual field note: ${title}`);
    const commitSha = await commitFiles(files, message);

    return res.status(200).json({
      ok: true,
      draft,
      editing: isEditing,
      slug,
      filePath: japanesePath,
      commitSha,
      translatedLanguages,
      translationModel,
      url: draft ? null : `https://www.masahiroiwamatsu.com/notes/${slug}/`,
      localizedUrls: draft ? {} : Object.fromEntries(LOCALIZED_LANGS.map((lang) => [lang, `https://www.masahiroiwamatsu.com/${lang}/notes/${slug}/`]))
    });
  } catch (error) {
    const status = Number(error?.status) || 500;
    return res.status(status >= 400 && status < 600 ? status : 500).json({
      error: error instanceof Error ? error.message : 'Unexpected publishing error.',
      detail: String(error?.detail || '').slice(0, 900)
    });
  }
}
