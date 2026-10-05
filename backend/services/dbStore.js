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
    { id: 'hooks', name: 'hooks', emoji: '🪝', count: 2, workspaceId: 'ws_personal' },
    { id: 'auth', name: 'auth', emoji: '🔐', count: 2, workspaceId: 'ws_personal' },
    { id: 'aws-infra', name: 'aws-infra', emoji: '☁️', count: 1, workspaceId: 'ws_personal' },
    { id: 'database', name: 'database', emoji: '🗄️', count: 1, workspaceId: 'ws_personal' }
  ],

  snippets: [
    {
      id: 'use-debounce',
      slug: 'use-debounce',
      title: 'useDebounce Hook',
      description: 'Debounces rapidly changing React state values using useEffect cleanup to eliminate redundant network requests.',
      language: 'typescript',
      folderId: 'hooks',
      folderName: 'hooks',
      visibility: 'private',
      version: 1,
      tags: ['react18', 'debounce', 'hooks', 'performance'],
      code: `import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number = {{delay|300}}): T {
  const [debouncedVal, setVal] = useState<T>(value);

  useEffect(() => {
    const t = setTimeout(() => setVal(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debouncedVal;
}`,
      dependencies: [{ name: 'react', versionHint: '^18.3.1' }],
      envKeys: [],
      variables: [
        { name: 'delay', type: 'number', defaultValue: '300', description: 'Debounce window in ms' }
      ],
      aiSummary: 'Debounces rapidly changing values with a configurable timeout window in React 18 using useEffect cleanup.',
      updatedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      createdAt: '2026-09-10T12:00:00Z',
      forkCount: 14
    },
    {
      id: 'jwt-auth',
      slug: 'jwt-auth',
      title: 'JWT Sign & Verify Middleware',
      description: 'Zero-boilerplate JSON Web Token verification with typed payloads using Zod.',
      language: 'typescript',
      folderId: 'auth',
      folderName: 'auth',
      visibility: 'team',
      version: 1,
      tags: ['security', 'jwt', 'auth'],
      code: `import jwt from 'jsonwebtoken';
import { z } from 'zod';

const PayloadSchema = z.object({
  userId: z.string(),
  role: z.enum(['admin', 'editor', 'viewer'])
});

export function verifyToken(token: string) {
  const decoded = jwt.verify(token, process.env.JWT_SECRET!);
  return PayloadSchema.parse(decoded);
}`,
      dependencies: [
        { name: 'jsonwebtoken', versionHint: '^9.0.2' },
        { name: 'zod', versionHint: '^3.23' }
      ],
      envKeys: ['JWT_SECRET'],
      variables: [],
      aiSummary: 'Cryptographically verifies JWT payloads against a strict Zod runtime schema.',
      updatedAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      createdAt: '2026-09-12T14:00:00Z',
      forkCount: 8
    },
    {
      id: 's3-upload',
      slug: 's3-upload',
      title: 'S3 Presigned URL Uploader',
      description: 'Generates secure S3 presigned post data with signature v4 and expiration windows.',
      language: 'python',
      folderId: 'aws-infra',
      folderName: 'aws-infra',
      visibility: 'public',
      version: 1,
      tags: ['aws', 's3', 'boto3', 'storage'],
      code: `import boto3
from botocore.config import Config

def generate_presigned_post(bucket_name: str, key: str, expires_in: int = {{expires|3600}}):
    s3 = boto3.client('s3', config=Config(signature_version='s3v4'))
    return s3.generate_presigned_post(bucket_name, key, ExpiresIn=expires_in)`,
      dependencies: [{ name: 'boto3', versionHint: '>= 1.34' }],
      envKeys: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'],
      variables: [
        { name: 'expires', type: 'number', defaultValue: '3600', description: 'Expiration seconds' }
      ],
      aiSummary: 'Creates an S3 presigned POST object allowing direct browser uploads without routing bytes through API servers.',
      updatedAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
      createdAt: '2026-09-15T09:00:00Z',
      forkCount: 22
    },
    {
      id: 'redis-ratelimit',
      slug: 'redis-ratelimit',
      title: 'Sliding Window Rate Limiter',
      description: 'Atomic sliding window rate limiter implemented via Redis sorted sets (ZSET).',
      language: 'typescript',
      folderId: 'hooks',
      folderName: 'hooks',
      visibility: 'private',
      version: 1,
      tags: ['security', 'redis', 'ratelimit'],
      code: `import Redis from 'ioredis';

export async function checkRateLimit(redis: Redis, key: string, limit: number = {{limit|100}}, windowMs: number = 60000) {
  const now = Date.now();
  const clearBefore = now - windowMs;
  const multi = redis.multi();
  multi.zremrangebyscore(key, 0, clearBefore);
  multi.zadd(key, now, \`\${now}-\${Math.random()}\`);
  multi.zcard(key);
  const [, , count] = await multi.exec();
  return (count as number) <= limit;
}`,
      dependencies: [{ name: 'ioredis', versionHint: '^5.4' }],
      envKeys: ['REDIS_URL'],
      variables: [
        { name: 'limit', type: 'number', defaultValue: '100', description: 'Request limit quota' }
      ],
      aiSummary: 'Atomic sliding-window rate limiting algorithm using Redis ZREMRANGEBYSCORE and ZADD transactions.',
      updatedAt: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
      createdAt: '2026-09-18T16:00:00Z',
      forkCount: 19
    },
    {
      id: 'prisma-soft-delete',
      slug: 'prisma-soft-delete',
      title: 'Prisma Soft Delete Extension',
      description: 'Prisma Client client-side extension that intercepts delete queries and sets deletedAt timestamp.',
      language: 'typescript',
      folderId: 'database',
      folderName: 'database',
      visibility: 'private',
      version: 1,
      tags: ['database', 'prisma', 'orm'],
      code: `import { Prisma } from '@prisma/client';

export const softDelete = Prisma.defineExtension({
  name: 'softDelete',
  query: {
    $allModels: {
      async delete({ args, query }) {
        return query({ ...args, data: { deletedAt: new Date() } });
      }
    }
  }
});`,
      dependencies: [{ name: '@prisma/client', versionHint: '^5.14' }],
      envKeys: ['DATABASE_URL'],
      variables: [],
      aiSummary: 'Interception extension for Prisma 5 to convert hard record deletions into timestamped soft deletes.',
      updatedAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
      createdAt: '2026-09-20T11:00:00Z',
      forkCount: 31
    },
    {
      id: 'fastapi-cors',
      slug: 'fastapi-cors',
      title: 'FastAPI Error Handler & CORS',
      description: 'Global exception handler and structured RFC 7807 error responses for FastAPI.',
      language: 'python',
      folderId: 'auth',
      folderName: 'auth',
      visibility: 'public',
      version: 1,
      tags: ['fastapi', 'python', 'api', 'cors'],
      code: `from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

app = FastAPI()

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"error": "INTERNAL_ERROR", "detail": str(exc)},
    )`,
      dependencies: [
        { name: 'fastapi', versionHint: '>= 0.111' },
        { name: 'uvicorn', versionHint: '>= 0.30' }
      ],
      envKeys: [],
      variables: [],
      aiSummary: 'Standardized global exception hook returning JSON error payloads for production Python APIs.',
      updatedAt: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
      createdAt: '2026-09-22T08:00:00Z',
      forkCount: 11
    }
  ],

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
