import test from 'node:test';
import assert from 'node:assert/strict';
import GameService from '../../src/services/GameService.js';

const service = new GameService();

function player(id, name) {
  return {
    id,
    name,
    created_at: '2026-01-01T00:00:00.000Z',
    is_observer: false,
    is_bot: false,
  };
}

function music(id, proposerId, playOrder) {
  return { id, player_id: proposerId, play_order: playOrder };
}

function vote(voterId, musicId, guessedPlayerId) {
  return { voter_id: voterId, music_id: musicId, guessed_player_id: guessedPlayerId };
}

function rank(data, options = {}) {
  return service.computeRanking(
    {
      session: {
        scoring_mode: data.mode || 'balanced',
        enable_blind_test: Boolean(data.blindTest),
      },
      players: data.players,
      musics: data.musics,
      votes: data.votes || [],
      blindTestAnswers: data.answers || [],
    },
    options
  );
}

test('detective mode only rewards correct accusations', () => {
  const ranking = rank({
    mode: 'detective',
    players: [player(1, 'Alice'), player(2, 'Bob'), player(3, 'Clara')],
    musics: [music(10, 1, 0)],
    votes: [
      vote(2, 10, 1),
      vote(3, 10, 2),
      vote(1, 10, 2),
    ],
  });

  const byId = new Map(ranking.map((entry) => [entry.id, entry]));
  assert.equal(byId.get(1).score, 0);
  assert.equal(byId.get(1).bluffPoints, 0);
  assert.equal(byId.get(2).score, 1);
  assert.equal(byId.get(2).correctAccusations, 1);
  assert.equal(byId.get(2).votesReceived, 1);
  assert.equal(byId.get(3).score, 0);
});

test('balanced mode rewards a proposer who stays hard to find', () => {
  const ranking = rank({
    mode: 'balanced',
    players: [player(1, 'Alice'), player(2, 'Bob'), player(3, 'Clara')],
    musics: [music(10, 1, 0)],
    votes: [vote(2, 10, 1), vote(3, 10, 2)],
  });

  const byId = new Map(ranking.map((entry) => [entry.id, entry]));
  assert.equal(byId.get(1).score, 2);
  assert.equal(byId.get(1).bluffPoints, 2);
  assert.equal(byId.get(1).timesFound, 1);
  assert.equal(byId.get(2).score, 3);
  assert.equal(byId.get(3).score, 0);
});

test('balanced mode gives no bluff points when nobody voted', () => {
  const ranking = rank({
    mode: 'balanced',
    players: [player(1, 'Alice'), player(2, 'Bob'), player(3, 'Clara')],
    musics: [music(10, 1, 0)],
    votes: [],
  });

  const alice = ranking.find((entry) => entry.id === 1);
  assert.equal(alice.bluffPoints, 0);
  assert.equal(alice.score, 0);
});

test('bluff mode rewards each fooled player up to the cap', () => {
  const ranking = rank({
    mode: 'bluff',
    players: [player(1, 'Alice'), player(2, 'Bob'), player(3, 'Clara'), player(4, 'David')],
    musics: [music(10, 1, 0)],
    votes: [vote(2, 10, 2), vote(3, 10, 3), vote(4, 10, 4)],
  });

  const alice = ranking.find((entry) => entry.id === 1);
  assert.equal(alice.bluffPoints, 3);
  assert.equal(alice.score, 3);
});

test('blind-test points are separate and never awarded to the proposer', () => {
  const ranking = rank({
    mode: 'balanced',
    blindTest: true,
    players: [player(1, 'Alice'), player(2, 'Bob'), player(3, 'Clara')],
    musics: [music(10, 1, 0)],
    votes: [vote(2, 10, 1), vote(3, 10, 2)],
    answers: [
      { player_id: 1, music_id: 10, is_correct: true },
      { player_id: 2, music_id: 10, is_correct: true },
      { player_id: 3, music_id: 10, is_correct: false },
    ],
  });

  const byId = new Map(ranking.map((entry) => [entry.id, entry]));
  assert.equal(byId.get(1).blindTestCorrect, 0);
  assert.equal(byId.get(2).blindTestCorrect, 1);
  assert.equal(byId.get(2).score, 4);
  assert.equal(byId.get(3).blindTestCorrect, 0);
});

test('live ranking only counts completed rounds', () => {
  const data = {
    mode: 'balanced',
    players: [player(1, 'Alice'), player(2, 'Bob'), player(3, 'Clara')],
    musics: [music(10, 1, 0), music(11, 2, 1)],
    votes: [vote(2, 10, 1), vote(3, 10, 2), vote(1, 11, 2), vote(3, 11, 2)],
  };

  const firstRound = rank(data, { maxPlayOrder: 0 });
  assert.equal(firstRound.find((entry) => entry.id === 1).score, 2);
  assert.equal(firstRound.find((entry) => entry.id === 2).score, 3);
  assert.equal(firstRound.find((entry) => entry.id === 3).score, 0);

  const secondRound = rank(data, { maxPlayOrder: 1 });
  assert.equal(secondRound.find((entry) => entry.id === 1).score, 5);
  assert.equal(secondRound.find((entry) => entry.id === 2).score, 4);
  assert.equal(secondRound.find((entry) => entry.id === 3).score, 3);
});

test('ties are shared only when every tie-break criterion is equal', () => {
  const ranking = rank({
    mode: 'detective',
    blindTest: true,
    players: [player(1, 'Alice'), player(2, 'Bob'), player(3, 'Clara')],
    musics: [music(10, 1, 0)],
    votes: [vote(2, 10, 1)],
    answers: [{ player_id: 3, music_id: 10, is_correct: true }],
  });

  const byId = new Map(ranking.map((entry) => [entry.id, entry]));
  assert.equal(byId.get(2).score, 1);
  assert.equal(byId.get(3).score, 1);
  assert.equal(byId.get(2).rank, 1);
  assert.equal(byId.get(3).rank, 2);
  assert.equal(byId.get(1).rank, 3);

  const allZero = rank({
    mode: 'detective',
    players: [player(1, 'Alice'), player(2, 'Bob')],
    musics: [music(10, 1, 0)],
    votes: [],
  });
  assert.equal(allZero.every((entry) => entry.rank === 1), true);
});
