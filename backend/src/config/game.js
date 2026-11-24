import 'dotenv/config';

function integerEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const SESSION_TTLS = {
  waiting: integerEnv('SESSION_TTL_WAITING_SECONDS', 24 * 60 * 60),
  selection: integerEnv('SESSION_TTL_SELECTION_SECONDS', 6 * 60 * 60),
  voting: integerEnv('SESSION_TTL_VOTING_SECONDS', 6 * 60 * 60),
  results: integerEnv('SESSION_TTL_RESULTS_SECONDS', 60 * 60),
};

export const MAX_SESSIONS = integerEnv('MAX_SESSIONS', 500);
// Long enough to absorb a phone locking or switching networks without handing
// the host role to someone else while the host is coming back.
export const HOST_DISCONNECT_GRACE_MS = integerEnv('HOST_DISCONNECT_GRACE_MS', 30_000);
export const MAINTENANCE_INTERVAL_MS = integerEnv('MAINTENANCE_INTERVAL_MS', 5 * 60 * 1000);

export const RATE_LIMITS = {
  createSessionPerHour: integerEnv('RATE_LIMIT_CREATE_SESSION_PER_HOUR', 10),
  joinPerMinute: integerEnv('RATE_LIMIT_JOIN_PER_MINUTE', 30),
  summaryPerMinute: integerEnv('RATE_LIMIT_SUMMARY_PER_MINUTE', 120),
  statePerMinute: integerEnv('RATE_LIMIT_STATE_PER_MINUTE', 120),
  votePerMinute: integerEnv('RATE_LIMIT_VOTE_PER_MINUTE', 60),
  uploadPerHour: integerEnv('RATE_LIMIT_UPLOAD_PER_HOUR', 20),
  deezerPerMinute: integerEnv('RATE_LIMIT_DEEZER_PER_MINUTE', 60),
  avatarPerMinute: integerEnv('RATE_LIMIT_AVATAR_PER_MINUTE', 300),
  // A whole household can share one public IP: keep this high enough for
  // normal reconnects and reserve the strict limit for failed authentications.
  socketConnectionsPerMinute: integerEnv('RATE_LIMIT_SOCKET_CONNECTIONS_PER_MINUTE', 120),
  socketAuthFailuresPerMinute: integerEnv('RATE_LIMIT_SOCKET_AUTH_FAILURES_PER_MINUTE', 20),
  socketJoinsPerMinute: integerEnv('RATE_LIMIT_SOCKET_JOINS_PER_MINUTE', 10),
};

export const CONFIG_BOUNDS = {
  maxPlayers: { min: 4, max: 16 },
  maxMusicsPerPlayer: { min: 1, max: 5 },
  selectionDuration: { min: 30, max: 300 },
  extractDuration: { min: 10, max: 30 },
  votingDuration: { min: 20, max: 60 },
};

export const TRACK_INFO_MODES = ['before', 'after', 'results'];

export const SCORING_MODES = ['detective', 'balanced', 'bluff'];

export const SCORING = {
  detective: {
    correctAccusation: 1,
    proposerMode: 'none',
    proposerMax: 0,
    blindTest: 1,
  },
  balanced: {
    correctAccusation: 3,
    proposerMode: 'threeMinusFound',
    proposerMax: 3,
    blindTest: 1,
  },
  bluff: {
    correctAccusation: 3,
    proposerMode: 'perMiss',
    proposerMax: 3,
    blindTest: 1,
  },
};

export const UPLOAD_LIMITS = {
  maxFileBytes: integerEnv('UPLOAD_MAX_FILE_BYTES', 10 * 1024 * 1024),
  maxTotalBytes: integerEnv('UPLOAD_MAX_TOTAL_BYTES', 2 * 1024 * 1024 * 1024),
  maxSessionBytes: integerEnv('UPLOAD_MAX_SESSION_BYTES', 100 * 1024 * 1024),
  maxPlayerBytes: integerEnv('UPLOAD_MAX_PLAYER_BYTES', 50 * 1024 * 1024),
  orphanTtlMs: integerEnv('UPLOAD_ORPHAN_TTL_SECONDS', 48 * 60 * 60) * 1000,
};

export const DEEZER = {
  timeoutMs: integerEnv('DEEZER_TIMEOUT_MS', 5_000),
  cacheTtlMs: integerEnv('DEEZER_CACHE_TTL_MS', 5 * 60 * 1000),
  cacheMaxEntries: integerEnv('DEEZER_CACHE_MAX_ENTRIES', 500),
  botConcurrency: integerEnv('DEEZER_BOT_CONCURRENCY', 4),
  botGenerationBudgetMs: integerEnv('DEEZER_BOT_BUDGET_MS', 10_000),
  previewMaxBytes: integerEnv('DEEZER_PREVIEW_MAX_BYTES', 5 * 1024 * 1024),
};

export const AVATAR = {
  cacheTtlMs: integerEnv('AVATAR_CACHE_TTL_MS', 24 * 60 * 60 * 1000),
  cacheMaxEntries: integerEnv('AVATAR_CACHE_MAX_ENTRIES', 500),
  timeoutMs: integerEnv('AVATAR_TIMEOUT_MS', 5_000),
  maxBytes: integerEnv('AVATAR_MAX_BYTES', 512 * 1024),
};

export const TRUST_PROXY = process.env.TRUST_PROXY || '';

export const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';
