// Snippets REST API Handlers (PRD §2.6)
import { db } from '../services/dbStore.js';
import { scanCode } from '../services/secretScanner.js';
import { analyzeCode } from '../services/astAnalyzer.js';

export function handleSnippetRoutes(req, res, path, method, body, query) {
  // GET /api/snippets
  if (path === '/api/snippets' && method === 'GET') {
    let results = [...db.snippets];

    if (query.folder && query.folder !== 'all') {
      results = results.filter(s => s.folderId === query.folder);
    }
    if (query.lang) {
      results = results.filter(s => s.language.toLowerCase() === query.lang.toLowerCase());
    }
    if (query.tag) {
      results = results.filter(s => s.tags && s.tags.includes(query.tag));
    }

    return jsonResponse(res, 200, {
      snippets: results,
      total: results.length
    });
  }

  // GET /api/snippets/:id
  if (path.startsWith('/api/snippets/') && method === 'GET') {
    const id = path.replace('/api/snippets/', '');
    const snippet = db.snippets.find(s => s.id === id || s.slug === id);
    if (!snippet) {
      return jsonResponse(res, 404, { error: 'SNIPPET_NOT_FOUND', message: `Snippet '${id}' does not exist.` });
    }
    return jsonResponse(res, 200, snippet);
  }

  // POST /api/snippets (Create snippet with server-authoritative scanning)
  if (path === '/api/snippets' && method === 'POST') {
    const { title, code, language, folderId, visibility = 'private', tags = [], acknowledgeSecrets = false } = body;

    if (!title || !code) {
      return jsonResponse(res, 400, { error: 'TITLE_AND_CODE_REQUIRED', message: 'Title and code are required.' });
    }

    // 1. Server-authoritative secret scanning gating (PRD §2.3.5 rule 2)
    const scanResult = scanCode(code);
    if ((scanResult.hasCritical || scanResult.hasHigh) && visibility !== 'private') {
      return jsonResponse(res, 422, {
        error: 'SECRET_GATING_VIOLATION',
        message: 'Snippet contains active credentials and cannot be saved with non-private visibility.',
        findings: scanResult.findings
      });
    }

    if ((scanResult.hasCritical || scanResult.hasHigh) && !acknowledgeSecrets) {
      return jsonResponse(res, 422, {
        error: 'SECRETS_REQUIRE_ACKNOWLEDGEMENT',
        message: 'Active secrets detected. Must redact or explicitly acknowledge secrets for private snippets.',
        findings: scanResult.findings
      });
    }

    // 2. AST parsing & dependency derivation
    const ast = analyzeCode(code, language || 'typescript');

    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const newSnippet = {
      id: slug || 'snip_' + Math.random().toString(36).substring(2, 9),
      slug: slug || 'snip_' + Math.random().toString(36).substring(2, 9),
      title,
      code,
      language: language || 'typescript',
      folderId: folderId || 'hooks',
      folderName: folderId || 'hooks',
      visibility,
      version: 1,
      tags: Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()),
      dependencies: ast.dependencies,
      envKeys: ast.envKeys,
      variables: ast.variables,
      aiSummary: `AI indexed: ${title} in ${language} with ${ast.dependencies.length} dependencies.`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      forkCount: 0
    };

    db.snippets.unshift(newSnippet);

    // Update folder count
    const folder = db.folders.find(f => f.id === newSnippet.folderId);
    if (folder) folder.count++;

    return jsonResponse(res, 201, {
      success: true,
      snippet: newSnippet,
      message: 'Snippet created and indexed successfully'
    });
  }

  // PATCH /api/snippets/:id (Optimistic concurrency version check)
  if (path.startsWith('/api/snippets/') && method === 'PATCH') {
    const id = path.replace('/api/snippets/', '');
    const index = db.snippets.findIndex(s => s.id === id || s.slug === id);
    if (index === -1) {
      return jsonResponse(res, 404, { error: 'SNIPPET_NOT_FOUND', message: `Snippet '${id}' does not exist.` });
    }

    const snippet = db.snippets[index];

    // Concurrency check
    if (body.baseVersion !== undefined && body.baseVersion !== snippet.version) {
      return jsonResponse(res, 409, {
        error: 'VERSION_CONFLICT',
        message: 'Snippet has been modified by another session. Please merge diffs.',
        currentVersion: snippet.version
      });
    }

    const updatedCode = body.code !== undefined ? body.code : snippet.code;
    const updatedLang = body.language || snippet.language;
    const ast = analyzeCode(updatedCode, updatedLang);

    const updatedSnippet = {
      ...snippet,
      ...body,
      dependencies: ast.dependencies.length ? ast.dependencies : snippet.dependencies,
      envKeys: ast.envKeys.length ? ast.envKeys : snippet.envKeys,
      variables: ast.variables.length ? ast.variables : snippet.variables,
      version: snippet.version + 1,
      updatedAt: new Date().toISOString()
    };

    db.snippets[index] = updatedSnippet;
    return jsonResponse(res, 200, { success: true, snippet: updatedSnippet });
  }

  // DELETE /api/snippets/:id
  if (path.startsWith('/api/snippets/') && method === 'DELETE') {
    const id = path.replace('/api/snippets/', '');
    const index = db.snippets.findIndex(s => s.id === id || s.slug === id);
    if (index === -1) {
      return jsonResponse(res, 404, { error: 'SNIPPET_NOT_FOUND', message: `Snippet '${id}' does not exist.` });
    }
    const [deleted] = db.snippets.splice(index, 1);
    return jsonResponse(res, 200, { success: true, message: `Snippet '${deleted.title}' deleted.` });
  }

  // POST /api/snippets/:id/fork
  if (path.includes('/fork') && method === 'POST') {
    const id = path.split('/')[3];
    const source = db.snippets.find(s => s.id === id || s.slug === id);
    if (!source) {
      return jsonResponse(res, 404, { error: 'SNIPPET_NOT_FOUND', message: `Source snippet '${id}' not found.` });
    }

    source.forkCount++;
    const forked = {
      ...source,
      id: `${source.slug}-fork-${Date.now().toString(36)}`,
      slug: `${source.slug}-fork`,
      title: `${source.title} (Fork)`,
      visibility: 'private',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      forkCount: 0
    };

    db.snippets.unshift(forked);
    return jsonResponse(res, 201, { success: true, snippet: forked, message: 'Snippet forked to your personal vault!' });
  }

  return false;
}

function jsonResponse(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
  return true;
}
