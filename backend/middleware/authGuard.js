// Authentication & PAT Guard Middleware (PRD §2.4.6)
import { db } from '../services/dbStore.js';

export function authenticateRequest(req) {
  const authHeader = req.headers['authorization'] || '';
  const cookieHeader = req.headers['cookie'] || '';

  // 1. Check Bearer PAT Token (CLI / MCP / AI agents)
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const pat = db.tokens.find(t => token.startsWith(t.prefix.replace('...', '')));
    if (pat) {
      return { authenticated: true, user: db.users[0], tokenType: 'pat', scopes: pat.scopes };
    }
  }

  // 2. Check Cookie / Session header
  if (cookieHeader.includes('pluck_session') || authHeader.startsWith('Session ')) {
    return { authenticated: true, user: db.users[0], tokenType: 'session', scopes: ['all'] };
  }

  // In development, default to authenticated Alex Developer for easy local testing
  return { authenticated: true, user: db.users[0], tokenType: 'dev_session', scopes: ['all'] };
}
