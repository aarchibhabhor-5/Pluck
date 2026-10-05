// Authentication Route Handlers (PRD §2.3.3)
import { db } from '../services/dbStore.js';

export function handleAuthRoutes(req, res, path, method, body) {
  // POST /api/auth/login
  if (path === '/api/auth/login' && method === 'POST') {
    const { email, password } = body;
    if (!email || !password) {
      return jsonResponse(res, 400, { error: 'EMAIL_AND_PASSWORD_REQUIRED', message: 'Email and password must be provided.' });
    }
    const user = db.users[0];
    return jsonResponse(res, 200, {
      success: true,
      message: 'Authenticated successfully',
      token: 'sess_' + Math.random().toString(36).substring(2),
      user
    });
  }

  // POST /api/auth/register
  if (path === '/api/auth/register' && method === 'POST') {
    const { email, password } = body;
    if (!email || !password || password.length < 10) {
      return jsonResponse(res, 400, { error: 'INVALID_PASSWORD', message: 'Password must be at least 10 characters.' });
    }
    const newUser = {
      id: 'usr_' + Math.random().toString(36).substring(2, 9),
      name: email.split('@')[0],
      email,
      avatar: email[0].toUpperCase(),
      createdAt: new Date().toISOString()
    };
    db.users.push(newUser);
    return jsonResponse(res, 201, {
      success: true,
      message: 'Account created successfully',
      token: 'sess_' + Math.random().toString(36).substring(2),
      user: newUser
    });
  }

  // POST /api/auth/oauth
  if (path === '/api/auth/oauth' && method === 'POST') {
    const { provider } = body;
    const user = db.users[0];
    return jsonResponse(res, 200, {
      success: true,
      provider: provider || 'GitHub',
      token: 'sess_oauth_' + Math.random().toString(36).substring(2),
      user
    });
  }

  // GET /api/auth/me
  if (path === '/api/auth/me' && method === 'GET') {
    return jsonResponse(res, 200, { user: db.users[0] });
  }

  // POST /api/auth/logout
  if (path === '/api/auth/logout' && method === 'POST') {
    return jsonResponse(res, 200, { success: true, message: 'Logged out successfully' });
  }

  return false;
}

function jsonResponse(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
  return true;
}
