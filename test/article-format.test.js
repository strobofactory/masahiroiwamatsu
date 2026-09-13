import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArticle, serializeArticle, validateSlug } from '../lib/mcp/article-format.js';

test('article format preserves Markdown and emits a forced draft', () => {
  const body = '# 見出し\n\n[リンク](https://example.com/?a=1&b=2)\n';
  const content = serializeArticle({
    title: 'テスト記事', description: '概要', pubDate: '2026-09-13', updatedDate: '',
    tags: ['AI'], draft: true, lang: 'ja', translationKey: 'test-note',
    image: '', imageAlt: '', imageCaption: '', body
  }, 'test-note');
  const article = parseArticle(content, 'test-note');
  assert.equal(article.body, body);
  assert.equal(article.draft, true);
  assert.equal(article.translationKey, 'test-note');
  assert.equal(article.frontmatterSlug, '');
});

test('unsafe slugs and images without alt text are rejected', () => {
  assert.throws(() => validateSlug('../secret'), { code: 'INVALID_INPUT' });
  assert.throws(() => serializeArticle({
    title: 'x', description: 'y', pubDate: '2026-09-13', tags: [], draft: true,
    lang: 'ja', translationKey: 'safe', body: 'body', image: 'https://example.com/a.jpg',
    imageAlt: '', imageCaption: ''
  }, 'safe'), { code: 'INVALID_INPUT' });
});

test('unsupported frontmatter is not silently rewritten', () => {
  const content = '---\ntitle: "x"\ndescription: "y"\npubDate: 2026-09-13\ntags: []\ndraft: true\nsecretField: true\n---\n\nbody\n';
  assert.throws(() => parseArticle(content, 'test'), { code: 'UNSUPPORTED_ARTICLE_FORMAT' });
});
