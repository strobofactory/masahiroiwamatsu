import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyAccessToken, authChallenge } from '../lib/mcp/auth.js';
import { getMcpConfig } from '../lib/mcp/config.js';

const config = {
  issuer: 'https://tenant.example/',
  resourceUrl: 'https://www.masahiroiwamatsu.com/api/mcp',
  metadataUrl: 'https://www.masahiroiwamatsu.com/.well-known/oauth-protected-resource',
  jwksUrl: 'https://tenant.example/.well-known/jwks.json',
  oauthClientId: 'claude-client',
  ownerSubject: 'auth0|owner',
  scopes: ['articles:read', 'drafts:write']
};

function req(token = 'token') {
  return { headers: token ? { authorization: `Bearer ${token}` } : {} };
}

test('access token validation binds issuer, audience, RS256, owner and scopes', async () => {
  let options;
  const result = await verifyAccessToken(req(), config, {
    verifyJwt: async (_token, _jwks, supplied) => {
      options = supplied;
      return { payload: { azp: 'claude-client', sub: 'auth0|owner', scope: 'articles:read drafts:write' } };
    }
  });
  assert.equal(options.issuer, config.issuer);
  assert.equal(options.audience, config.resourceUrl);
  assert.deepEqual(options.algorithms, ['RS256']);
  assert.equal(result.subject, 'auth0|owner');
  assert.notEqual(result.subjectHash, result.subject);
});

test('auth and configuration fail closed for missing credentials, wrong identities, scopes, and Preview main', async () => {
  await assert.rejects(() => verifyAccessToken(req(''), config), { code: 'AUTH_REQUIRED', status: 401 });
  await assert.rejects(() => verifyAccessToken(req(), config, {
    verifyJwt: async () => ({ payload: { azp: 'other-client', sub: 'auth0|owner', scope: 'articles:read drafts:write' } })
  }), { code: 'CLIENT_REQUIRED', status: 403 });
  await assert.rejects(() => verifyAccessToken(req(), config, {
    verifyJwt: async () => ({ payload: { azp: 'claude-client', sub: 'auth0|other', scope: 'articles:read drafts:write' } })
  }), { code: 'OWNER_REQUIRED', status: 403 });
  await assert.rejects(() => verifyAccessToken(req(), config, {
    verifyJwt: async () => ({ payload: { azp: 'claude-client', sub: 'auth0|owner', scope: 'articles:read' } })
  }), { code: 'INSUFFICIENT_SCOPE', status: 403 });

  const completeEnv = {
    NODE_ENV: 'test', GITHUB_TOKEN: 'token', MCP_OWNER_SUB: 'auth0|owner',
    MCP_OAUTH_CLIENT_ID: 'claude-client', MCP_OAUTH_ISSUER: 'http://127.0.0.1/auth/',
    MCP_OAUTH_JWKS_URL: 'http://127.0.0.1/auth/jwks',
    MCP_RESOURCE_URL: 'http://127.0.0.1/api/mcp', MCP_SITE_BASE_URL: 'http://127.0.0.1',
    MCP_GITHUB_BRANCH: 'main'
  };
  assert.throws(() => getMcpConfig({ ...completeEnv, GITHUB_TOKEN: '' }), { code: 'MCP_NOT_CONFIGURED', status: 503 });
  assert.throws(() => getMcpConfig({ ...completeEnv, VERCEL_ENV: 'preview' }), { code: 'MCP_NOT_CONFIGURED', status: 503 });
  assert.throws(() => getMcpConfig({
    ...completeEnv,
    MCP_GITHUB_BRANCH: 'codex/nomad-field-mcp-drafts',
    MCP_SITE_BASE_URL: 'https://www.masahiroiwamatsu.com'
  }), { code: 'MCP_NOT_CONFIGURED', status: 503 });
});

test('OAuth challenge points Claude to protected resource metadata', () => {
  assert.equal(
    authChallenge(config),
    'Bearer resource_metadata="https://www.masahiroiwamatsu.com/.well-known/oauth-protected-resource", scope="articles:read drafts:write", error="invalid_token"'
  );
});
