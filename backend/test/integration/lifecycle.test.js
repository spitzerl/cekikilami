import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  auth,
  closeTestServer,
  createSession,
  createTestServer,
  joinSession,
  resetDatabase,
  testAudioBuffer,
} from '../helpers/app.js';
import pool from '../../src/config/database.js';
import { APP_VERSION } from '../../src/config/version.js';
import { clearDeezerCache } from '../../src/services/deezerService.js';

let context;

before(async () => {
  context = await createTestServer();
});

after(async () => {
  await closeTestServer(context);
});

beforeEach(async () => {
  await resetDatabase();
});

test('session codes keep the expected format', async () => {
  const created = await createSession(context.request, 'Host');
  assert.match(created.session.code, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
});

test('the API and health endpoints expose the current beta version', async () => {
  const version = await context.request.get('/api/version').expect(200);
  assert.equal(version.body.version, APP_VERSION);
  assert.equal(version.body.channel, 'beta');

  const health = await context.request.get('/health').expect(200);
  assert.equal(health.body.ok, true);
  assert.equal(health.body.version, APP_VERSION);
});

test('configuration values are bounded server-side', async () => {
  const created = await createSession(context.request, 'Host');
  const code = created.session.code;

  for (const payload of [
    { maxPlayers: 3 },
    { maxPlayers: 17 },
    { maxMusicsPerPlayer: 0 },
    { maxMusicsPerPlayer: 6 },
    { selectionDuration: 5 },
    { selectionDuration: 301 },
    { extractDuration: 5 },
    { votingDuration: 300 },
    { showAnswers: 'yes' },
    { scoringMode: 'unknown' },
    { showScoreboard: 'yes' },
    { trackInfoMode: 'sometimes' },
  ]) {
    await context.request
      .post(`/api/sessions/${code}/config`)
      .set(auth(created.token))
      .send(payload)
      .expect(400);
  }

  const valid = await context.request
    .post(`/api/sessions/${code}/config`)
    .set(auth(created.token))
    .send({
      maxPlayers: 4,
      maxMusicsPerPlayer: 5,
      selectionDuration: 300,
      extractDuration: 30,
      votingDuration: 60,
      scoringMode: 'detective',
      showScoreboard: false,
      trackInfoMode: 'before',
    })
    .expect(200);
  assert.equal(valid.body.session.max_players, 4);
  assert.equal(valid.body.session.max_musics_per_player, 5);
  assert.equal(valid.body.session.scoring_mode, 'detective');
  assert.equal(valid.body.session.show_scoreboard, false);
  assert.equal(valid.body.session.track_info_mode, 'before');
});

test('maxPlayers cannot fall below the current player count', async () => {
  const created = await createSession(context.request, 'Host');
  for (let index = 0; index < 4; index += 1) {
    await joinSession(context.request, created.session.code, `Guest${index}`);
  }

  await context.request
    .post(`/api/sessions/${created.session.code}/config`)
    .set(auth(created.token))
    .send({ maxPlayers: 4 })
    .expect(409);
});

test('the global session cap rejects new rooms', async () => {
  for (let index = 0; index < 5; index += 1) {
    await createSession(context.request, `Host${index}`);
  }

  await context.request
    .post('/api/sessions')
    .send({ hostName: 'Overflow' })
    .expect(503);
});

test('phase guards reject impossible transitions', async () => {
  const created = await createSession(context.request, 'Host');
  await context.request
    .post(`/api/sessions/${created.session.code}/start-voting`)
    .set(auth(created.token))
    .expect(409);
  await context.request
    .post(`/api/sessions/${created.session.code}/start-round`)
    .set(auth(created.token))
    .expect(409);
  await context.request
    .post(`/api/sessions/${created.session.code}/advance-round`)
    .set(auth(created.token))
    .expect(409);
  await context.request
    .post(`/api/sessions/${created.session.code}/finish`)
    .set(auth(created.token))
    .expect(409);
});

test('joining is refused once a game has started', async () => {
  const created = await createSession(context.request, 'Host');
  await context.request
    .post(`/api/sessions/${created.session.code}/start-selection`)
    .set(auth(created.token))
    .expect(200);

  await context.request
    .post(`/api/sessions/${created.session.code}/join`)
    .send({ playerName: 'LateGuest' })
    .expect(409);
});

test('bot generation is bounded and uses the cached Deezer helper', async () => {
  const created = await createSession(context.request, 'Host');
  const botState = await context.request
    .post(`/api/sessions/${created.session.code}/bots`)
    .set(auth(created.token))
    .expect(200);
  const bot = botState.body.players.find((player) => player.is_bot);
  assert.ok(bot);

  await context.request
    .post(`/api/sessions/${created.session.code}/config`)
    .set(auth(created.token))
    .send({ maxMusicsPerPlayer: 1 })
    .expect(200);

  const originalFetch = globalThis.fetch;
  let searchCalls = 0;
  globalThis.fetch = async (url) => {
    if (String(url).startsWith('https://api.deezer.com/')) {
      searchCalls += 1;
      return new Response(JSON.stringify({
        data: [{
          id: 123,
          title: 'Bot Track',
          artist: { name: 'Bot Artist' },
          preview: 'https://cdns-preview-e.dzcdn.net/stream/bot.mp3',
          album: { cover_medium: 'https://e-cdns-images.dzcdn.net/images/cover/bot.jpg' },
        }],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response(testAudioBuffer(), {
      status: 200,
      headers: { 'content-type': 'audio/mpeg' },
    });
  };

  try {
    clearDeezerCache();
    await context.request
      .post(`/api/sessions/${created.session.code}/start-selection`)
      .set(auth(created.token))
      .expect(200);
    assert.ok(searchCalls <= 2);
  } finally {
    globalThis.fetch = originalFetch;
    clearDeezerCache();
  }

  const result = await pool.query('SELECT COUNT(*)::INTEGER AS count FROM musics WHERE player_id = $1', [bot.id]);
  assert.equal(result.rows[0].count, 1);
});

test('the reaper removes expired sessions', async () => {
  const created = await createSession(context.request, 'ExpiringHost');
  await pool.query(
    "UPDATE sessions SET expires_at = NOW() - INTERVAL '1 second' WHERE code = $1",
    [created.session.code]
  );

  await context.gameService.reapExpiredSessions();

  const result = await pool.query('SELECT COUNT(*)::INTEGER AS count FROM sessions WHERE code = $1', [
    created.session.code,
  ]);
  assert.equal(result.rows[0].count, 0);
});
