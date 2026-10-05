// Folders & Collections Route Handlers (PRD §2.3.4)
import { db } from '../services/dbStore.js';

export function handleFolderRoutes(req, res, path, method, body) {
  // GET /api/folders
  if (path === '/api/folders' && method === 'GET') {
    // Recalculate dynamic counts
    const foldersWithCounts = db.folders.map(f => ({
      ...f,
      count: db.snippets.filter(s => s.folderId === f.id).length
    }));
    return jsonResponse(res, 200, { folders: foldersWithCounts, total: foldersWithCounts.length });
  }

  // POST /api/folders
  if (path === '/api/folders' && method === 'POST') {
    const { name, emoji = '📁' } = body;
    if (!name) {
      return jsonResponse(res, 400, { error: 'NAME_REQUIRED', message: 'Folder name is required.' });
    }
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const newFolder = {
      id,
      name,
      emoji,
      count: 0,
      workspaceId: 'ws_personal'
    };
    db.folders.push(newFolder);
    return jsonResponse(res, 201, { success: true, folder: newFolder });
  }

  return false;
}

function jsonResponse(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
  return true;
}
