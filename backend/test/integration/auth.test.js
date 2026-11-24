import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  auth,
  closeTestServer,
  createSession,
  createTestServer,
  joinSession,
  mockDeezerAudioFetch,
  resetDatabase,
} from '../helpers/app.js';
import pool from '../../src/config/database.js';

let context;
let restoreFetch;

before(async () => {
  context = await createTestServer();
  restoreFetch = mockDeezerAudioFetch();
});

after(async () => {
  restoreFetch?.();
  await closeTestServer(context);
});

beforeEach(async () => {
  await resetDatabase();
});

test('session state requires a player token but the summary stays public', async () => {
  const summary = await context.request.get('/api/sessions/UNKNOWN/summary').expect(404);
  assert.equal(summary.body.error, 'Session introuvable');

  const created = await createSession(context.request, 'Host');
  assert.ok(created.token);
  assert.equal(created.host.token_hash, undefined);

  const publicSummary = await context.request
    .get(`/api/sessions/${created.session.code}/summary`)
    .expect(200);
  assert.equal(publicSummary.body.session.code, created.session.code);
  assert.equal(publicSummary.body.playerCount, 1);
  assert.equal(publicSummary.body.isJoinable, true);

  await context.request.get(`/api/sessions/${created.session.code}`).expect(401);
  const state = await context.request
    .get(`/api/sessions/${created.session.code}`)
    .set(auth(created.token))
    .expect(200);
  assert.equal(state.body.player.name, 'Host');
});

test('join issues per-player tokens and only the matching token can reconnect', async () => {
  const created = await createSession(context.request, 'Host');
  const guest = await joinSession(context.request, created.session.code, 'Guest');

  assert.ok(guest.token);
  assert.notEqual(guest.token, created.token);
  assert.equal(guest.player.token_hash, undefined);

  const reconnect = await context.request
    .post(`/api/sessions/${created.session.code}/join`)
    .set(auth(guest.token))
    .send({ playerName: 'Guest' })
    .expect(201);
  assert.equal(reconnect.body.player.id, guest.player.id);

  const takeover = await context.request
    .post(`/api/sessions/${created.session.code}/join`)
    .send({ playerName: 'Guest' })
    .expect(409);
  assert.match(takeover.body.error, /déjà utilisé/);
});

test('the current session endpoint lets a player resume an ongoing game', async () => {
  const created = await createSession(context.request, 'Host');
  const guest = await joinSession(context.request, created.session.code, 'Guest');

  await context.request.get('/api/sessions/current').expect(401);

  const current = await context.request
    .get('/api/sessions/current')
    .set(auth(guest.token))
    .expect(200);
  assert.equal(current.body.session.code, created.session.code);
  assert.equal(current.body.player.id, guest.player.id);
  assert.equal(current.body.player.name, 'Guest');

  await context.request
    .post(`/api/sessions/${created.session.code}/start-selection`)
    .set(auth(created.token))
    .expect(200);

  const running = await context.request
    .get('/api/sessions/current')
    .set(auth(guest.token))
    .expect(200);
  assert.equal(running.body.session.phase, 'selection');
});

test('guest calls to host-only lifecycle routes are rejected', async () => {
  const created = await createSession(context.request, 'Host');
  const guest = await joinSession(context.request, created.session.code, 'Guest');
  const code = created.session.code;

  await context.request
    .post(`/api/sessions/${code}/config`)
    .set(auth(guest.token))
    .send({ maxPlayers: 8 })
    .expect(403);
  await context.request.post(`/api/sessions/${code}/bots`).set(auth(guest.token)).expect(403);
  await context.request.post(`/api/sessions/${code}/start-selection`).set(auth(guest.token)).expect(403);
  await context.request.post(`/api/sessions/${code}/start-voting`).set(auth(guest.token)).expect(403);
  await context.request.post(`/api/sessions/${code}/start-round`).set(auth(guest.token)).expect(403);
  await context.request.post(`/api/sessions/${code}/advance-round`).set(auth(guest.token)).expect(403);
  await context.request.post(`/api/sessions/${code}/finish`).set(auth(guest.token)).expect(403);
  await context.request.post(`/api/sessions/${code}/reset`).set(auth(guest.token)).expect(403);
  await context.request
    .post(`/api/sessions/${code}/players/${guest.player.id}/promote`)
    .set(auth(guest.token))
    .expect(403);
  await context.request
    .post(`/api/sessions/${code}/players/${created.host.id}/kick`)
    .set(auth(guest.token))
    .expect(403);

  const config = await context.request
    .post(`/api/sessions/${code}/config`)
    .set(auth(created.token))
    .send({ maxPlayers: 8, maxMusicsPerPlayer: 2 })
    .expect(200);
  assert.equal(config.body.session.max_players, 8);
});

