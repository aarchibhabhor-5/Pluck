// In-Memory Database Store for Pluck Backend
// Seeded with PRD sample data

export const db = {
  users: [
    {
      id: 'usr_alex',
      name: 'Alex Developer',
      email: 'alex@pluck.dev',
      avatar: 'A',
      githubUsername: 'alexdev',
      role: 'owner',
      createdAt: '2026-09-01T10:00:00Z'
    }
  ],

  folders: [
    { id: 'hooks', name: 'hooks', emoji: '🪝', count: 0, workspaceId: 'ws_personal' },
    { id: 'auth', name: 'auth', emoji: '🔐', count: 0, workspaceId: 'ws_personal' },
    { id: 'aws-infra', name: 'aws-infra', emoji: '☁️', count: 0, workspaceId: 'ws_personal' },
    { id: 'database', name: 'database', emoji: '🗄️', count: 0, workspaceId: 'ws_personal' }
  ],

  snippets: [],

  tokens: [
    {
      id: 'tok_cursor',
      name: 'MacBook Cursor Agent',
      prefix: 'pluck_pat_8f19...',
      tokenHash: 'hash_8f194726',
      scopes: ['mcp', 'snippets:read'],
      lastUsed: '12m ago',
      expires: 'in 88 days',
      createdAt: '2026-09-20T10:00:00Z'
    },
    {
      id: 'tok_cli',
      name: 'CLI Terminal Token',
      prefix: 'pluck_pat_4a22...',
      tokenHash: 'hash_4a229103',
      scopes: ['all scopes'],
      lastUsed: '3d ago',
      expires: 'Never',
      createdAt: '2026-09-15T15:00:00Z'
    }
  ],

  teams: [
    {
      id: 'acme-core-eng',
      name: 'Acme Core Eng',
      role: 'Admin',
      members: [
        { id: 'm1', name: 'Alex Developer (You)', email: 'alex@pluck.dev', role: 'Admin', isOwner: true },
        { id: 'm2', name: 'Sarah Jenkins', email: 'sarah@company.com', role: 'Editor', isOwner: false },
        { id: 'm3', name: 'Leo Chen', email: 'leo@company.com', role: 'Editor', isOwner: false },
        { id: 'm4', name: 'Maya Patel', email: 'maya@company.com', role: 'Viewer', isOwner: false }
      ],
      collections: [
        { name: 'auth-middleware', emoji: '🔐', count: 8, description: 'JWT verification, RBAC guards, and session decryptors.' },
        { name: 'aws-infrastructure', emoji: '☁️', count: 12, description: 'Boto3 client setups, DynamoDB pagination, and S3 uploaders.' },
        { name: 'prisma-extensions', emoji: '🗄️', count: 5, description: 'Soft delete, audit logging triggers, and read-replica routers.' }
      ],
      activity: [
        { user: 'Sarah Jenkins', action: 'published', target: 'jwt-auth-middleware', time: '14m ago', icon: 'cyan' },
        { user: 'Alex Developer', action: 'updated dependencies for', target: 'boto3-s3-uploader', time: '2h ago', icon: 'yellow' },
        { user: 'Leo Chen', action: 'copied', target: 's3-presigned-upload via CLI', time: '5h ago', icon: 'pink' }
      ]
    }
  ]
};
