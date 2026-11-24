import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  auth,
  closeTestServer,
  connectSocket,
  createSession,
  createTestServer,
  joinSession,
  mockDeezerAudioFetch,
  resetDatabase,
  waitForEvent,
} from '../helpers/app.js';
import pool from '../../src/config/database.js';

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

test('socket handshake requires a valid player token', async () => {
  const anonymous = connectSocket(context.baseUrl, undefined);
  const error = await waitForEvent(anonymous, 'connect_error');
  assert.match(error.message, /Authentification requise/);
  anonymous.close();

  const invalid = connectSocket(context.baseUrl, 'not-a-real-token');
  const invalidError = await waitForEvent(invalid, 'connect_error');
  assert.match(invalidError.message, /invalide/);
  invalid.close();
});

test('malformed and mismatched joins are rejected without killing the process', async () => {
  const created = await createSession(context.request, 'SocketHost');
  const socket = connectSocket(context.baseUrl, created.token);
  await waitForEvent(socket, 'connect');

  socket.emit('join');
  const malformed = await waitForEvent(socket, 'game:error');
  assert.match(malformed.message, /invalide/);

  socket.emit('join', { code: 'WRONG1' });
  const wrongRoom = await waitForEvent(socket, 'game:error');
  assert.match(wrongRoom.message, /introuvable/);

  const statePromise = waitForEvent(socket, 'state:update');
  socket.emit('join', { code: created.session.code });
  const state = await statePromise;
  assert.equal(state.session.code, created.session.code);
  assert.equal(state.player.name, 'SocketHost');

  const health = await context.request.get('/health').expect(200);
  assert.equal(health.body.ok, true);
  socket.close();
  await new Promise((resolve) => setTimeout(resolve, 100));
});

test('a waiting host that disconnects alone schedules room deletion', async () => {
  const created = await createSession(context.request, 'LeavingHost');
  const socket = connectSocket(context.baseUrl, created.token);
  await waitForEvent(socket, 'connect');
  const statePromise = waitForEvent(socket, 'state:update');
  socket.emit('join', { code: created.session.code });
  await statePromise;

  socket.close();

  await new Promise((resolve) => setTimeout(resolve, 400));
  const result = await pool.query('SELECT COUNT(*)::INTEGER AS count FROM sessions WHERE code = $1', [
    created.session.code,
  ]);
  assert.equal(result.rows[0].count, 0);
});

test('a waiting host that loses the connection keeps the room for a resume', async () => {
  const created = await createSession(context.request, 'ReconnectingHost');
  const socket = connectSocket(context.baseUrl, created.token);
  await waitForEvent(socket, 'connect');
  const statePromise = waitForEvent(socket, 'state:update');
  socket.emit('join', { code: created.session.code });
  await statePromise;

  // Closing the transport mimics a closed tab or a network loss, which does
  // not send an explicit disconnect packet.
  socket.io.engine.close();

  await new Promise((resolve) => setTimeout(resolve, 400));
  const result = await pool.query('SELECT COUNT(*)::INTEGER AS count FROM sessions WHERE code = $1', [
    created.session.code,
  ]);
  assert.equal(result.rows[0].count, 1);
});

test('a waiting host that disconnects transfers the lead to another player', async () => {
  const created = await createSession(context.request, 'LeavingHost');
  const guest = await joinSession(context.request, created.session.code, 'NextHost');
  const code = created.session.code;

  const hostSocket = connectSocket(context.baseUrl, created.token);
  await waitForEvent(hostSocket, 'connect');
  const hostState = waitForEvent(hostSocket, 'state:update');
  hostSocket.emit('join', { code });
  await hostState;

  const guestSocket = connectSocket(context.baseUrl, guest.token);
  await waitForEvent(guestSocket, 'connect');
  const guestState = waitForEvent(guestSocket, 'state:update');
  guestSocket.emit('join', { code });
  await guestState;

  hostSocket.close();

  await new Promise((resolve) => setTimeout(resolve, 400));
  const result = await pool.query(
    'SELECT host_player_id, host_name FROM sessions WHERE code = $1',
    [code]
  );
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].host_player_id, guest.player.id);
  assert.equal(result.rows[0].host_name, 'NextHost');
  guestSocket.close();
});

