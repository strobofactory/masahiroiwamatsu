import { McpAppError } from './errors.js';

export const MCP_REPO = 'strobofactory/masahiroiwamatsu';
export const MCP_NOTES_DIR = 'src/content/notes';
export const MCP_SCOPES = ['articles:read', 'drafts:write'];
export const PRODUCTION_SITE_URL = 'https://www.masahiroiwamatsu.com';
export const PRODUCTION_RESOURCE_URL = `${PRODUCTION_SITE_URL}/api/mcp`;

function required(value, name) {
  const result = String(value || '').trim();
  if (!result) {
    throw new McpAppError(`${name} is not configured.`, {
      code: 'MCP_NOT_CONFIGURED',
      status: 503
    });
  }
  return result;
}

function httpsUrl(value, name, { allowHttpLocalhost = false } = {}) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new McpAppError(`${name} must be a valid URL.`, {
      code: 'MCP_NOT_CONFIGURED',
      status: 503
    });
  }
  const localHttp = allowHttpLocalhost && url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname);
  if (url.protocol !== 'https:' && !localHttp) {
    throw new McpAppError(`${name} must use HTTPS.`, {
      code: 'MCP_NOT_CONFIGURED',
      status: 503
    });
  }
  return url;
}

function withoutTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

export function getPublicMcpConfig(env = process.env) {
  const resourceUrl = withoutTrailingSlash(String(env.MCP_RESOURCE_URL || PRODUCTION_RESOURCE_URL).trim());
  const issuer = withoutTrailingSlash(required(env.MCP_OAUTH_ISSUER, 'MCP_OAUTH_ISSUER')) + '/';
  httpsUrl(resourceUrl, 'MCP_RESOURCE_URL', { allowHttpLocalhost: env.NODE_ENV === 'test' });
  httpsUrl(issuer, 'MCP_OAUTH_ISSUER', { allowHttpLocalhost: env.NODE_ENV === 'test' });
  return {
    resourceUrl,
    issuer,
    metadataUrl: `${new URL(resourceUrl).origin}/.well-known/oauth-protected-resource`,
    scopes: [...MCP_SCOPES]
  };
}

export function getMcpConfig(env = process.env) {
  const publicConfig = getPublicMcpConfig(env);
  const branch = String(env.MCP_GITHUB_BRANCH || 'main').trim();
  if (!/^[A-Za-z0-9._/-]{1,200}$/.test(branch) || branch.includes('..') || branch.startsWith('/') || branch.endsWith('/')) {
    throw new McpAppError('MCP_GITHUB_BRANCH is invalid.', {
      code: 'MCP_NOT_CONFIGURED',
      status: 503
    });
  }

  const defaultSite = branch === 'main' ? PRODUCTION_SITE_URL : '';
  const siteBaseUrl = withoutTrailingSlash(required(env.MCP_SITE_BASE_URL || defaultSite, 'MCP_SITE_BASE_URL'));
  const siteUrl = httpsUrl(siteBaseUrl, 'MCP_SITE_BASE_URL', { allowHttpLocalhost: env.NODE_ENV === 'test' });
  if (env.VERCEL_ENV === 'preview' && branch === 'main') {
    throw new McpAppError('A Vercel Preview deployment must not write to the main branch.', {
      code: 'MCP_NOT_CONFIGURED',
      status: 503
    });
  }
  if (branch !== 'main' && siteUrl.origin === PRODUCTION_SITE_URL) {
    throw new McpAppError('A non-main MCP branch must not use the production Studio URL.', {
      code: 'MCP_NOT_CONFIGURED',
      status: 503
    });
  }

  const jwksUrl = required(env.MCP_OAUTH_JWKS_URL, 'MCP_OAUTH_JWKS_URL');
  httpsUrl(jwksUrl, 'MCP_OAUTH_JWKS_URL', { allowHttpLocalhost: env.NODE_ENV === 'test' });

  return {
    ...publicConfig,
    repository: MCP_REPO,
    notesDir: MCP_NOTES_DIR,
    branch,
    siteBaseUrl,
    githubToken: required(env.GITHUB_TOKEN, 'GITHUB_TOKEN'),
    ownerSubject: required(env.MCP_OWNER_SUB, 'MCP_OWNER_SUB'),
    oauthClientId: required(env.MCP_OAUTH_CLIENT_ID, 'MCP_OAUTH_CLIENT_ID'),
    jwksUrl,
    rateLimitPerMinute: Math.min(300, Math.max(10, Number(env.MCP_RATE_LIMIT_PER_MINUTE || 60) || 60))
  };
}

export function editorUrl(config, slug) {
  return `${config.siteBaseUrl}/studio/editor/?slug=${encodeURIComponent(slug)}`;
}
