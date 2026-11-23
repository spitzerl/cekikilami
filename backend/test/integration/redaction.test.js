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

async function createBlindGame({ showVoteCount = false } = {}) {
  const host = await createSession(context.request, 'BlindHost');
  const guest = await joinSession(context.request, host.session.code, 'BlindGuest');
  const code = host.session.code;

  await context.request
    .post(`/api/sessions/${code}/config`)
    .set(auth(host.token))
    .send({
      maxMusicsPerPlayer: 1,
      selectionDuration: 30,
      extractDuration: 10,
      votingDuration: 20,
      enableBlindTest: true,
      showVoteCount,
    })
    .expect(200);

  await context.request.post(`/api/sessions/${code}/start-selection`).set(auth(host.token)).expect(200);

  for (const [token, title] of [[host.token, 'Host Secret'], [guest.token, 'Guest Secret']]) {
    await context.request
      .post(`/api/sessions/${code}/musics`)
      .set(auth(token))
      .send({
        title,
        artist: 'Secret Artist',
        deezerPreviewUrl: 'https://cdns-preview-e.dzcdn.net/stream/c-e12ac87d5b1b748f06f7ad86903f262b-6.mp3',
      })
      .expect(201);
  }

  await context.request.post(`/api/sessions/${code}/start-voting`).set(auth(host.token)).expect(200);
  const listening = await context.request
    .post(`/api/sessions/${code}/start-round`)
    .set(auth(host.token))
    .expect(200);

  return { host, guest, code, listening };
}

test('start-voting refuses to run from waiting and from an active vote', async () => {
  const created = await createSession(context.request, 'WaitingHost');
  await context.request
    .post(`/api/sessions/${created.session.code}/start-voting`)
    .set(auth(created.token))
    .expect(409);

  const game = await createBlindGame();
  await context.request
    .post(`/api/sessions/${game.code}/start-voting`)
    .set(auth(game.host.token))
    .expect(409);
});

test('listening state hides the answer, scores and live vote counts', async () => {
  const game = await createBlindGame({ showVoteCount: false });
  const state = game.listening.body;

  assert.equal(state.session.voting_status, 'listening');
  assert.equal(state.currentMusic.title, undefined);
  assert.equal(state.currentMusic.artist, undefined);
  assert.equal(state.currentMusic.player_id, undefined);
  assert.equal(state.currentMusic.cover_url, undefined);
  assert.equal(state.currentMusic.blind_test_options.length, 4);
  assert.deepEqual(state.currentMusic.blind_test_answers, []);
  assert.equal(state.votes, null);
  assert.ok(state.players.every((player) => !Object.hasOwn(player, 'score')));
  assert.ok(state.players.every((player) => !Object.hasOwn(player, 'votesReceived')));

  await context.request
    .get(`/api/sessions/${game.code}/results`)
    .set(auth(game.host.token))
    .expect(409);
  await context.request
    .post(`/api/sessions/${game.code}/finish`)
    .set(auth(game.guest.token))
    .expect(403);
});

test('blind answers hide correctness until the revelation', async () => {
  const game = await createBlindGame();
  const listening = game.listening.body;
  const answerToken = listening.currentMusic.is_proposer ? game.guest.token : game.host.token;
  const option = listening.currentMusic.blind_test_options[0];

  const answered = await context.request
    .post(`/api/sessions/${game.code}/blind-test-answers`)
    .set(auth(answerToken))
    .send({
      musicId: listening.currentMusic.id,
      answerTitle: option.title,
      answerArtist: option.artist,
    })
    .expect(200);

  assert.equal(answered.body.currentMusic.blind_test_answers.length, 1);
  assert.equal(answered.body.currentMusic.blind_test_answers[0].is_correct, undefined);
  assert.equal(answered.body.currentMusic.blind_test_answers[0].player_id, undefined);

  const voting = await context.request
    .post(`/api/sessions/${game.code}/advance-round`)
    .set(auth(game.host.token))
    .expect(200);
  assert.equal(voting.body.session.voting_status, 'voting');
  assert.equal(voting.body.currentMusic.title, undefined);
  assert.equal(voting.body.currentMusic.artist, undefined);
  assert.equal(voting.body.currentMusic.blind_test_options, undefined);
  assert.equal(voting.body.votes, null);

  const revelation = await context.request
    .post(`/api/sessions/${game.code}/advance-round`)
    .set(auth(game.host.token))
    .expect(200);
  assert.equal(revelation.body.session.voting_status, 'revelation');
  assert.ok(revelation.body.currentMusic.title);
  assert.ok(revelation.body.currentMusic.artist);
  assert.ok(revelation.body.currentMusic.player_id);
  assert.equal(revelation.body.currentMusic.blind_test_answers.length, 1);
  assert.equal(typeof revelation.body.currentMusic.blind_test_answers[0].is_correct, 'boolean');
});

test('results only expose scores after the host finishes the game', async () => {
  const game = await createBlindGame();
  const finish = await context.request
    .post(`/api/sessions/${game.code}/finish`)
    .set(auth(game.host.token))
    .expect(200);

  assert.equal(finish.body.session.phase, 'results');
  assert.ok(Array.isArray(finish.body.ranking));
  assert.ok(finish.body.ranking.every((player) => typeof player.score === 'number'));

  const results = await context.request
    .get(`/api/sessions/${game.code}/results`)
    .set(auth(game.guest.token))
    .expect(200);
  assert.equal(results.body.ranking.length, 2);
});

test('host reset clears the room and returns it to waiting', async () => {
  const game = await createBlindGame();
  await context.request
    .post(`/api/sessions/${game.code}/finish`)
    .set(auth(game.host.token))
    .expect(200);

  const reset = await context.request
    .post(`/api/sessions/${game.code}/reset`)
    .set(auth(game.host.token))
    .expect(200);
  assert.equal(reset.body.session.phase, 'waiting');
  assert.deepEqual(reset.body.musics, []);
  assert.equal(reset.body.session.current_music_index, -1);
});
