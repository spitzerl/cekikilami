import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  auth,
  closeTestServer,
  connectSocket,
  createSession,
  createTestServer,
  joinSession,
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
