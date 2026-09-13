import test from 'node:test';
import assert from 'node:assert/strict';
import { serializeArticle } from '../lib/mcp/article-format.js';
import { GitHubArticleStore } from '../lib/mcp/github-articles.js';
import { githubFixture } from './helpers/github-fixture.js';

const config = {
  repository: 'strobofactory/masahiroiwamatsu', notesDir: 'src/content/notes', branch: 'main',
  siteBaseUrl: 'https://www.masahiroiwamatsu.com', githubToken: 'test-token'
};

const draftInput = {
  slug: 'mcp-test-draft', title: 'MCPテスト', description: '公開しないダミー原稿',
  body: '本文をそのまま保存します。\n', tags: ['Test'], pubDate: '2026-09-13'
};

function articleContent({ draft = true, title = '記事', caption = 'caption' } = {}) {
  return serializeArticle({
    title, description: '概要', pubDate: '2026-09-13', updatedDate: '', tags: ['Test'],
    draft, lang: 'ja', translationKey: 'existing-draft', body: '本文\n', image: '',
    imageAlt: '', imageCaption: caption
  }, 'existing-draft');
}

test('create_draft writes one Japanese .md, verifies it, and retries without a second commit', async () => {
  const fixture = githubFixture();
  const store = new GitHubArticleStore(config, fixture);
  const first = await store.createDraft(draftInput);
  assert.equal(first.draft, true);
  assert.equal(first.githubSaveStatus, 'confirmed');
  assert.equal(first.publishedUrl, null);
  assert.equal(fixture.commits.length, 1);
  assert.deepEqual([...fixture.files.keys()], ['src/content/notes/mcp-test-draft.md']);

  const replay = await store.createDraft(draftInput);
  assert.equal(replay.replayed, true);
  assert.equal(replay.commitSha, null);
  assert.equal(fixture.commits.length, 1);

  await assert.rejects(() => store.createDraft({ ...draftInput, title: '別の内容' }), { code: 'ARTICLE_ALREADY_EXISTS' });
});

test('update_draft requires current version, preserves omissions, and distinguishes empty string', async () => {
  const path = 'src/content/notes/existing-draft.md';
  const fixture = githubFixture({ [path]: articleContent() });
  const store = new GitHubArticleStore(config, fixture);
  const before = await store.getArticle('existing-draft');

  const saved = await store.updateDraft({ slug: 'existing-draft', version: before.version, body: '更新本文\n', imageCaption: '' });
  assert.equal(saved.draft, true);
  const after = await store.getArticle('existing-draft');
  assert.equal(after.title, '記事');
  assert.equal(after.body, '更新本文\n');
  assert.equal(after.imageCaption, null);

  const replay = await store.updateDraft({ slug: 'existing-draft', version: before.version, body: '更新本文\n', imageCaption: '' });
  assert.equal(replay.replayed, true);
  assert.equal(fixture.commits.length, 1);

  await assert.rejects(() => store.updateDraft({ slug: 'existing-draft', version: before.version, title: '競合' }), { code: 'VERSION_CONFLICT' });

  fixture.files.set(path, articleContent({ draft: false }));
  await assert.rejects(() => store.updateDraft({ slug: 'existing-draft', version: after.version, title: '公開後の上書き' }), { code: 'PUBLISHED_ARTICLE_FORBIDDEN' });
});

test('update_draft refuses published, missing, and MDX articles', async () => {
  const fixture = githubFixture({
    'src/content/notes/existing-draft.md': articleContent({ draft: false }),
    'src/content/notes/mdx-note.mdx': articleContent().replaceAll('existing-draft', 'mdx-note')
  });
  const store = new GitHubArticleStore(config, fixture);
  const published = await store.getArticle('existing-draft');
  await assert.rejects(() => store.updateDraft({ slug: 'existing-draft', version: published.version, title: 'no' }), { code: 'PUBLISHED_ARTICLE_FORBIDDEN' });
  await assert.rejects(() => store.updateDraft({ slug: 'missing', version: 'a'.repeat(40), title: 'no' }), { code: 'ARTICLE_NOT_FOUND' });
  const mdx = await store.getArticle('mdx-note');
  await assert.rejects(() => store.updateDraft({ slug: 'mdx-note', version: mdx.version, title: 'no' }), { code: 'UNSUPPORTED_ARTICLE_FORMAT' });
});

test('list_articles filters, omits bodies, and pages with a stable cursor', async () => {
  const fixture = githubFixture({
    'src/content/notes/existing-draft.md': articleContent({ title: 'Alpha' }),
    'src/content/notes/published.md': articleContent({ draft: false, title: 'Beta' }).replaceAll('existing-draft', 'published'),
    'src/content/notes/existing-draft.en.md': articleContent({ title: 'Translation' })
  });
  const store = new GitHubArticleStore(config, fixture);
  const first = await store.listArticles({ status: 'all', limit: 1 });
  assert.equal(first.count, 1);
  assert.ok(first.nextCursor);
  assert.equal('body' in first.articles[0], false);
  const second = await store.listArticles({ status: 'all', limit: 1, cursor: first.nextCursor });
  assert.equal(second.count, 1);
  assert.notEqual(first.articles[0].slug, second.articles[0].slug);
  const published = await store.listArticles({ status: 'published', query: 'beta' });
  assert.equal(published.total, 1);
  assert.equal(published.articles[0].status, 'published');
});