test('a disconnected player with submitted tracks can reconnect and vote', async () => {
  const restoreFetch = mockDeezerAudioFetch();
  try {
    const created = await createSession(context.request, 'Host');
    const guest = await joinSession(context.request, created.session.code, 'Guest');
    const code = created.session.code;

    const hostSocket = connectSocket(context.baseUrl, created.token);
    await waitForEvent(hostSocket, 'connect');
    const hostState = waitForEvent(hostSocket, 'state:update');
    hostSocket.emit('join', { code });
    await hostState;

    const guestSocket = connectSocket(context.baseUrl, guest.token);
    await waitForEvent(guestSocket, 'connect');
    const guestState = waitForEvent(guestSocket, 'state:update');
    guestSocket.emit('join', { code });
    await guestState;

    await context.request
      .post(`/api/sessions/${code}/config`)
      .set(auth(created.token))
      .send({ maxMusicsPerPlayer: 1, autoAdvance: false })
      .expect(200);
    await context.request
      .post(`/api/sessions/${code}/start-selection`)
      .set(auth(created.token))
      .expect(200);

    for (const [token, title] of [[created.token, 'Host Track'], [guest.token, 'Guest Track']]) {
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

    guestSocket.close();
    await new Promise((resolve) => setTimeout(resolve, 300));

    const disconnected = await pool.query(
      'SELECT is_connected FROM players WHERE id = $1',
      [guest.player.id]
    );
    assert.equal(disconnected.rows[0].is_connected, false);

    await context.request
      .post(`/api/sessions/${code}/start-voting`)
      .set(auth(created.token))
      .expect(200);

    const afterVotingStart = await pool.query(
      'SELECT is_observer FROM players WHERE id = $1',
      [guest.player.id]
    );
    assert.equal(afterVotingStart.rows[0].is_observer, false);

    const reconnected = connectSocket(context.baseUrl, guest.token);
    await waitForEvent(reconnected, 'connect');
    const reconnectedState = waitForEvent(reconnected, 'state:update');
    reconnected.emit('join', { code });
    const state = await reconnectedState;
    assert.equal(state.player.is_observer, false);

    await context.request
      .post(`/api/sessions/${code}/start-round`)
      .set(auth(created.token))
      .expect(200);
    const voting = await context.request
      .post(`/api/sessions/${code}/advance-round`)
      .set(auth(created.token))
      .expect(200);

    await context.request
      .post(`/api/sessions/${code}/votes`)
      .set(auth(guest.token))
      .send({ musicId: voting.body.currentMusic.id, guessedPlayerId: created.host.id })
      .expect(200);

    reconnected.close();
    hostSocket.close();
  } finally {
    restoreFetch();
  }
});

test('a host that disconnects during the game transfers the lead', async () => {
  const created = await createSession(context.request, 'LeavingHost');
  const guest = await joinSession(context.request, created.session.code, 'NextHost');
  const code = created.session.code;

  const hostSocket = connectSocket(context.baseUrl, created.token);
  await waitForEvent(hostSocket, 'connect');
  const hostState = waitForEvent(hostSocket, 'state:update');
  hostSocket.emit('join', { code });
  await hostState;

  const guestSocket = connectSocket(context.baseUrl, guest.token);
  await waitForEvent(guestSocket, 'connect');
  const guestState = waitForEvent(guestSocket, 'state:update');
  guestSocket.emit('join', { code });
  await guestState;

  await context.request
    .post(`/api/sessions/${code}/start-selection`)
    .set(auth(created.token))
    .expect(200);

  hostSocket.close();

  await new Promise((resolve) => setTimeout(resolve, 400));
  const result = await pool.query(
    'SELECT host_player_id FROM sessions WHERE code = $1',
    [code]
  );
  assert.equal(result.rows[0].host_player_id, guest.player.id);
  guestSocket.close();
});
