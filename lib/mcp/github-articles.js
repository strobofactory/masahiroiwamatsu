import { Buffer } from 'node:buffer';
import { cursorFingerprint, parseArticle, serializeArticle, todayUtc, validateSlug } from './article-format.js';
import { editorUrl } from './config.js';
import { McpAppError } from './errors.js';

const API_ROOT = 'https://api.github.com';
const TRANSLATION_PATTERN = /\.(?:en|es|zh|ko)\.mdx?$/i;
const ARTICLE_PATTERN = /\.mdx?$/i;

function encodedPath(path) {
  return path.split('/').map(encodeURIComponent).join('/');
}

function decodeContent(value) {
  return Buffer.from(String(value || '').replace(/\s/g, ''), 'base64').toString('utf8');
}

function encodeContent(value) {
  return Buffer.from(value, 'utf8').toString('base64');
}

function apiError(status, detail = '') {
  if ([409, 422].includes(status)) {
    return new McpAppError('保存直前に記事が変更されました。get_articleで再取得してください。', {
      code: 'VERSION_CONFLICT', status: 409
    });
  }
  return new McpAppError(`GitHub API request failed (${status}).`, {
    code: 'GITHUB_ERROR', status: 502,
    details: detail ? { upstreamStatus: status } : undefined
  });
}

function pick(object, key, fallback) {
  return Object.hasOwn(object, key) ? object[key] : fallback;
}

export class GitHubArticleStore {
  constructor(config, { fetchImpl = fetch } = {}) {
    this.config = config;
    this.fetch = fetchImpl;
  }

  async request(path, options = {}) {
    const response = await this.fetch(`${API_ROOT}/repos/${this.config.repository}${path}`, {
      ...options,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${this.config.githubToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'nomad-field-mcp',
        ...(options.headers || {})
      }
    });
    return response;
  }

