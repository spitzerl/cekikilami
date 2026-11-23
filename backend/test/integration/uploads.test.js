import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  auth,
  closeTestServer,
  createSession,
  createTestServer,
  resetDatabase,
  testAudioBuffer,
  uploadDir,
} from '../helpers/app.js';

let context;

function listUploads() {
  return fs.readdirSync(uploadDir()).filter((entry) => entry !== '.gitkeep');
}

function cleanUploads() {
  fs.rmSync(uploadDir(), { recursive: true, force: true });
  fs.mkdirSync(uploadDir(), { recursive: true });
}

before(async () => {
  context = await createTestServer();
});

after(async () => {
  await closeTestServer(context);
});

beforeEach(async () => {
  await resetDatabase();
  cleanUploads();
});

async function startSelectionSession(hostName = 'UploadHost') {
  const created = await createSession(context.request, hostName);
  await context.request
    .post(`/api/sessions/${created.session.code}/config`)
    .set(auth(created.token))
    .send({ maxMusicsPerPlayer: 2, selectionDuration: 30 })
    .expect(200);
  await context.request
    .post(`/api/sessions/${created.session.code}/start-selection`)
    .set(auth(created.token))
    .expect(200);
  return created;
}

test('unauthenticated and invalid-session uploads write nothing', async () => {
  const created = await createSession(context.request, 'Host');
  const buffer = testAudioBuffer();

  await context.request
    .post(`/api/sessions/${created.session.code}/musics`)
    .field('title', 'No Auth')
    .field('artist', 'Nobody')
    .attach('audio', buffer, 'noauth.mp3')
    .expect(401);
  assert.equal(listUploads().length, 0);

  await context.request
    .post('/api/sessions/ZZZZZZ/musics')
    .set(auth(created.token))
    .field('title', 'Missing')
    .field('artist', 'Nobody')
    .attach('audio', buffer, 'missing.mp3')
    .expect(404);
  assert.equal(listUploads().length, 0);
});

test('invalid audio content is rejected before a durable file is kept', async () => {
  const created = await startSelectionSession();

  await context.request
    .post(`/api/sessions/${created.session.code}/musics`)
    .set(auth(created.token))
    .field('title', 'Bad')
    .field('artist', 'Bad')
    .attach('audio', Buffer.from('this is not audio'), 'bad.txt')
    .expect(400);

  assert.equal(listUploads().length, 0);
});

test('valid uploads are written, served and removed with the music row', async () => {
  const created = await startSelectionSession();

  const response = await context.request
    .post(`/api/sessions/${created.session.code}/musics`)
    .set(auth(created.token))
    .field('title', 'Good')
    .field('artist', 'Good Artist')
    .attach('audio', testAudioBuffer(), 'good.mp3')
    .expect(201);

  const filename = path.basename(response.body.file_path);
  assert.match(filename, /^[a-f0-9]{32}\.mp3$/);
  assert.equal(listUploads().includes(filename), true);

  await context.request
    .delete(`/api/sessions/${created.session.code}/musics/${response.body.id}`)
    .set(auth(created.token))
    .expect(200);

  assert.equal(fs.existsSync(path.join(uploadDir(), filename)), false);
  assert.equal(listUploads().length, 0);
});

test('a failed quota check removes the freshly written file', async () => {
  const created = await startSelectionSession();

  await context.request
    .post(`/api/sessions/${created.session.code}/musics`)
    .set(auth(created.token))
    .field('title', 'First')
    .field('artist', 'First Artist')
    .attach('audio', testAudioBuffer(), 'first.mp3')
    .expect(201);

  await context.request
    .post(`/api/sessions/${created.session.code}/musics`)
    .set(auth(created.token))
    .field('title', 'Second')
    .field('artist', 'Second Artist')
    .attach('audio', testAudioBuffer(), 'second.mp3')
    .expect(409);

  assert.equal(listUploads().length, 1);
});

test('reset deletes the uploaded files along with the rows', async () => {
  const created = await startSelectionSession();
  const response = await context.request
    .post(`/api/sessions/${created.session.code}/musics`)
    .set(auth(created.token))
    .field('title', 'Reset Me')
    .field('artist', 'Artist')
    .attach('audio', testAudioBuffer(), 'reset.mp3')
    .expect(201);
  const filename = path.basename(response.body.file_path);
  assert.equal(listUploads().includes(filename), true);

  await context.request
    .post(`/api/sessions/${created.session.code}/reset`)
    .set(auth(created.token))
    .expect(200);

  assert.equal(fs.existsSync(path.join(uploadDir(), filename)), false);
  assert.equal(listUploads().length, 0);
});
