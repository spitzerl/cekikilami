import test from 'node:test';
import assert from 'node:assert/strict';
import { clearAvatarCache, getAvatar } from '../../src/services/avatarService.js';

test('avatar proxy validates seeds and caches upstream PNG responses', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  globalThis.fetch = async () => {
    calls += 1;
    return new Response(png, {
      status: 200,
      headers: { 'content-type': 'image/png' },
    });
  };

  try {
    clearAvatarCache();
    const first = await getAvatar('safe_seed');
    const second = await getAvatar('safe_seed');
    assert.equal(calls, 1);
    assert.equal(first.contentType, 'image/png');
    assert.deepEqual(second.buffer, png);

    await assert.rejects(() => getAvatar('../bad'), /invalide/);
  } finally {
    globalThis.fetch = originalFetch;
    clearAvatarCache();
  }
});

test('avatar proxy rejects non-PNG upstream responses', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('<svg></svg>', {
    status: 200,
    headers: { 'content-type': 'image/svg+xml' },
  });

  try {
    clearAvatarCache();
    await assert.rejects(() => getAvatar('another_seed'), /invalide/);
  } finally {
    globalThis.fetch = originalFetch;
    clearAvatarCache();
  }
});
