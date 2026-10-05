// Team Workspace Route Handlers (PRD §2.3.8)
import { db } from '../services/dbStore.js';

export function handleTeamRoutes(req, res, path, method, body) {
  // GET /api/teams/:id
  if (path.startsWith('/api/teams/') && method === 'GET' && !path.includes('/activity')) {
    const id = path.replace('/api/teams/', '');
    const team = db.teams.find(t => t.id === id) || db.teams[0];
    return jsonResponse(res, 200, { team });
  }

  // GET /api/teams/:id/activity
  if (path.includes('/activity') && method === 'GET') {
    const team = db.teams[0];
    return jsonResponse(res, 200, { activity: team.activity });
  }

  // POST /api/teams/:id/invites
  if (path.includes('/invites') && method === 'POST') {
    const { email, role = 'Editor' } = body;
    if (!email) {
      return jsonResponse(res, 400, { error: 'EMAIL_REQUIRED', message: 'Colleague email is required.' });
    }
    const team = db.teams[0];
    const newMember = {
      id: 'm_' + Math.random().toString(36).substring(2, 7),
      name: email.split('@')[0],
      email,
      role,
      isOwner: false
    };
    team.members.push(newMember);
    team.activity.unshift({
      user: 'Alex Developer',
      action: `invited ${email} as`,
      target: role,
      time: 'Just now',
      icon: 'cyan'
    });
    return jsonResponse(res, 201, {
      success: true,
      member: newMember,
      message: `Invitation sent to ${email} with role ${role}.`
    });
  }

  // DELETE /api/teams/:id/members/:memberId
  if (path.includes('/members/') && method === 'DELETE') {
    const parts = path.split('/');
    const memberId = parts[parts.length - 1];
    const team = db.teams[0];
    const idx = team.members.findIndex(m => m.id === memberId);
    if (idx !== -1) {
      const [removed] = team.members.splice(idx, 1);
      return jsonResponse(res, 200, { success: true, message: `Member '${removed.name}' removed.` });
    }
    return jsonResponse(res, 404, { error: 'MEMBER_NOT_FOUND', message: 'Member not found in team.' });
  }

  return false;
}

function jsonResponse(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
  return true;
}
