import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const CONFIG = {
  PORT: process.env.PORT || 4000,
  HOST: process.env.HOST || '0.0.0.0',
  ENV: process.env.NODE_ENV || 'development',
  FRONTEND_DIR: path.resolve(__dirname, '../frontend'),
  JWT_SECRET: process.env.JWT_SECRET || 'pluck_secret_key_development_only_xyz',
  DEFAULT_PM: 'npm',
  CORS_ORIGIN: '*'
};
