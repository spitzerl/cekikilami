import { httpError } from './errors.js';

const AUDIO_HOST = /^(?:cdns-preview-[a-z0-9-]+|cdnt-preview)\.dzcdn\.net$/i;
const COVER_HOST = /^(?:e-cdns-images|cdns-images|cdn-images)\.dzcdn\.net$/i;
const LOCAL_UPLOAD_PATH = /^\/uploads\/[a-f0-9]{32}\.(?:mp3|wav|ogg|m4a)$/;

function parseAllowedUrl(value, fieldName) {
  if (typeof value !== 'string' || !value.trim()) {
    throw httpError(400, `Le champ ${fieldName} est requis`);
  }

  let parsed;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw httpError(400, `Le champ ${fieldName} doit être une URL valide`);
  }

  if (parsed.protocol !== 'https:') {
    throw httpError(400, `Le champ ${fieldName} doit utiliser HTTPS`);
  }
  if (parsed.username || parsed.password) {
    throw httpError(400, `Le champ ${fieldName} ne doit pas contenir d'identifiants`);
  }
  if (parsed.port && parsed.port !== '443') {
    throw httpError(400, `Le champ ${fieldName} doit utiliser le port HTTPS standard`);
  }
  if (!parsed.hostname || /^\[?[0-9a-f:.]+\]?$/i.test(parsed.hostname)) {
    throw httpError(400, `Le champ ${fieldName} ne doit pas cibler une adresse IP`);
  }

  return parsed;
}

export function requireAudioUrl(value, fieldName = 'deezerPreviewUrl') {
  const parsed = parseAllowedUrl(value, fieldName);
  if (!AUDIO_HOST.test(parsed.hostname)) {
    throw httpError(400, `Le champ ${fieldName} doit pointer vers un extrait Deezer autorisé`);
  }
  return parsed.toString();
}

export function requireCoverUrl(value, fieldName = 'coverUrl') {
  const parsed = parseAllowedUrl(value, fieldName);
  if (!COVER_HOST.test(parsed.hostname)) {
    throw httpError(400, `Le champ ${fieldName} doit pointer vers une pochette Deezer autorisée`);
  }
  return parsed.toString();
}

export function isAllowedLocalUploadPath(value) {
  return typeof value === 'string' && LOCAL_UPLOAD_PATH.test(value);
}

export function requireMusicSource(value, fieldName = 'filePath') {
  if (typeof value !== 'string' || !value.trim()) {
    throw httpError(400, `Le champ ${fieldName} est requis`);
  }
  const trimmed = value.trim();
  if (isAllowedLocalUploadPath(trimmed)) return trimmed;
  return requireAudioUrl(trimmed, fieldName);
}

export function requireAvatarSeed(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(value)) {
    throw httpError(400, 'Seed d’avatar invalide');
  }
  return value;
}
