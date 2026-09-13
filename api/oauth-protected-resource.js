import { getPublicMcpConfig } from '../lib/mcp/config.js';
import { publicError } from '../lib/mcp/errors.js';

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });
  try {
    const config = getPublicMcpConfig();
    return res.status(200).json({
      resource: config.resourceUrl,
      authorization_servers: [config.issuer],
      scopes_supported: config.scopes,
      bearer_methods_supported: ['header'],
      resource_name: 'NOMAD FIELD Drafts'
    });
  } catch (error) {
    return res.status(503).json(publicError(error));
  }
}
