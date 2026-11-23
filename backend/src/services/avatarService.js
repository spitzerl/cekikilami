import { AVATAR } from '../config/game.js';
import { httpError } from '../security/errors.js';
import { requireAvatarSeed } from '../security/media.js';

const cache = new Map();

export async function getAvatar(seedValue) {
  const seed = requireAvatarSeed(seedValue);
  const cached = cache.get(seed);
  if (cached && Date.now() < cached.expiresAt) {
    return cached;
  }

  const url = new URL('https://api.dicebear.com/9.x/notionists-neutral/png');
  url.searchParams.set('seed', seed);
  url.searchParams.set('backgroundColor', 'e6dcff,d9e8ff,f8d9ea');
  url.searchParams.set('size', '128');

  let response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(AVATAR.timeoutMs),
      headers: { Accept: 'image/png' },
    });
  } catch (error) {
    throw httpError(502, 'Service d’avatar indisponible');
  }

  if (!response.ok) {
    throw httpError(502, 'Service d’avatar indisponible');
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.startsWith('image/png')) {
    throw httpError(502, 'Réponse d’avatar invalide');
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length === 0 || buffer.length > AVATAR.maxBytes) {
    throw httpError(502, 'Réponse d’avatar invalide');
  }

  const entry = {
    buffer,
    contentType: 'image/png',
    expiresAt: Date.now() + AVATAR.cacheTtlMs,
  };

  if (cache.size >= AVATAR.cacheMaxEntries) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
  cache.set(seed, entry);
  return entry;
}

export function clearAvatarCache() {
  cache.clear();
}
