import { BOT_TRACKS, GENRE_QUERIES } from '../data/botCatalog.js';
import { DEEZER } from '../config/game.js';
import { normalizeTitle, shuffle, uniqueBy } from '../utils/normalize.js';
import { requireAudioUrl, requireCoverUrl } from '../security/media.js';

const cache = new Map();

function normalizeTrack(track) {
  if (!track?.preview) return null;
  try {
    // Deezer still returns some CDN URLs in plain HTTP; upgrade before the
    // HTTPS-only allowlist check.
    const preview = String(track.preview).replace(/^http:\/\//i, 'https://');
    const cover = track.album?.cover_medium
      ? String(track.album.cover_medium).replace(/^http:\/\//i, 'https://')
      : null;

    return {
      id: track.id,
      title: typeof track.title === 'string' ? track.title : 'Titre inconnu',
      artist: track.artist?.name || 'Inconnu',
      file_path: requireAudioUrl(preview, 'preview'),
      cover_url: cover ? requireCoverUrl(cover, 'cover') : null,
    };
  } catch {
    return null;
  }
}

async function fetchJson(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(DEEZER.timeoutMs),
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Deezer a répondu ${response.status}`);
  }

  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > 1_000_000) {
    throw new Error('Réponse Deezer trop volumineuse');
  }

  const text = await response.text();
  if (text.length > 1_000_000) {
    throw new Error('Réponse Deezer trop volumineuse');
  }

  return JSON.parse(text);
}

function readCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function writeCache(key, value) {
  if (cache.size >= DEEZER.cacheMaxEntries) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
  cache.set(key, { value, expiresAt: Date.now() + DEEZER.cacheTtlMs });
}

export async function searchTracks(query = '', { limit = 25 } = {}) {
  const trimmed = typeof query === 'string' ? query.trim().slice(0, 100) : '';
  const url = trimmed
    ? `https://api.deezer.com/search?q=${encodeURIComponent(trimmed)}&limit=${limit}`
    : `https://api.deezer.com/chart/0/tracks?limit=${limit}`;
  const cacheKey = `search:${url}`;
  const cached = readCache(cacheKey);
  if (cached) return cached;

  const payload = await fetchJson(url);
  const tracks = (Array.isArray(payload?.data) ? payload.data : [])
    .map(normalizeTrack)
    .filter(Boolean)
    .map(({ id, title, artist, file_path, cover_url }) => ({
      id,
      title,
      artist,
      preview: file_path,
      cover: cover_url,
    }));

  writeCache(cacheKey, tracks);
  return tracks;
}

export async function getBotTracks(genre, limit, deadline = Infinity) {
  const artists = shuffle(GENRE_QUERIES[genre] || []);
  const tracks = [];

  for (const artist of artists.slice(0, 2)) {
    if (tracks.length >= limit || Date.now() >= deadline) break;
    try {
      const results = await searchTracks(artist, { limit: 25 });
      const candidates = shuffle(results)
        .map((track) => ({
          title: track.title,
          artist: track.artist,
          file_path: track.preview,
          cover_url: track.cover,
        }))
        .filter((track) => track.file_path);
      tracks.push(...candidates);
    } catch (error) {
      console.warn(`Deezer indisponible pour le bot (${artist}):`, error.message);
    }
  }

  const unique = uniqueBy(
    tracks,
    (track) => `${normalizeTitle(track.title)}::${normalizeTitle(track.artist)}`
  ).slice(0, limit);

  if (unique.length < limit) {
    for (const fallback of shuffle(BOT_TRACKS)) {
      if (unique.length >= limit) break;
      if (unique.some((track) => normalizeTitle(track.title) === normalizeTitle(fallback.title))) {
        continue;
      }
      try {
        unique.push({
          title: fallback.title,
          artist: fallback.artist,
          file_path: requireAudioUrl(fallback.file_path, 'filePath'),
          cover_url: null,
        });
      } catch {
        // Ignore an invalid catalog entry.
      }
    }
  }

  return unique.slice(0, limit);
}

export function buildBlindTestOptions(correctTrack, allTracks = []) {
  const correctTitle = normalizeTitle(correctTrack.title);
  const candidates = [];

  for (const track of allTracks) {
    if (track.id === correctTrack.id) continue;
    if (normalizeTitle(track.title) === correctTitle) continue;
    candidates.push({ title: track.title, artist: track.artist });
  }
  for (const track of BOT_TRACKS) {
    if (normalizeTitle(track.title) === correctTitle) continue;
    candidates.push({ title: track.title, artist: track.artist });
  }

  const options = uniqueBy(
    shuffle(candidates),
    (option) => normalizeTitle(option.title)
  ).slice(0, 3);

  options.push({ title: correctTrack.title, artist: correctTrack.artist });
  return shuffle(options);
}

export async function mapWithConcurrency(items, limit, callback) {
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await callback(items[index], index);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export function clearDeezerCache() {
  cache.clear();
}