  async json(path, options = {}) {
    const response = await this.request(path, options);
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw apiError(response.status, detail);
    }
    return response.json();
  }

  articlePath(slug, extension = 'md') {
    return `${this.config.notesDir}/${validateSlug(slug)}.${extension}`;
  }

  async branchHead() {
    const ref = await this.json(`/git/ref/heads/${encodedPath(this.config.branch)}`);
    if (!ref.object?.sha) throw new McpAppError('GitHub branch head is missing.', { code: 'GITHUB_ERROR', status: 502 });
    return ref.object.sha;
  }

  async readPath(path) {
    const response = await this.request(`/contents/${encodedPath(path)}?ref=${encodeURIComponent(this.config.branch)}`);
    if (response.status === 404) return null;
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw apiError(response.status, detail);
    }
    const json = await response.json();
    return {
      path,
      sha: String(json.sha || ''),
      content: decodeContent(json.content)
    };
  }

  async getFile(slug) {
    const safeSlug = validateSlug(slug);
    const markdown = await this.readPath(this.articlePath(safeSlug, 'md'));
    const mdx = await this.readPath(this.articlePath(safeSlug, 'mdx'));
    if (markdown && mdx) {
      throw new McpAppError('同じslugの.mdと.mdxが存在するため安全に特定できません。', {
        code: 'AMBIGUOUS_ARTICLE', status: 409
      });
    }
    return markdown || mdx;
  }

  async getArticle(slug) {
    const file = await this.getFile(slug);
    if (!file) throw new McpAppError('記事が見つかりません。', { code: 'ARTICLE_NOT_FOUND', status: 404 });
    const safeSlug = validateSlug(slug);
    const article = parseArticle(file.content, safeSlug);
    return this.presentArticle(article, file.sha, file.path);
  }

  presentArticle(article, version, filePath) {
    const slug = filePath.split('/').pop().replace(ARTICLE_PATTERN, '');
    return {
      slug,
      title: article.title,
      description: article.description,
      body: article.body,
      tags: article.tags,
      pubDate: article.pubDate,
      updatedDate: article.updatedDate || null,
      draft: article.draft,
      status: article.draft ? 'draft' : 'published',
      image: article.image || null,
      imageAlt: article.imageAlt || null,
      imageCaption: article.imageCaption || null,
      version,
      filePath,
      editorUrl: editorUrl(this.config, slug)
    };
  }

  async listFiles() {
    const response = await this.request(`/contents/${encodedPath(this.config.notesDir)}?ref=${encodeURIComponent(this.config.branch)}`);
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw apiError(response.status, detail);
    }
    const files = await response.json();
    if (!Array.isArray(files)) throw new McpAppError('Article directory response is invalid.', { code: 'GITHUB_ERROR', status: 502 });
    return files.filter((file) =>
      file?.type === 'file' && ARTICLE_PATTERN.test(file.name) && !TRANSLATION_PATTERN.test(file.name)
    );
  }

  async listArticles({ status = 'all', query = '', limit = 20, cursor = '' } = {}) {
    const normalizedStatus = ['all', 'draft', 'published'].includes(status) ? status : 'all';
    const normalizedQuery = String(query || '').trim().toLocaleLowerCase('ja');
    const pageSize = Math.min(50, Math.max(1, Number(limit) || 20));
    const headSha = await this.branchHead();
    const filterFingerprint = cursorFingerprint({ status: normalizedStatus, query: normalizedQuery, limit: pageSize });
    let offset = 0;
    if (cursor) {
      let parsed;
      try { parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')); } catch {}
      if (!parsed || parsed.headSha !== headSha || parsed.filterFingerprint !== filterFingerprint || !Number.isSafeInteger(parsed.offset) || parsed.offset < 0) {
        throw new McpAppError('ページング条件または記事一覧が変わりました。cursorなしで再取得してください。', {
          code: 'INVALID_CURSOR', status: 409
        });
      }
      offset = parsed.offset;
    }

    const files = await this.listFiles();
    const articles = await Promise.all(files.map(async (file) => {
      const slug = file.name.replace(ARTICLE_PATTERN, '');
      const fetched = await this.readPath(file.path);
      if (!fetched) return null;
      const article = parseArticle(fetched.content, slug);
      return this.presentArticle(article, fetched.sha, fetched.path);
    }));

    const filtered = articles.filter(Boolean).filter((article) => {
      if (normalizedStatus === 'draft' && !article.draft) return false;
      if (normalizedStatus === 'published' && article.draft) return false;
      if (!normalizedQuery) return true;
      return [article.slug, article.title, article.description, ...article.tags]
        .some((value) => String(value).toLocaleLowerCase('ja').includes(normalizedQuery));
    });
    filtered.sort((a, b) => b.pubDate.localeCompare(a.pubDate) || a.title.localeCompare(b.title, 'ja'));
    const page = filtered.slice(offset, offset + pageSize);
    const nextOffset = offset + page.length;
    const nextCursor = nextOffset < filtered.length
      ? Buffer.from(JSON.stringify({ offset: nextOffset, headSha, filterFingerprint })).toString('base64url')
      : null;

    return {
      ok: true,
      branch: this.config.branch,
      total: filtered.length,
      count: page.length,
      nextCursor,
      articles: page.map(({ body, filePath, ...article }) => article)
    };
  }

  async write(path, content, { sha, message }) {
    const body = {
      message,
      content: encodeContent(content),
      branch: this.config.branch,
      ...(sha ? { sha } : {})
    };
    const response = await this.request(`/contents/${encodedPath(path)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw apiError(response.status, detail);
    }
    return response.json();
  }

  async createDraft(input) {
    const slug = validateSlug(input.slug);
    const path = this.articlePath(slug, 'md');
    const article = {
      title: input.title,
      description: input.description,
      body: input.body,
      tags: input.tags,
      pubDate: input.pubDate || todayUtc(),
      updatedDate: '',
      draft: true,
      lang: 'ja',
      frontmatterSlug: '',
      translationKey: slug,
      image: input.image || '',
      imageAlt: input.imageAlt || '',
      imageCaption: input.imageCaption || ''
    };
    const content = serializeArticle(article, slug);
    const existing = await this.getFile(slug);
    if (existing) {
      if (existing.path.endsWith('.md') && existing.content === content) {
        return this.saveResult(slug, parseArticle(existing.content, slug), existing.sha, null, true);
      }
      throw new McpAppError('同じslugの記事がすでに存在します。上書きしていません。', {
        code: 'ARTICLE_ALREADY_EXISTS', status: 409
      });
    }

    const saved = await this.write(path, content, { message: `MCP create draft: ${article.title}` });
    return this.verifySave(slug, content, saved.commit?.sha || null, false);
  }

  async updateDraft(input) {
    const slug = validateSlug(input.slug);
    const file = await this.getFile(slug);
    if (!file) {
      throw new McpAppError('更新対象の記事が見つかりません。新規作成には変換していません。', {
        code: 'ARTICLE_NOT_FOUND', status: 404
      });
    }
    if (!file.path.endsWith('.md')) {
      throw new McpAppError('MCPで更新できるのは日本語Markdown（.md）だけです。変更していません。', {
        code: 'UNSUPPORTED_ARTICLE_FORMAT', status: 409
      });
    }
    const current = parseArticle(file.content, slug);
    if (!current.draft) {
      throw new McpAppError('公開済み記事はMCPから更新できません。変更していません。', {
        code: 'PUBLISHED_ARTICLE_FORBIDDEN', status: 403
      });
    }
    if ((current.frontmatterSlug && current.frontmatterSlug !== slug) || current.translationKey !== slug) {
      throw new McpAppError('この記事はfilenameとslug metadataが一致しない未対応形式です。変更していません。', {
        code: 'UNSUPPORTED_ARTICLE_FORMAT', status: 409
      });
    }

    const next = {
      ...current,
      title: pick(input, 'title', current.title),
      description: pick(input, 'description', current.description),
      body: pick(input, 'body', current.body),
      tags: pick(input, 'tags', current.tags),
      pubDate: pick(input, 'pubDate', current.pubDate),
      updatedDate: pick(input, 'updatedDate', current.updatedDate),
      image: pick(input, 'image', current.image),
      imageAlt: pick(input, 'imageAlt', current.imageAlt),
      imageCaption: pick(input, 'imageCaption', current.imageCaption),
      draft: true,
      lang: 'ja',
      translationKey: slug
    };
    const content = serializeArticle(next, slug);
    if (file.sha !== input.version) {
      if (content === file.content) return this.saveResult(slug, current, file.sha, null, true);
      throw new McpAppError('記事のバージョンが変わりました。get_articleで再取得してください。', {
        code: 'VERSION_CONFLICT', status: 409,
        details: { currentVersion: file.sha }
      });
    }
    if (content === file.content) return this.saveResult(slug, current, file.sha, null, true);

    const saved = await this.write(file.path, content, {
      sha: input.version,
      message: `MCP update draft: ${next.title}`
    });
    return this.verifySave(slug, content, saved.commit?.sha || null, false);
  }

  async verifySave(slug, expectedContent, commitSha, replayed) {
    const readBack = await this.getFile(slug);
    if (!readBack || readBack.content !== expectedContent) {
      throw new McpAppError('GitHub保存後の読み戻し確認に失敗しました。成功として扱っていません。', {
        code: 'SAVE_VERIFICATION_FAILED', status: 502,
        details: commitSha ? { commitSha } : undefined
      });
    }
    return this.saveResult(slug, parseArticle(readBack.content, slug), readBack.sha, commitSha, replayed);
  }

  saveResult(slug, article, version, commitSha, replayed) {
    return {
      ok: true,
      saved: true,
      replayed,
      slug,
      title: article.title,
      draft: true,
      version,
      commitSha,
      branch: this.config.branch,
      repository: this.config.repository,
      repositoryVisibility: 'public',
      githubSaveStatus: commitSha ? 'confirmed' : 'already_confirmed',
      webDeploymentStatus: 'pending_or_not_checked',
      publishedUrl: null,
      editorUrl: editorUrl(this.config, slug),
      privacyWarning: 'draft: trueでも公開GitHubリポジトリ内の原稿は第三者が閲覧できます。'
    };
  }
}
