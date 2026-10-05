// Search Route Handlers (PRD §2.3.8 & §2.4.4)
// Hybrid vector + keyword search simulation
import { db } from '../services/dbStore.js';

export function handleSearchRoutes(req, res, path, method, query) {
  // GET /api/search?q=...
  if (path === '/api/search' && method === 'GET') {
    const q = (query.q || '').toLowerCase().trim();
    if (!q) {
      return jsonResponse(res, 200, {
        results: db.snippets.slice(0, 5),
        query: '',
        count: db.snippets.slice(0, 5).length
      });
    }

    const terms = q.split(/\s+/);
    const scored = db.snippets.map(s => {
      let score = 0;
      const titleLower = s.title.toLowerCase();
      const codeLower = s.code.toLowerCase();
      const summaryLower = (s.aiSummary || '').toLowerCase();
      const tags = (s.tags || []).map(t => t.toLowerCase());
      const deps = (s.dependencies || []).map(d => d.name.toLowerCase());

      terms.forEach(term => {
        if (titleLower.includes(term)) score += 10;
        if (summaryLower.includes(term)) score += 6;
        if (deps.some(d => d.includes(term))) score += 5;
        if (tags.some(t => t.includes(term))) score += 4;
        if (codeLower.includes(term)) score += 2;
      });

      return { snippet: s, score };
    });

    const results = scored
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(item => ({
        ...item.snippet,
        relevanceScore: item.score
      }));

    return jsonResponse(res, 200, {
      results,
      query: q,
      count: results.length,
      latencyMs: Math.floor(Math.random() * 40) + 15
    });
  }

  return false;
}

function jsonResponse(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
  return true;
}
