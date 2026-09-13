import crypto from 'node:crypto';
import { McpAppError } from './errors.js';

const MAX_TITLE = 200;
const MAX_DESCRIPTION = 1_000;
const MAX_BODY = 250_000;
const MAX_TAGS = 12;
const MAX_TAG = 80;
const MAX_IMAGE_URL = 2_048;
const MAX_IMAGE_TEXT = 1_000;

const KNOWN_KEYS = new Set([
  'title', 'description', 'pubDate', 'updatedDate', 'tags', 'draft',
  'image', 'imageAlt', 'imageCaption', 'lang', 'slug', 'translationKey'
]);

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/;

function invalid(message, details) {
  throw new McpAppError(message, { code: 'INVALID_INPUT', status: 400, details });
}

export function validateSlug(value) {
  const slug = String(value || '').trim();
  if (!SLUG_PATTERN.test(slug) || slug.includes('--')) {
    invalid('slugは小文字英数字と単一ハイフンのみ、1〜100文字で指定してください。');
  }
  return slug;
}

function validateDate(value, field, { optional = false } = {}) {
  const date = String(value ?? '').trim();
  if (!date && optional) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) invalid(`${field}はYYYY-MM-DD形式で指定してください。`);
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date) {
    invalid(`${field}に実在する日付を指定してください。`);
  }
  return date;
}

function validateText(value, field, max, { required = false, oneLine = false } = {}) {
  if (typeof value !== 'string') invalid(`${field}は文字列で指定してください。`);
  if (required && value.trim().length === 0) invalid(`${field}は必須です。`);
  if (value.length > max) invalid(`${field}は${max}文字以内で指定してください。`);
  if (value.includes('\0') || (oneLine && /[\r\n]/.test(value))) invalid(`${field}に使用できない文字が含まれています。`);
  return value;
}

function validateTags(value) {
  if (!Array.isArray(value)) invalid('tagsは文字列の配列で指定してください。');
  if (value.length > MAX_TAGS) invalid(`tagsは${MAX_TAGS}件以内で指定してください。`);
  const tags = value.map((tag) => validateText(tag, 'tag', MAX_TAG, { required: true, oneLine: true }).trim());
  if (new Set(tags).size !== tags.length) invalid('tagsに重複があります。');
  return tags;
}

function validateImage(value) {
  const image = validateText(value, 'image', MAX_IMAGE_URL).trim();
  if (!image) return '';
  if (image.startsWith('/')) {
    if (image.startsWith('//') || image.includes('..')) invalid('imageのサイト内パスが不正です。');
    return image;
  }
  let url;
  try { url = new URL(image); } catch { invalid('imageはHTTPS URLまたはサイト内の絶対パスで指定してください。'); }
  if (url.protocol !== 'https:' || url.username || url.password) {
    invalid('imageは認証情報を含まないHTTPS URLで指定してください。');
  }
  return image;
}

export function validateArticle(article) {
  const result = {
    title: validateText(article.title, 'title', MAX_TITLE, { required: true, oneLine: true }).trim(),
    description: validateText(article.description, 'description', MAX_DESCRIPTION, { required: true }).trim(),
    pubDate: validateDate(article.pubDate, 'pubDate'),
    updatedDate: validateDate(article.updatedDate || '', 'updatedDate', { optional: true }),
    tags: validateTags(article.tags),
    draft: article.draft === true,
    lang: article.lang || 'ja',
    frontmatterSlug: article.frontmatterSlug ? validateSlug(article.frontmatterSlug) : '',
    translationKey: validateSlug(article.translationKey || article.slug),
    body: validateText(article.body, 'body', MAX_BODY, { required: true }),
    image: validateImage(article.image || ''),
    imageAlt: validateText(article.imageAlt || '', 'imageAlt', MAX_IMAGE_TEXT).trim(),
    imageCaption: validateText(article.imageCaption || '', 'imageCaption', MAX_IMAGE_TEXT).trim()
  };
  if (result.lang !== 'ja') invalid('MCPで保存できるのは日本語記事だけです。');
  if (result.image && !result.imageAlt) invalid('imageを設定する場合はimageAltが必須です。');
  return result;
}

