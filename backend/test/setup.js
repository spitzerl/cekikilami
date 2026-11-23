import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
  || 'postgresql://postgres@localhost:5432/music_game_test';
process.env.UPLOAD_DIR = process.env.TEST_UPLOAD_DIR
  || path.resolve(__dirname, 'tmp-uploads');
process.env.REDIS_URL = '';
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.TRUST_PROXY = '';
process.env.MAX_SESSIONS = '5';
process.env.HOST_DISCONNECT_GRACE_MS = '100';
process.env.MAINTENANCE_INTERVAL_MS = '600000';

process.env.RATE_LIMIT_CREATE_SESSION_PER_HOUR = '500';
process.env.RATE_LIMIT_JOIN_PER_MINUTE = '500';
process.env.RATE_LIMIT_SUMMARY_PER_MINUTE = '500';
process.env.RATE_LIMIT_STATE_PER_MINUTE = '500';
process.env.RATE_LIMIT_VOTE_PER_MINUTE = '500';
process.env.RATE_LIMIT_UPLOAD_PER_HOUR = '500';
process.env.RATE_LIMIT_DEEZER_PER_MINUTE = '500';
process.env.RATE_LIMIT_AVATAR_PER_MINUTE = '500';

process.env.UPLOAD_MAX_PLAYER_BYTES = '3000';
process.env.UPLOAD_MAX_SESSION_BYTES = '3000';
process.env.UPLOAD_MAX_TOTAL_BYTES = '3000';

fs.rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true });
fs.mkdirSync(process.env.UPLOAD_DIR, { recursive: true });
