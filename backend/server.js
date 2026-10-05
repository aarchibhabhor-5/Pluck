// Pluck Backend Server — Standalone Node.js HTTP Server & REST API
// Zero external dependencies required. Works out of the box with Node 20+

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

import { CONFIG } from './config.js';
import { handleAuthRoutes } from './routes/auth.js';
import { handleSnippetRoutes } from './routes/snippets.js';
import { handleFolderRoutes } from './routes/folders.js';
import { handleSearchRoutes } from './routes/search.js';
import { handleSecretRoutes } from './routes/secrets.js';
import { handleTokenRoutes } from './routes/tokens.js';
import { handleTeamRoutes } from './routes/teams.js';
import { authenticateRequest } from './middleware/authGuard.js';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

const server = http.createServer(async (req, res) => {
  // 1. CORS Preflight & Headers
  res.setHeader('Access-Control-Allow-Origin', CONFIG.CORS_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;
  const query = parsedUrl.query;

  // 2. Parse JSON Body for POST / PATCH / PUT
  let body = {};
  if (['POST', 'PATCH', 'PUT'].includes(method)) {
    try {
      body = await parseJsonBody(req);
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'INVALID_JSON_BODY', message: err.message }));
      return;
    }
  }

  // 3. Authenticate context
  req.auth = authenticateRequest(req);

  // 4. API Routes Dispatcher
  try {
    // Healthcheck
    if (pathname === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'healthy', uptime: process.uptime(), timestamp: new Date().toISOString() }));
      return;
    }

    if (handleAuthRoutes(req, res, pathname, method, body)) return;
    if (handleSnippetRoutes(req, res, pathname, method, body, query)) return;
    if (handleFolderRoutes(req, res, pathname, method, body)) return;
    if (handleSearchRoutes(req, res, pathname, method, query)) return;
    if (handleSecretRoutes(req, res, pathname, method, body)) return;
    if (handleTokenRoutes(req, res, pathname, method, body)) return;
    if (handleTeamRoutes(req, res, pathname, method, body)) return;

    // 5. If path starts with /api/ and wasn't handled, return 404 API error
    if (pathname.startsWith('/api/')) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'ENDPOINT_NOT_FOUND', message: `Route ${method} ${pathname} not found.` }));
      return;
    }

    // 6. Static File Serving for Frontend
    serveStaticFile(pathname, res);
  } catch (error) {
    console.error('Server Unhandled Error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'INTERNAL_SERVER_ERROR', message: error.message }));
  }
});

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 2 * 1024 * 1024) { // 2MB limit
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!raw.trim()) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error('Malformed JSON'));
      }
    });
    req.on('error', reject);
  });
}

function serveStaticFile(reqPath, res) {
  let relativePath = reqPath === '/' ? 'index.html' : reqPath.replace(/^\//, '');
  let filePath = path.join(CONFIG.FRONTEND_DIR, relativePath);

  // Security check: prevent directory traversal
  if (!filePath.startsWith(CONFIG.FRONTEND_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  // Check if file exists
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    // If not found, check if it's missing .html extension
    if (fs.existsSync(filePath + '.html')) {
      filePath = filePath + '.html';
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File Not Found');
      return;
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Server Error reading file');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
}

server.listen(CONFIG.PORT, CONFIG.HOST, () => {
  console.log(`\n======================================================`);
  console.log(`⚡ PLUCK BACKEND SERVER ACTIVE`);
  console.log(`📡 API & Static Frontend: http://localhost:${CONFIG.PORT}`);
  console.log(`🔍 Health Check: http://localhost:${CONFIG.PORT}/api/health`);
  console.log(`📦 Seeded Snippets: 6 | Folders: 4 | Tokens: 2`);
  console.log(`======================================================\n`);
});