test('host promotion and kick are bound to authenticated player ids', async () => {
  const created = await createSession(context.request, 'Host');
  const guest = await joinSession(context.request, created.session.code, 'Guest');
  const code = created.session.code;

  const promoted = await context.request
    .post(`/api/sessions/${code}/players/${guest.player.id}/promote`)
    .set(auth(created.token))
    .expect(200);
  assert.equal(promoted.body.session.host_player_id, guest.player.id);
  assert.equal(promoted.body.session.host_name, 'Guest');

  await context.request
    .post(`/api/sessions/${code}/config`)
    .set(auth(created.token))
    .send({ maxPlayers: 8 })
    .expect(403);
  await context.request
    .post(`/api/sessions/${code}/config`)
    .set(auth(guest.token))
    .send({ maxPlayers: 8 })
    .expect(200);

  await context.request
    .post(`/api/sessions/${code}/players/${created.host.id}/kick`)
    .set(auth(guest.token))
    .expect(200);
  await context.request.get(`/api/sessions/${code}`).set(auth(created.token)).expect(401);
});

test('avatar regeneration is self-only and session-scoped', async () => {
  const created = await createSession(context.request, 'Host');
  const guest = await joinSession(context.request, created.session.code, 'Guest');
  const code = created.session.code;

  await context.request
    .post(`/api/sessions/${code}/players/${guest.player.id}/avatar`)
    .set(auth(created.token))
    .expect(403);
  const self = await context.request
    .post(`/api/sessions/${code}/players/${created.host.id}/avatar`)
    .set(auth(created.token))
    .expect(200);
  assert.notEqual(self.body.player.avatar_seed, created.host.avatar_seed);
});

test('music deletion is scoped to the route session and owner', async () => {
  const victim = await createSession(context.request, 'VictimHost');
  const victimGuest = await joinSession(context.request, victim.session.code, 'VictimGuest');
  await context.request
    .post(`/api/sessions/${victim.session.code}/config`)
    .set(auth(victim.token))
    .send({ maxMusicsPerPlayer: 1 })
    .expect(200);
  await context.request
    .post(`/api/sessions/${victim.session.code}/start-selection`)
    .set(auth(victim.token))
    .expect(200);
  const music = await context.request
    .post(`/api/sessions/${victim.session.code}/musics`)
    .set(auth(victim.token))
    .send({
      title: 'Victim Track',
      artist: 'Victim Artist',
      deezerPreviewUrl: 'https://cdns-preview-e.dzcdn.net/stream/c-e12ac87d5b1b748f06f7ad86903f262b-6.mp3',
    })
    .expect(201);

  const attacker = await createSession(context.request, 'AttackerHost');
  await context.request
    .post(`/api/sessions/${attacker.session.code}/config`)
    .set(auth(attacker.token))
    .send({ maxMusicsPerPlayer: 1 })
    .expect(200);
  await context.request
    .post(`/api/sessions/${attacker.session.code}/start-selection`)
    .set(auth(attacker.token))
    .expect(200);

  await context.request
    .delete(`/api/sessions/${attacker.session.code}/musics/${music.body.id}`)
    .set(auth(attacker.token))
    .expect(404);

  await context.request
    .delete(`/api/sessions/${victim.session.code}/musics/${music.body.id}`)
    .set(auth(victimGuest.token))
    .expect(404);

  const victimState = await context.request
    .get(`/api/sessions/${victim.session.code}`)
    .set(auth(victim.token))
    .expect(200);
  assert.equal(victimState.body.musics.length, 1);

  await context.request
    .delete(`/api/sessions/${victim.session.code}/musics/${music.body.id}`)
    .set(auth(victim.token))
    .expect(200);
});

test('votes use the authenticated player id even when the body names someone else', async () => {
  const created = await createSession(context.request, 'Host');
  const guest = await joinSession(context.request, created.session.code, 'Guest');
  const code = created.session.code;

  await context.request
    .post(`/api/sessions/${code}/config`)
    .set(auth(created.token))
    .send({ maxMusicsPerPlayer: 1, extractDuration: 10, votingDuration: 20 })
    .expect(200);
  await context.request.post(`/api/sessions/${code}/start-selection`).set(auth(created.token)).expect(200);

  for (const [token, title] of [[created.token, 'Host Song'], [guest.token, 'Guest Song']]) {
    await context.request
      .post(`/api/sessions/${code}/musics`)
      .set(auth(token))
      .send({
        title,
        artist: 'Artist',
        deezerPreviewUrl: 'https://cdns-preview-e.dzcdn.net/stream/c-e12ac87d5b1b748f06f7ad86903f262b-6.mp3',
      })
      .expect(201);
  }

  await context.request.post(`/api/sessions/${code}/start-voting`).set(auth(created.token)).expect(200);
  await context.request.post(`/api/sessions/${code}/start-round`).set(auth(created.token)).expect(200);
  const voting = await context.request
    .post(`/api/sessions/${code}/advance-round`)
    .set(auth(created.token))
    .expect(200);
  const musicId = voting.body.currentMusic.id;

  await context.request
    .post(`/api/sessions/${code}/votes`)
    .set(auth(guest.token))
    .send({ musicId, guessedPlayerId: created.host.id, voterId: created.host.id })
    .expect(200);

  const result = await pool.query(
    'SELECT voter_id, guessed_player_id FROM votes WHERE music_id = $1',
    [musicId]
  );
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].voter_id, guest.player.id);
  assert.equal(result.rows[0].guessed_player_id, created.host.id);
});
