import crypto from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { McpAppError } from './errors.js';

const jwksCache = new Map();

function bearerToken(req) {
  const header = String(req.headers?.authorization || '');
  const match = header.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1] || '';
}

function jwksFor(url) {
  if (!jwksCache.has(url)) jwksCache.set(url, createRemoteJWKSet(new URL(url)));
  return jwksCache.get(url);
}

export async function verifyAccessToken(req, config, { verifyJwt = jwtVerify } = {}) {
  const token = bearerToken(req);
  if (!token) {
    throw new McpAppError('OAuth access token is required.', { code: 'AUTH_REQUIRED', status: 401 });
  }

  let result;
  try {
    result = await verifyJwt(token, jwksFor(config.jwksUrl), {
      issuer: config.issuer,
      audience: config.resourceUrl,
      algorithms: ['RS256']
    });
  } catch {
    throw new McpAppError('OAuth access token is invalid or expired.', { code: 'INVALID_TOKEN', status: 401 });
  }

  const payload = result.payload || {};
  const tokenClientId = String(payload.azp || payload.client_id || '');
  if (!tokenClientId || tokenClientId !== config.oauthClientId) {
    throw new McpAppError('The access token was not issued to the configured Claude OAuth client.', {
      code: 'CLIENT_REQUIRED', status: 403
    });
  }
  if (!payload.sub || payload.sub !== config.ownerSubject) {
    throw new McpAppError('This account is not authorized to edit NOMAD FIELD.', {
      code: 'OWNER_REQUIRED', status: 403
    });
  }
  const scopes = new Set([
    ...String(payload.scope || '').split(/\s+/).filter(Boolean),
    ...(Array.isArray(payload.permissions) ? payload.permissions.map(String) : [])
  ]);
  const missing = config.scopes.filter((scope) => !scopes.has(scope));
  if (missing.length) {
    throw new McpAppError('The access token does not include the required scopes.', {
      code: 'INSUFFICIENT_SCOPE', status: 403,
      details: { requiredScopes: config.scopes }
    });
  }
  return {
    subject: payload.sub,
    subjectHash: crypto.createHash('sha256').update(payload.sub).digest('hex').slice(0, 12),
    scopes: [...scopes]
  };
}

export function authChallenge(config, error = 'invalid_token') {
  return `Bearer resource_metadata="${config.metadataUrl}", scope="${config.scopes.join(' ')}", error="${error}"`;
}
