import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { verifyAccessToken, authChallenge } from '../lib/mcp/auth.js';
import { getMcpConfig } from '../lib/mcp/config.js';
import { publicError } from '../lib/mcp/errors.js';
import { GitHubArticleStore } from '../lib/mcp/github-articles.js';
import { takeRateLimit } from '../lib/mcp/rate-limit.js';
import { createNomadMcpServer } from '../lib/mcp/server.js';

export const config = { maxDuration: 60 };
const MAX_REQUEST_BYTES = 400_000;

function jsonRpcError(res, status, message) {
  return res.status(status).json({
    jsonrpc: '2.0',
    error: { code: -32000, message },
    id: null
  });
}

function requestSize(req) {
  const declared = Number(req.headers?.['content-length'] || 0);
  if (Number.isFinite(declared) && declared > 0) return declared;
  try { return Buffer.byteLength(JSON.stringify(req.body ?? null), 'utf8'); } catch { return MAX_REQUEST_BYTES + 1; }
}

function requestMatchesConfiguredResource(req, mcpConfig, env) {
  if (env.NODE_ENV === 'test') return true;
  const host = String(req.headers?.['x-forwarded-host'] || req.headers?.host || '').split(',')[0].trim();
  const protocol = String(req.headers?.['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const path = String(req.url || '/api/mcp').split('?')[0];
  if (!host) return false;
  return `${protocol}://${host}${path}` === mcpConfig.resourceUrl;
}

export function createMcpHandler({
  env = process.env,
  verify = verifyAccessToken,
  storeFactory = (mcpConfig) => new GitHubArticleStore(mcpConfig)
} = {}) {
  return async function mcpHandler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    let mcpConfig;
    try {
      mcpConfig = getMcpConfig(env);
    } catch (error) {
      return res.status(503).json(publicError(error));
    }
    if (!requestMatchesConfiguredResource(req, mcpConfig, env)) {
      return res.status(503).json({
        ok: false,
        error: {
          code: 'RESOURCE_URL_MISMATCH',
          message: 'MCP_RESOURCE_URL does not match this deployment. The connector is disabled for safety.'
        }
      });
    }

    let auth;
    try {
      auth = await verify(req, mcpConfig);
    } catch (error) {
      const status = Number(error?.status) || 401;
      const oauthError = status === 403 ? 'insufficient_scope' : 'invalid_token';
      res.setHeader('WWW-Authenticate', authChallenge(mcpConfig, oauthError));
      return res.status(status).json(publicError(error));
    }

    const rate = takeRateLimit(auth.subjectHash, mcpConfig.rateLimitPerMinute);
    res.setHeader('X-RateLimit-Limit', String(mcpConfig.rateLimitPerMinute));
    res.setHeader('X-RateLimit-Remaining', String(rate.remaining));
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfter));
      return res.status(429).json({ ok: false, error: { code: 'RATE_LIMITED', message: '呼び出し回数の上限に達しました。後でもう一度お試しください。' } });
    }

    if (req.method !== 'POST') return jsonRpcError(res, 405, 'Method not allowed.');
    if (!String(req.headers?.['content-type'] || '').toLowerCase().startsWith('application/json')) {
      return jsonRpcError(res, 415, 'Content-Type must be application/json.');
    }
    if (requestSize(req) > MAX_REQUEST_BYTES) return jsonRpcError(res, 413, 'Request body is too large.');

    const server = createNomadMcpServer({ articleStore: storeFactory(mcpConfig), auth });
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error(JSON.stringify({ event: 'nomad_field_mcp_transport_error', message: error instanceof Error ? error.message : 'Unknown transport error' }));
      if (!res.headersSent) jsonRpcError(res, 500, 'Internal server error.');
    } finally {
      await transport.close().catch(() => {});
      await server.close().catch(() => {});
    }
  };
}

export default createMcpHandler();
