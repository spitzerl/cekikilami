import test from 'node:test';
import assert from 'node:assert/strict';
import { connectRedis } from '../../src/config/redis.js';

test('redis is optional when no URL is configured', async () => {
  const client = await connectRedis();
  assert.equal(client, null);
});