function parseJsonString(raw, field) {
  if (raw.startsWith('"')) {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed !== 'string') throw new Error();
      return parsed;
    } catch {
      throw new McpAppError(`${field}のFrontmatter形式に対応していません。`, {
        code: 'UNSUPPORTED_ARTICLE_FORMAT', status: 409
      });
    }
  }
  if (/^'.*'$/.test(raw)) return raw.slice(1, -1).replace(/''/g, "'");
  return raw;
}

export function parseArticle(content, slug) {
  const text = String(content || '').replace(/\r\n/g, '\n');
  const match = text.match(/^---\n([\s\S]*?)\n---(?:\n([\s\S]*))?$/);
  if (!match) {
    throw new McpAppError('この記事のFrontmatter形式には安全に対応できません。変更していません。', {
      code: 'UNSUPPORTED_ARTICLE_FORMAT', status: 409
    });
  }
  const meta = {};
  for (const line of match[1].split('\n')) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const field = line.match(/^([A-Za-z][A-Za-z0-9]*):(?:\s(.*))?$/);
    if (!field || !KNOWN_KEYS.has(field[1]) || Object.hasOwn(meta, field[1])) {
      throw new McpAppError('この記事には未対応または重複したFrontmatter項目があります。変更していません。', {
        code: 'UNSUPPORTED_ARTICLE_FORMAT', status: 409
      });
    }
    const [, key, rawValue = ''] = field;
    if (key === 'tags') {
      try {
        const parsed = JSON.parse(rawValue);
        if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string')) throw new Error();
        meta[key] = parsed;
      } catch {
        throw new McpAppError('tagsのFrontmatter形式に対応していません。変更していません。', {
          code: 'UNSUPPORTED_ARTICLE_FORMAT', status: 409
        });
      }
    } else if (key === 'draft') {
      if (!['true', 'false'].includes(rawValue)) {
        throw new McpAppError('draftのFrontmatter形式に対応していません。変更していません。', {
          code: 'UNSUPPORTED_ARTICLE_FORMAT', status: 409
        });
      }
      meta[key] = rawValue === 'true';
    } else {
      meta[key] = parseJsonString(rawValue, key);
    }
  }

  for (const key of ['title', 'description', 'pubDate', 'tags', 'draft']) {
    if (!Object.hasOwn(meta, key)) {
      throw new McpAppError(`必須Frontmatter項目 ${key} がありません。変更していません。`, {
        code: 'UNSUPPORTED_ARTICLE_FORMAT', status: 409
      });
    }
  }

  return validateArticle({
    ...meta,
    slug,
    frontmatterSlug: meta.slug || '',
    lang: meta.lang || 'ja',
    translationKey: meta.translationKey || meta.slug || slug,
    updatedDate: meta.updatedDate || '',
    image: meta.image || '',
    imageAlt: meta.imageAlt || '',
    imageCaption: meta.imageCaption || '',
    body: (match[2] ?? '').replace(/^\n/, '')
  });
}

function yamlString(value) {
  return JSON.stringify(String(value));
}

export function serializeArticle(input, slug) {
  const article = validateArticle({ ...input, slug, translationKey: input.translationKey || slug });
  const lines = [
    '---',
    `title: ${yamlString(article.title)}`,
    `description: ${yamlString(article.description)}`,
    `pubDate: ${article.pubDate}`
  ];
  if (article.updatedDate) lines.push(`updatedDate: ${article.updatedDate}`);
  lines.push(
    `tags: [${article.tags.map(yamlString).join(', ')}]`,
    `draft: ${article.draft ? 'true' : 'false'}`,
    'lang: "ja"'
  );
  if (article.frontmatterSlug) lines.push(`slug: ${yamlString(article.frontmatterSlug)}`);
  lines.push(`translationKey: ${yamlString(article.translationKey)}`);
  if (article.image) lines.push(`image: ${yamlString(article.image)}`);
  if (article.imageAlt) lines.push(`imageAlt: ${yamlString(article.imageAlt)}`);
  if (article.imageCaption) lines.push(`imageCaption: ${yamlString(article.imageCaption)}`);
  lines.push('---', '', article.body);
  if (!article.body.endsWith('\n')) lines.push('');
  return lines.join('\n');
}

export function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

export function cursorFingerprint(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
}
