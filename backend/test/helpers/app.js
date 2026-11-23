import { createServer } from 'node:http';
import path from 'node:path';
import { Server } from 'socket.io';
import supertest from 'supertest';
import { io as ioClient } from 'socket.io-client';
import createApp from '../../src/app.js';
import GameService from '../../src/services/GameService.js';
import registerGameSocket from '../../src/sockets/gameSocket.js';
import { initSchema } from '../../src/db/schema.js';
import pool from '../../src/config/database.js';
import { ensureUploadDir, UPLOAD_DIR } from '../../src/services/uploadService.js';

let schemaReady;

export async function prepareDatabase() {
  if (!schemaReady) {
    schemaReady = initSchema(pool);
  }
  await schemaReady;
  await ensureUploadDir();
}

export async function resetDatabase() {
  await prepareDatabase();
  await pool.query('TRUNCATE sessions RESTART IDENTITY CASCADE');
  await pool.query('TRUNCATE players RESTART IDENTITY CASCADE');
}

export async function createTestServer() {
  await prepareDatabase();

  const io = new Server({ cors: { origin: '*' } });
  const namespace = io.of('/game');
  const gameService = new GameService();
  gameService.setIoNamespace(namespace);
  registerGameSocket(namespace, gameService);

  const app = createApp(gameService, namespace);
  const server = createServer(app);
  io.attach(server);

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  return {
    io,
    namespace,
    gameService,
    app,
    server,
    port,
    baseUrl: `http://127.0.0.1:${port}`,
    request: supertest(app),
  };
}

export async function closeTestServer(context) {
  context.gameService.shutdown();
  context.io.close();
  await new Promise((resolve) => context.server.close(resolve));
}

export function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

export async function createSession(request, hostName = 'Host') {
  const response = await request
    .post('/api/sessions')
    .send({ hostName })
    .expect(201);
  return response.body;
}

export async function joinSession(request, code, playerName) {
  const response = await request
    .post(`/api/sessions/${code}/join`)
    .send({ playerName })
    .expect(201);
  return response.body;
}

export function connectSocket(baseUrl, token) {
  return ioClient(`${baseUrl}/game`, {
    transports: ['websocket'],
    reconnection: false,
    auth: { token },
  });
}

export function waitForEvent(socket, event, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeoutMs);

    function handler(payload) {
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    }

    socket.on(event, handler);
  });
}

export function uploadDir() {
  return UPLOAD_DIR;
}

export function testAudioBuffer() {
  return Buffer.concat([
    Buffer.from('ID3\x04\x00\x00\x00\x00\x00\x00', 'binary'),
    Buffer.from([0xff, 0xfb, 0x90, 0x64]),
    Buffer.alloc(2000, 0),
  ]);
}

export function testTinyAudioBuffer() {
  return Buffer.concat([
    Buffer.from('ID3\x04\x00\x00\x00\x00\x00\x00', 'binary'),
    Buffer.from([0xff, 0xfb, 0x90, 0x64]),
    Buffer.alloc(32, 0),
  ]);
}

export function mockDeezerAudioFetch(buffer = testTinyAudioBuffer()) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    let hostname = '';
    try {
      hostname = new URL(String(input)).hostname;
    } catch {
      // Not an absolute URL; let the original implementation decide.
    }
    if (hostname.endsWith('.dzcdn.net')) {
      return new Response(buffer, {
        status: 200,
        headers: { 'content-type': 'audio/mpeg' },
      });
    }
    return originalFetch(input, init);
  };
  return () => {
    globalThis.fetch = originalFetch;
  };
}

export function testUploadPath(filename) {
  return path.join(UPLOAD_DIR, filename);
}
