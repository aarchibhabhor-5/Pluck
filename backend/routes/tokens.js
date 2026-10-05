// Personal Access Tokens (PAT) & MCP Key Endpoints (PRD §2.3.8)
import { db } from '../services/dbStore.js';
import crypto from 'node:crypto';

export function handleTokenRoutes(req, res, path, method, body) {
  // GET /api/tokens
  if (path === '/api/tokens' && method === 'GET') {
    return jsonResponse(res, 200, { tokens: db.tokens });
  }

  // POST /api/tokens
  if (path === '/api/tokens' && method === 'POST') {
    const { name, scopes = ['snippets:read'], expiry = '90d' } = body;
    if (!name) {
      return jsonResponse(res, 400, { error: 'TOKEN_NAME_REQUIRED', message: 'Token name is required.' });
    }

    const rawHex = crypto.randomBytes(16).toString('hex');
    const fullToken = `pluck_pat_${rawHex}`;
    const prefix = `pluck_pat_${rawHex.slice(0, 4)}...`;

    const newToken = {
      id: 'tok_' + rawHex.slice(0, 8),
      name,
      prefix,
      tokenHash: crypto.createHash('sha256').update(fullToken).digest('hex'),
      scopes: Array.isArray(scopes) ? scopes : [scopes],
      lastUsed: 'Just now',
      expires: expiry === 'never' ? 'Never' : `in ${expiry}`,
      createdAt: new Date().toISOString()
    };

    db.tokens.unshift(newToken);

    return jsonResponse(res, 201, {
      success: true,
      token: newToken,
      rawToken: fullToken,
      message: 'Token created. Save this token now, you will not be able to see it again.'
    });
  }

  // DELETE /api/tokens/:id
  if (path.startsWith('/api/tokens/') && method === 'DELETE') {
    const id = path.replace('/api/tokens/', '');
    const index = db.tokens.findIndex(t => t.id === id);
    if (index === -1) {
      return jsonResponse(res, 404, { error: 'TOKEN_NOT_FOUND', message: `Token '${id}' not found.` });
    }
    const [revoked] = db.tokens.splice(index, 1);
    return jsonResponse(res, 200, { success: true, message: `Token '${revoked.name}' revoked.` });
  }

  return false;
}

function jsonResponse(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
  return true;
}
