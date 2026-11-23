import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateAvatarSeed,
  generatePlayerToken,
  generateSessionCode,
  hashToken,
} from '../../src/security/tokens.js';
import {
  isAllowedLocalUploadPath,
  requireAudioUrl,
  requireCoverUrl,
} from '../../src/security/media.js';
import { requireIntegerInRange, requirePlayerName } from '../../src/security/validation.js';
import { detectAudioExtension } from '../../src/services/uploadService.js';
import {
  buildBlindTestOptions,
  clearDeezerCache,
  mapWithConcurrency,
  searchTracks,
} from '../../src/services/deezerService.js';
import { normalizeTitle } from '../../src/utils/normalize.js';

test('player tokens are long random opaque values and stored as SHA-256 hashes', () => {
  const first = generatePlayerToken();
  const second = generatePlayerToken();
  assert.ok(first.length >= 40);
  assert.notEqual(first, second);
  assert.match(hashToken(first), /^[a-f0-9]{64}$/);
  assert.equal(hashToken(first), hashToken(first));
  assert.notEqual(hashToken(first), hashToken(second));
});

test('session codes keep the six-character unambiguous alphabet', () => {
  for (let index = 0; index < 100; index += 1) {
    assert.match(generateSessionCode(), /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  }
});

test('avatar seeds are non-empty URL-safe values', () => {
  const seed = generateAvatarSeed();
  assert.match(seed, /^[A-Za-z0-9_-]{8,}$/);
});

test('player names are trimmed, collapsed and bounded', () => {
  assert.equal(requirePlayerName('  Lucas   the   host  '), 'Lucas the host');
  assert.throws(() => requirePlayerName(''), /requis/);
  assert.throws(() => requirePlayerName('a'.repeat(40)), /trop long/);
});

test('config integers are bounded', () => {
  const bounds = { min: 4, max: 16 };
  assert.equal(requireIntegerInRange(8, 'maxPlayers', bounds), 8);
  assert.equal(requireIntegerInRange('12', 'maxPlayers', bounds), 12);
  assert.throws(() => requireIntegerInRange(3, 'maxPlayers', bounds), /entre 4 et 16/);
  assert.throws(() => requireIntegerInRange(17, 'maxPlayers', bounds), /entre 4 et 16/);
});

test('media allowlist accepts Deezer CDN URLs only', () => {
  const audio = 'https://cdns-preview-e.dzcdn.net/stream/c-abc-6.mp3';
  const cover = 'https://e-cdns-images.dzcdn.net/images/cover/abc/250x250.jpg';
  assert.equal(requireAudioUrl(audio), audio);
  assert.equal(requireCoverUrl(cover), cover);

  assert.throws(() => requireAudioUrl('http://cdns-preview-e.dzcdn.net/a.mp3'), /HTTPS/);
  assert.throws(() => requireAudioUrl('https://evil.example/a.mp3'), /extrait Deezer/);
  assert.throws(() => requireAudioUrl('https://127.0.0.1/a.mp3'), /adresse IP/);
  assert.throws(() => requireAudioUrl('https://cdns-preview-e.dzcdn.net:8443/a.mp3'), /port/);
  assert.throws(() => requireAudioUrl('https://user:pass@cdns-preview-e.dzcdn.net/a.mp3'), /identifiants/);
  assert.throws(() => requireCoverUrl('https://cdns-preview-e.dzcdn.net/a.mp3'), /pochette Deezer/);
});

test('local upload paths are tightly constrained', () => {
  const valid = `/uploads/${'a'.repeat(32)}.mp3`;
  assert.equal(isAllowedLocalUploadPath(valid), true);
  assert.equal(isAllowedLocalUploadPath(`/uploads/${'a'.repeat(32)}.exe`), false);
  assert.equal(isAllowedLocalUploadPath('/uploads/../etc/passwd'), false);
  assert.equal(isAllowedLocalUploadPath('/uploads/short.mp3'), false);
});

test('audio signature detection accepts MP3 and rejects text', async () => {
  const mp3 = Buffer.concat([
    Buffer.from('ID3\x04\x00\x00\x00\x00\x00\x00', 'binary'),
    Buffer.from([0xff, 0xfb, 0x90, 0x64]),
    Buffer.alloc(500, 0),
  ]);
  assert.equal(await detectAudioExtension(mp3), '.mp3');
  assert.equal(await detectAudioExtension(Buffer.from('not audio')), null);
  assert.equal(await detectAudioExtension(Buffer.alloc(0)), null);
});

test('blind-test options contain three unique decoys and the correct answer', () => {
  const correct = { id: 1, title: 'Correct Song', artist: 'Correct Artist' };
  const others = [
    { id: 2, title: 'Other One', artist: 'A' },
    { id: 3, title: 'Other Two', artist: 'B' },
    { id: 4, title: 'Other Three', artist: 'C' },
    { id: 5, title: 'Other One', artist: 'A' },
  ];
  const options = buildBlindTestOptions(correct, others);
  assert.equal(options.length, 4);
  assert.ok(options.some((option) => option.title === 'Correct Song'));
  const normalized = options.map((option) => normalizeTitle(option.title));
  assert.equal(new Set(normalized).size, options.length);
});

test('concurrency helper preserves result order', async () => {
  const results = await mapWithConcurrency([1, 2, 3, 4], 2, async (value) => value * 2);
  assert.deepEqual(results, [2, 4, 6, 8]);
});

test('Deezer search upgrades legacy HTTP CDN URLs before validation', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    data: [{
      id: 1,
      title: 'Legacy HTTP',
      artist: { name: 'Artist' },
      preview: 'http://cdns-preview-e.dzcdn.net/stream/legacy.mp3',
      album: { cover_medium: 'http://e-cdns-images.dzcdn.net/images/cover/legacy.jpg' },
    }],
  }), { status: 200, headers: { 'content-type': 'application/json' } });

  try {
    clearDeezerCache();
    const tracks = await searchTracks('legacy');
    assert.equal(tracks.length, 1);
    assert.match(tracks[0].preview, /^https:\/\//);
    assert.match(tracks[0].cover, /^https:\/\//);
  } finally {
    globalThis.fetch = originalFetch;
    clearDeezerCache();
  }
});
