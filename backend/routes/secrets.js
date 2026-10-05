// Secret Scanning & Redaction Endpoints (PRD §2.3.9)
import { scanCode, redactSecrets } from '../services/secretScanner.js';

export function handleSecretRoutes(req, res, path, method, body) {
  // POST /api/secrets/scan
  if (path === '/api/secrets/scan' && method === 'POST') {
    const { code } = body;
    const result = scanCode(code);
    return jsonResponse(res, 200, result);
  }

  // POST /api/secrets/redact
  if (path === '/api/secrets/redact' && method === 'POST') {
    const { code, findings } = body;
    const redactedCode = redactSecrets(code, findings);
    return jsonResponse(res, 200, {
      redactedCode,
      message: 'All detected secrets transformed to process.env references'
    });
  }

  return false;
}

function jsonResponse(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
  return true;
}
