import http from 'node:http';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createMcpHandler } from '../api/mcp.js';

function vercelResponse(res) {
  res.status = (status) => { res.statusCode = status; return res; };
  res.json = (value) => {
    if (!res.headersSent) res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(value));
    return res;
  };
}

async function parseBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  req.body = raw ? JSON.parse(raw) : undefined;
}

test('official MCP client completes initialize, tools/list, and tools/call over Streamable HTTP', async (t) => {
  const calls = [];
  const store = {
    async listArticles(args) {
      calls.push(args);
      return { ok: true, branch: 'test', total: 0, count: 0, nextCursor: null, articles: [] };
    },
    async getArticle() { throw new Error('not used'); },
    async createDraft() { throw new Error('not used'); },
    async updateDraft() { throw new Error('not used'); }
  };
  const env = {
    NODE_ENV: 'test', GITHUB_TOKEN: 'test', MCP_OWNER_SUB: 'owner|1', MCP_OAUTH_CLIENT_ID: 'claude-client',
    MCP_RESOURCE_URL: 'http://127.0.0.1/api/mcp', MCP_SITE_BASE_URL: 'http://127.0.0.1',
    MCP_GITHUB_BRANCH: 'test', MCP_OAUTH_ISSUER: 'http://127.0.0.1/auth/',
    MCP_OAUTH_JWKS_URL: 'http://127.0.0.1/auth/jwks', MCP_RATE_LIMIT_PER_MINUTE: '300'
  };
  const handler = createMcpHandler({
    env,
    verify: async () => ({ subject: 'owner|1', subjectHash: 'ownerhash', scopes: ['articles:read', 'drafts:write'] }),
    storeFactory: () => store
  });
  const server = http.createServer(async (req, res) => {
    vercelResponse(res);
    await parseBody(req);
    await handler(req, res);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${address.port}/api/mcp`), {
    requestInit: { headers: { Authorization: 'Bearer test-token' } }
  });
  const client = new Client({ name: 'nomad-field-test-client', version: '1.0.0' });
  t.after(() => client.close());

  await client.connect(transport);
  const tools = await client.listTools();
  assert.deepEqual(tools.tools.map((tool) => tool.name), ['list_articles', 'get_article', 'create_draft', 'update_draft']);
  for (const tool of tools.tools) {
    const properties = Object.keys(tool.inputSchema.properties || {});
    assert.equal(properties.includes('repository'), false);
    assert.equal(properties.includes('branch'), false);
    assert.equal(properties.includes('path'), false);
  }
  assert.equal(Object.hasOwn(tools.tools.find((tool) => tool.name === 'create_draft').inputSchema.properties, 'draft'), false);
  const result = await client.callTool({ name: 'list_articles', arguments: { status: 'draft', limit: 10 } });
  assert.equal(result.isError, undefined);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].status, 'draft');
  assert.match(result.content[0].text, /"articles": \[\]/);
});
