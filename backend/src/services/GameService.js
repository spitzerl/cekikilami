import crypto from 'node:crypto';
import { query } from '../config/database.js';
import Session from '../models/Session.js';
import Player from '../models/Player.js';
import Music from '../models/Music.js';
import { httpError } from '../security/errors.js';
import {
  generateAvatarSeed,
  generatePlayerToken,
  hashToken,
} from '../security/tokens.js';
import {
  normalizeSessionCode,
  requireBoolean,
  requireIntegerInRange,
  requireNonEmptyString,
  requirePlayerName,
} from '../security/validation.js';
import { requireCoverUrl, requireMusicSource } from '../security/media.js';
import {
  CONFIG_BOUNDS,
  DEEZER,
  HOST_DISCONNECT_GRACE_MS,
  MAINTENANCE_INTERVAL_MS,
  MAX_SESSIONS,
  SCORING,
  SCORING_MODES,
  SESSION_TTLS,
  TRACK_INFO_MODES,
  UPLOAD_LIMITS,
} from '../config/game.js';
import { BOT_NAMES_POOL, GENRE_QUERIES } from '../data/botCatalog.js';
import {
  buildBlindTestOptions,
  getBotTracks,
  mapWithConcurrency,
  saveTrackPreview,
} from './deezerService.js';
import { cleanupOrphanUploads, deleteUpload, deleteUploadsForMusics } from './uploadService.js';
import { shuffle } from '../utils/normalize.js';

const VALID_PHASES = ['waiting', 'selection', 'voting', 'results'];

function sanitizePlayer(player) {
  if (!player) return null;
  const { token_hash, ...safe } = player;
  return safe;
}

function publicSession(session) {
  if (!session) return null;
  const { expires_at, ...safe } = session;
  return safe;
}

function sanitizeOwnMusic(music) {
  return {
    id: music.id,
    title: music.title,
    artist: music.artist,
    file_path: music.file_path,
    cover_url: music.cover_url,
    created_at: music.created_at,
  };
}

function sessionLogTag(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex').slice(0, 8);
}

function pickNextHost(players, currentHostId) {
  return players
    .filter((player) => player.id !== currentHostId && !player.is_bot)
    .sort((first, second) => {
      if (first.is_connected !== second.is_connected) return first.is_connected ? -1 : 1;
      if (first.is_observer !== second.is_observer) return first.is_observer ? 1 : -1;
      return new Date(first.created_at) - new Date(second.created_at);
    })[0] || null;
}

function comparePlayersByScore(first, second) {
  if (second.score !== first.score) return second.score - first.score;
  if (second.correctAccusations !== first.correctAccusations) {
    return second.correctAccusations - first.correctAccusations;
  }
  if (second.bluffPoints !== first.bluffPoints) return second.bluffPoints - first.bluffPoints;
  if (second.blindTestCorrect !== first.blindTestCorrect) {
    return second.blindTestCorrect - first.blindTestCorrect;
  }
  return 0;
}

function playerIdOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export default class GameService {
  constructor() {
    this.ioNamespace = null;
    this.activeTimers = new Map();
    this.hostDisconnectTimeouts = new Map();
    this.botVoteTimers = new Map();
    this.maintenanceInterval = null;
    this.isReaping = false;
  }

  setIoNamespace(ioNamespace) {
    this.ioNamespace = ioNamespace;
  }

  log(code, message) {
    console.log(`[GAME LOG][${sessionLogTag(code)}][${new Date().toISOString()}]: ${message}`);
  }

  startTimer(code, durationSeconds, callback) {
    this.clearTimer(code);
    const delayMs = Math.max(0, durationSeconds * 1000);
    const endsAt = new Date(Date.now() + delayMs);

    const timeoutId = setTimeout(async () => {
      this.activeTimers.delete(code);
      try {
        await callback();
      } catch (error) {
        this.log(code, `Error in timer callback: ${error.message}`);
      }
    }, delayMs);

    this.activeTimers.set(code, { timeoutId, endsAt, callback });
    return endsAt;
  }

  clearTimer(code) {
    if (this.activeTimers.has(code)) {
      clearTimeout(this.activeTimers.get(code).timeoutId);
      this.activeTimers.delete(code);
    }
  }

  scheduleBotVote(code, delayMs, callback) {
    const timeoutId = setTimeout(async () => {
      const timers = this.botVoteTimers.get(code);
      if (timers) timers.delete(timeoutId);
      try {
        await callback();
      } catch {
        // A bot vote can legitimately lose the race with a phase change.
      }
    }, Math.max(0, delayMs));

    if (!this.botVoteTimers.has(code)) this.botVoteTimers.set(code, new Set());
    this.botVoteTimers.get(code).add(timeoutId);
  }

  clearBotVoteTimers(code) {
    const timers = this.botVoteTimers.get(code);
    if (!timers) return;
    for (const timeoutId of timers) clearTimeout(timeoutId);
    this.botVoteTimers.delete(code);
  }

  cancelHostDisconnect(code) {
    if (this.hostDisconnectTimeouts.has(code)) {
      clearTimeout(this.hostDisconnectTimeouts.get(code));
      this.hostDisconnectTimeouts.delete(code);
    }
  }

  scheduleHostDisconnect(code, delayMs = HOST_DISCONNECT_GRACE_MS) {
    this.cancelHostDisconnect(code);
    const timeoutId = setTimeout(async () => {
      try {
        const session = await Session.findByCode(code);
        if (!session) return;

        const players = await Player.findBySession(session.id);
        const host = players.find((player) => player.id === session.host_player_id);
        if (!host || host.is_connected) return;

        const successor = pickNextHost(players, host.id);
        if (!successor) {
          // A waiting room without another player has no one to hand over to.
          if (session.phase === 'waiting') {
            this.log(code, 'Host remained disconnected, deleting empty waiting room');
            await this.deleteSession(code, { reason: 'host-disconnect' });
          }
          return;
        }

        await Session.setHost(code, successor.id, successor.name);
        this.log(code, `Host remained disconnected, transferred lead to ${successor.name}`);
        await this.broadcastState(code);
      } catch (error) {
        console.error(`Error in host disconnect timeout for session ${sessionLogTag(code)}:`, error);
      } finally {
        this.hostDisconnectTimeouts.delete(code);
      }
    }, Math.max(0, delayMs));

    this.hostDisconnectTimeouts.set(code, timeoutId);
  }

  async broadcastState(code) {
    if (!this.ioNamespace) return;
    try {
      const data = await this.loadSessionState(code);
      const socketsInRoom = await this.ioNamespace.in(code).fetchSockets();
      await Promise.all(socketsInRoom.map(async (socket) => {
        try {
          socket.emit('state:update', this.buildStateForPlayer(data, socket.playerId));
        } catch {
          // Ignore a socket that disconnected during the broadcast.
        }
      }));
    } catch (error) {
      this.log(code, `Error in broadcasting state: ${error.message}`);
    }
  }

  async loadSessionState(code) {
    const session = await Session.findByCode(code);
    if (!session) throw httpError(404, 'Session introuvable');

    const [players, musics, votesResult, answersResult] = await Promise.all([
      Player.findBySession(session.id),
      Music.findBySession(session.id),
      query('SELECT * FROM votes WHERE session_id = $1', [session.id]),
      query('SELECT * FROM blind_test_answers WHERE session_id = $1', [session.id]),
    ]);

    return {
      session,
      players,
      musics,
      votes: votesResult.rows,
      blindTestAnswers: answersResult.rows,
    };
  }

  computeRanking(data, { maxPlayOrder = Infinity } = {}) {
    const scoring = SCORING[data.session.scoring_mode] || SCORING.balanced;
    const playerMap = new Map(data.players.map((player) => [player.id, {
      ...sanitizePlayer(player),
      score: 0,
      correctAccusations: 0,
      blindTestCorrect: 0,
      correctGuesses: 0,
      bluffPoints: 0,
      votesReceived: 0,
      timesFound: 0,
    }]));

    const trackStats = new Map();
    for (const music of data.musics) {
      if (!Number.isInteger(music.play_order)
        || music.play_order < 0
        || music.play_order > maxPlayOrder) continue;
      trackStats.set(music.id, {
        proposerId: music.player_id,
        votes: 0,
        found: 0,
      });
    }

    for (const vote of data.votes) {
      const track = trackStats.get(vote.music_id);
      if (!track || vote.voter_id === track.proposerId) continue;

      track.votes += 1;
      const guessed = playerMap.get(vote.guessed_player_id);
      if (guessed) guessed.votesReceived += 1;

      if (vote.guessed_player_id === track.proposerId) {
        track.found += 1;
        const voter = playerMap.get(vote.voter_id);
        if (voter) voter.correctAccusations += 1;
      }
    }

    for (const track of trackStats.values()) {
      if (track.votes === 0) continue;
      const proposer = playerMap.get(track.proposerId);
      if (!proposer) continue;

      proposer.timesFound += track.found;
      if (scoring.proposerMode === 'threeMinusFound') {
        proposer.bluffPoints += Math.max(0, scoring.proposerMax - track.found);
      } else if (scoring.proposerMode === 'perMiss') {
        proposer.bluffPoints += Math.min(scoring.proposerMax, track.votes - track.found);
      }
    }

    if (data.session.enable_blind_test) {
      for (const answer of data.blindTestAnswers) {
        if (!answer.is_correct) continue;
        const track = trackStats.get(answer.music_id);
        if (!track || track.proposerId === answer.player_id) continue;
        const player = playerMap.get(answer.player_id);
        if (player) player.blindTestCorrect += 1;
      }
    }

    for (const player of playerMap.values()) {
      player.correctGuesses = player.correctAccusations + player.blindTestCorrect;
      player.score = player.correctAccusations * scoring.correctAccusation
        + player.bluffPoints
        + player.blindTestCorrect * scoring.blindTest;
    }

    const ranking = Array.from(playerMap.values()).sort((first, second) => {
      const comparison = comparePlayersByScore(first, second);
      if (comparison !== 0) return comparison;
      return String(first.name).localeCompare(String(second.name), 'fr', { sensitivity: 'base' });
    });

    for (const player of ranking) {
      player.rank = 1 + ranking.filter((other) => comparePlayersByScore(other, player) < 0).length;
    }

    return ranking;
  }

  buildStateForPlayer(data, playerId = null) {
    const { session, players, musics, votes, blindTestAnswers } = data;
    const selfId = playerIdOrNull(playerId);
    const self = selfId ? players.find((player) => player.id === selfId) || null : null;
    const sanitizedPlayers = players.map(sanitizePlayer);
    const base = {
      session: publicSession(session),
      serverTime: new Date().toISOString(),
    };

    if (session.phase === 'waiting') {
      return {
        ...base,
        players: sanitizedPlayers,
        musics: [],
        player: sanitizePlayer(self),
      };
    }

    if (session.phase === 'selection') {
      const musicCounts = {};
      for (const player of players) {
        musicCounts[player.id] = musics.filter((music) => music.player_id === player.id).length;
      }
      return {
        ...base,
        players: sanitizedPlayers,
        musics: selfId
          ? musics.filter((music) => music.player_id === selfId).map(sanitizeOwnMusic)
          : [],
        musicCounts,
        player: sanitizePlayer(self),
      };
    }

    if (session.phase === 'voting') {
      const status = session.voting_status;
      // Only expose scores from completed rounds. The current round stays
      // hidden until the revelation so players cannot infer whether their
      // vote or blind-test answer was correct while they can still change it.
      const liveThrough = status === 'revelation'
        ? session.current_music_index
        : session.current_music_index - 1;
      const liveScores = liveThrough >= 0
        ? new Map(
          this.computeRanking(data, { maxPlayOrder: liveThrough })
            .map((player) => [player.id, player])
        )
        : new Map();

      const votingPlayers = sanitizedPlayers.map((player) => {
        const { score: _persistedScore, ...rest } = player;
        const live = liveScores.get(player.id);
        if (!live) return rest;
        return {
          ...rest,
          score: live.score,
          rank: live.rank,
          correctAccusations: live.correctAccusations,
          blindTestCorrect: live.blindTestCorrect,
          correctGuesses: live.correctGuesses,
          bluffPoints: live.bluffPoints,
          votesReceived: live.votesReceived,
          timesFound: live.timesFound,
        };
      });
      const currentTrack = musics.find((music) => music.play_order === session.current_music_index);
      const isReveal = status === 'revelation' && session.show_answers;
      const trackInfoMode = session.track_info_mode || 'after';
      const revealTrackInfo = trackInfoMode === 'before'
        ? (status === 'voting' || status === 'revelation')
        : trackInfoMode === 'after' && status === 'revelation';
      let currentMusic = null;
      let votesForCurrentMusic = null;

      if (currentTrack && status !== 'idle') {
        currentMusic = {
          id: currentTrack.id,
          file_path: currentTrack.file_path,
          round_total: musics.filter((music) => music.play_order >= 0).length,
          is_proposer: selfId === currentTrack.player_id,
        };

        if (status === 'listening') {
          if (session.enable_blind_test) {
            currentMusic.blind_test_options = currentTrack.blind_test_options || [];
          }
        } else if (revealTrackInfo) {
          currentMusic.title = currentTrack.title;
          currentMusic.artist = currentTrack.artist;
          currentMusic.cover_url = currentTrack.cover_url;
        }

        if (status === 'revelation' && isReveal) {
          currentMusic.player_id = currentTrack.player_id;
        }

        if (session.enable_blind_test) {
          const ownAnswers = blindTestAnswers.filter(
            (answer) => answer.music_id === currentTrack.id && answer.player_id === selfId
          );
          const visibleAnswers = isReveal && session.show_answers
            ? blindTestAnswers.filter((answer) => answer.music_id === currentTrack.id)
            : ownAnswers;

          currentMusic.blind_test_answers = visibleAnswers.map((answer) => ({
            id: answer.id,
            ...(isReveal && session.show_answers ? { player_id: answer.player_id } : {}),
            answer_title: answer.answer_title,
            answer_artist: answer.answer_artist,
            ...(isReveal ? { is_correct: answer.is_correct } : {}),
          }));
        }

        const currentVotes = votes.filter((vote) => vote.music_id === currentTrack.id);
        if (status === 'voting' && session.show_vote_count) {
          const voteCounts = {};
          for (const player of players) voteCounts[player.id] = 0;
          for (const vote of currentVotes) {
            if (voteCounts[vote.guessed_player_id] !== undefined) {
              voteCounts[vote.guessed_player_id] += 1;
            }
          }
          votesForCurrentMusic = voteCounts;
        } else if (isReveal) {
          votesForCurrentMusic = currentVotes.map((vote) => ({
            id: vote.id,
            music_id: vote.music_id,
            voter_id: vote.voter_id,
            guessed_player_id: vote.guessed_player_id,
          }));
        }
      }

      return {
        ...base,
        players: votingPlayers,
        currentMusic,
        votes: votesForCurrentMusic,
        player: selfId ? (votingPlayers.find((player) => player.id === selfId) || null) : null,
      };
    }

    if (session.phase === 'results') {
      const ranking = this.computeRanking(data);
      const selfRanked = selfId ? ranking.find((player) => player.id === selfId) || null : null;
      return {
        ...base,
        players: ranking,
        musics,
        votes,
        ranking,
        player: selfRanked,
      };
    }

    throw httpError(500, 'Phase de session invalide');
  }

  async getState(code, playerId = null) {
    const normalizedCode = normalizeSessionCode(code);
    const data = await this.loadSessionState(normalizedCode);
    return this.buildStateForPlayer(data, playerId);
  }

  async getCurrentSession(playerId) {
    const player = await Player.findById(playerId);
    if (!player) throw httpError(404, 'Joueur introuvable');

    const session = await Session.findById(player.session_id);
    if (!session) throw httpError(404, 'Session introuvable');

    return {
      session: publicSession(session),
      player: sanitizePlayer(player),
      serverTime: new Date().toISOString(),
    };
  }

  async getSessionSummary(code) {
    const normalizedCode = normalizeSessionCode(code);
    const session = await Session.findByCode(normalizedCode);
    if (!session) throw httpError(404, 'Session introuvable');
    const players = await Player.findBySession(session.id);
    return {
      session: publicSession(session),
      playerCount: players.length,
      isJoinable: session.phase === 'waiting' && players.length < session.max_players,
    };
  }

  async assertHost(code, actorId) {
    const normalizedCode = normalizeSessionCode(code);
    const session = await Session.findByCode(normalizedCode);
    if (!session) throw httpError(404, 'Session introuvable');
    if (!Number.isInteger(actorId) || session.host_player_id !== actorId) {
      throw httpError(403, 'Seul l’hôte peut effectuer cette action');
    }
    return session;
  }

  async createSession(hostName) {
    const normalizedHostName = requirePlayerName(hostName, 'hostName');
    const sessionCount = await Session.count();
    if (sessionCount >= MAX_SESSIONS) {
      throw httpError(503, 'Le nombre maximum de sessions actives est atteint');
    }

    const code = await Session.generateCode();
    const token = generatePlayerToken();
    const session = await Session.create({ code, hostName: normalizedHostName });
    const host = await Player.create({
      sessionId: session.id,
      name: normalizedHostName,
      tokenHash: hashToken(token),
    });
    const updatedSession = await Session.setHost(code, host.id, normalizedHostName);

    this.log(code, `Session created by host ${normalizedHostName}`);
    return { session: updatedSession, player: host, token };
  }

  async joinSession(code, playerName, { token = null, tokenPlayer = null } = {}) {
    const normalizedCode = normalizeSessionCode(code);
    const normalizedName = requirePlayerName(playerName);
    const session = await Session.findByCode(normalizedCode);
    if (!session) throw httpError(404, 'Session introuvable');
    if (session.phase !== 'waiting') throw httpError(409, 'La partie a déjà commencé');

    const tokenForSession = tokenPlayer && tokenPlayer.session_id === session.id ? tokenPlayer : null;
    if (tokenForSession && tokenForSession.name.trim().toLowerCase() !== normalizedName.toLowerCase()) {
      throw httpError(409, 'Ce navigateur a déjà un joueur dans ce salon');
    }

    const players = await Player.findBySession(session.id);
    if (players.length >= session.max_players) throw httpError(409, 'La session est complète');

    const existing = await Player.findBySessionAndNameWithToken(session.id, normalizedName);
    if (existing) {
      const samePlayer = tokenForSession && tokenForSession.id === existing.id;
      const canClaimLegacy = !existing.token_hash && !tokenForSession;

      if (!samePlayer && !canClaimLegacy) {
        throw httpError(409, 'Ce pseudo est déjà utilisé. Reconnectez-vous depuis le navigateur qui l’a rejoint.');
      }

      let playerToken = token;
      if (canClaimLegacy) {
        playerToken = generatePlayerToken();
        await Player.setTokenHash(existing.id, hashToken(playerToken), session.id);
      }

      const player = await Player.updateConnectionStatus(existing.id, true, session.id);
      await Session.extendExpiry(normalizedCode, SESSION_TTLS.waiting);
      this.log(normalizedCode, `Player reconnected: ${normalizedName}`);
      return { session, player, token: playerToken };
    }

    const playerToken = generatePlayerToken();
    let player;
    try {
      player = await Player.create({
        sessionId: session.id,
        name: normalizedName,
        tokenHash: hashToken(playerToken),
      });
    } catch (error) {
      if (error.code === '23505') {
        throw httpError(409, 'Ce pseudo est déjà utilisé dans cette session');
      }
      throw error;
    }

    await Session.extendExpiry(normalizedCode, SESSION_TTLS.waiting);
    this.log(normalizedCode, `Player joined: ${normalizedName}`);
    return { session, player, token: playerToken };
  }

  sanitizeConfig(config = {}) {
    const sanitized = {};

    if (Object.hasOwn(config, 'maxPlayers')) {
      sanitized.maxPlayers = requireIntegerInRange(config.maxPlayers, 'maxPlayers', CONFIG_BOUNDS.maxPlayers);
    }
    if (Object.hasOwn(config, 'maxMusicsPerPlayer')) {
      sanitized.maxMusicsPerPlayer = requireIntegerInRange(
        config.maxMusicsPerPlayer,
        'maxMusicsPerPlayer',
        CONFIG_BOUNDS.maxMusicsPerPlayer
      );
    }
    if (Object.hasOwn(config, 'selectionDuration')) {
      sanitized.selectionDuration = requireIntegerInRange(
        config.selectionDuration,
        'selectionDuration',
        CONFIG_BOUNDS.selectionDuration
      );
    }
    if (Object.hasOwn(config, 'extractDuration')) {
      sanitized.extractDuration = requireIntegerInRange(
        config.extractDuration,
        'extractDuration',
        CONFIG_BOUNDS.extractDuration
      );
    }
    if (Object.hasOwn(config, 'votingDuration')) {
      sanitized.votingDuration = requireIntegerInRange(
        config.votingDuration,
        'votingDuration',
        CONFIG_BOUNDS.votingDuration
      );
    }
    if (Object.hasOwn(config, 'showAnswers')) {
      sanitized.showAnswers = requireBoolean(config.showAnswers, 'showAnswers');
    }
    if (Object.hasOwn(config, 'autoAdvance')) {
      sanitized.autoAdvance = requireBoolean(config.autoAdvance, 'autoAdvance');
    }
    if (Object.hasOwn(config, 'showVoteCount')) {
      sanitized.showVoteCount = requireBoolean(config.showVoteCount, 'showVoteCount');
    }
    if (Object.hasOwn(config, 'enableBlindTest')) {
      sanitized.enableBlindTest = requireBoolean(config.enableBlindTest, 'enableBlindTest');
    }
    if (Object.hasOwn(config, 'scoringMode')) {
      if (!SCORING_MODES.includes(config.scoringMode)) {
        throw httpError(400, 'Mode de points invalide');
      }
      sanitized.scoringMode = config.scoringMode;
    }
    if (Object.hasOwn(config, 'showScoreboard')) {
      sanitized.showScoreboard = requireBoolean(config.showScoreboard, 'showScoreboard');
    }
    if (Object.hasOwn(config, 'trackInfoMode')) {
      if (!TRACK_INFO_MODES.includes(config.trackInfoMode)) {
        throw httpError(400, 'Moment de révélation du morceau invalide');
      }
      sanitized.trackInfoMode = config.trackInfoMode;
    }

    return sanitized;
  }

  async updateConfig(code, config, actorId) {
    code = normalizeSessionCode(code);
    const session = await this.assertHost(code, actorId);
    if (session.phase !== 'waiting' && (session.phase !== 'voting' || session.voting_status !== 'idle')) {
      throw httpError(409, 'Impossible de modifier les paramètres en cours de jeu');
    }

    const sanitized = this.sanitizeConfig(config);
    if (sanitized.maxPlayers !== undefined) {
      const playerCount = await Player.countBySession(session.id);
      if (sanitized.maxPlayers < playerCount) {
        throw httpError(409, 'La limite de joueurs ne peut pas être inférieure au nombre actuel de joueurs');
      }
    }

    const updated = await Session.updateConfig(code, sanitized);
    if (session.phase === 'waiting') {
      await Session.extendExpiry(code, SESSION_TTLS.waiting);
    }
    this.log(code, `Configuration updated: ${JSON.stringify(sanitized)}`);
    await this.broadcastState(code);
    return this.getState(code, actorId);
  }

  async addBot(code, actorId) {
    code = normalizeSessionCode(code);
    const session = await this.assertHost(code, actorId);
    if (session.phase !== 'waiting') {
      throw httpError(409, 'Impossible d’ajouter un bot après le début de la partie');
    }

    const players = await Player.findBySession(session.id);
    if (players.length >= session.max_players) {
      throw httpError(409, 'Nombre maximum de joueurs atteint');
    }

    const existingNames = new Set(players.map((player) => player.name.toLowerCase()));
    let botName = '';
    for (const candidate of shuffle(BOT_NAMES_POOL)) {
      if (!existingNames.has(candidate.toLowerCase())) {
        botName = candidate;
        break;
      }
    }

    if (!botName) {
      const botCount = players.filter((player) => player.is_bot).length;
      botName = `Bot ${botCount + 1}`;
    }

    const bot = await Player.create({ sessionId: session.id, name: botName, isBot: true });
    await Session.extendExpiry(code, SESSION_TTLS.waiting);
    this.log(code, `Bot added: ${botName}`);
    await this.broadcastState(code);
    return this.getState(code, actorId);
  }

  async assertUploadQuota(session, playerId, fileSize) {
    if (fileSize < 0 || fileSize > UPLOAD_LIMITS.maxFileBytes) {
      throw httpError(413, 'Fichier audio trop volumineux');
    }
    if (fileSize === 0) return;

    const [playerTotal, sessionTotal, globalTotal] = await Promise.all([
      Music.sumFileSizeByPlayer(playerId, session.id),
      Music.sumFileSizeBySession(session.id),
      Music.sumFileSizeGlobal(),
    ]);

    if (playerTotal + fileSize > UPLOAD_LIMITS.maxPlayerBytes) {
      throw httpError(409, 'Quota d’upload de ce joueur atteint');
    }
    if (sessionTotal + fileSize > UPLOAD_LIMITS.maxSessionBytes) {
      throw httpError(409, 'Quota d’upload de cette session atteint');
    }
    if (globalTotal + fileSize > UPLOAD_LIMITS.maxTotalBytes) {
      throw httpError(409, 'Quota d’upload global atteint');
    }
  }

  async addMusic(code, payload) {
    code = normalizeSessionCode(code);
    const session = await Session.findByCode(code);
    if (!session) throw httpError(404, 'Session introuvable');
    if (session.phase !== 'selection') {
      throw httpError(409, 'La phase de sélection n’est pas active');
    }

    const players = await Player.findBySession(session.id);
    if (!players.some((player) => player.id === payload.playerId)) {
      throw httpError(400, 'Joueur invalide pour cette session');
    }

    const musics = await Music.findBySession(session.id);
    const playerMusics = musics.filter((music) => music.player_id === payload.playerId);
    if (playerMusics.length >= session.max_musics_per_player) {
      throw httpError(409, `Vous avez déjà ajouté le nombre maximum de musiques (${session.max_musics_per_player})`);
    }

    const title = requireNonEmptyString(payload.title, 'title', { maxLength: 255 });
    const artist = requireNonEmptyString(payload.artist, 'artist', { maxLength: 255 });
    const filePath = requireMusicSource(payload.filePath, 'filePath');
    const coverUrl = payload.coverUrl ? requireCoverUrl(payload.coverUrl, 'coverUrl') : null;
    const fileSize = Number.isInteger(payload.fileSize) && payload.fileSize > 0 ? payload.fileSize : 0;

    await this.assertUploadQuota(session, payload.playerId, fileSize);

    const music = await Music.create({
      sessionId: session.id,
      playerId: payload.playerId,
      title,
      artist,
      filePath,
      coverUrl,
      fileSize,
    });

    await Session.extendExpiry(code, SESSION_TTLS.selection);
    this.log(code, `Music added: ${title} by player ${payload.playerId}`);
    return music;
  }

  async deleteMusic(code, musicId, playerId) {
    code = normalizeSessionCode(code);
    const session = await Session.findByCode(code);
    if (!session) throw httpError(404, 'Session introuvable');
    if (session.phase !== 'selection') {
      throw httpError(409, 'Impossible de supprimer des musiques en dehors de la sélection');
    }

    const player = await Player.findById(playerId, session.id);
    if (!player) throw httpError(403, 'Joueur invalide pour cette session');

    const deleted = await Music.deleteMusic(musicId, session.id, playerId);
    if (!deleted) throw httpError(404, 'Musique introuvable ou non autorisée');

    await deleteUpload(deleted.file_path);
    await Session.extendExpiry(code, SESSION_TTLS.selection);
    this.log(code, `Music deleted: id ${musicId} by player ${playerId}`);
    await this.broadcastState(code);
    return this.getState(code, playerId);
  }

  async startSelection(code, actorId) {
    code = normalizeSessionCode(code);
    const session = await this.assertHost(code, actorId);
    if (session.phase !== 'waiting') {
      throw httpError(409, 'La sélection a déjà démarré');
    }

    await Session.updatePhase(code, 'selection', SESSION_TTLS.selection);

    const players = await Player.findBySession(session.id);
    const bots = players.filter((player) => player.is_bot);
    const genres = Object.keys(GENRE_QUERIES);
    const limit = session.max_musics_per_player;
    const deadline = Date.now() + DEEZER.botGenerationBudgetMs;

    const generated = await mapWithConcurrency(bots, DEEZER.botConcurrency, async (bot) => {
      const genre = genres[bot.id % genres.length];
      try {
        return {
          bot,
          genre,
          tracks: await getBotTracks(genre, limit, deadline),
        };
      } catch (error) {
        console.warn(`Bot generation failed for ${bot.name}:`, error.message);
        return { bot, genre, tracks: [] };
      }
    });

    const botTracks = generated.flatMap(({ bot, genre, tracks }) => tracks
      .slice(0, limit)
      .map((track) => ({ bot, genre, track })));

    const materialized = await mapWithConcurrency(
      botTracks,
      DEEZER.botConcurrency,
      async ({ bot, genre, track }) => {
        try {
          const saved = await saveTrackPreview(requireMusicSource(track.file_path, 'filePath'));
          return { bot, genre, track, filePath: saved.filePath, fileSize: saved.fileSize };
        } catch (error) {
          console.warn(`Unable to download bot track ${track.title}:`, error.message);
          return null;
        }
      }
    );

    for (const entry of materialized) {
      if (!entry) continue;
      const { bot, genre, track, filePath, fileSize } = entry;
      try {
        await Music.create({
          sessionId: session.id,
          playerId: bot.id,
          title: track.title,
          artist: track.artist,
          filePath,
          coverUrl: track.cover_url ? requireCoverUrl(track.cover_url, 'coverUrl') : null,
          fileSize,
        });
        this.log(code, `Bot ${bot.name} (${genre}) submitted: ${track.title} by ${track.artist}`);
      } catch (error) {
        await deleteUpload(filePath);
        console.warn(`Unable to save bot track ${track.title}:`, error.message);
      }
    }

    const endsAt = this.startTimer(code, session.selection_duration, async () => {
      this.log(code, 'Selection timer finished, transitioning to voting');
      await this.startVoting(code, null, { internal: true });
    });

    await Session.updateVotingState(code, {
      currentMusicIndex: -1,
      votingStatus: 'idle',
      timerEndsAt: endsAt,
    });
    await Session.extendExpiry(code, SESSION_TTLS.selection);

    this.log(code, 'Selection phase started');
    await this.broadcastState(code);
    if (this.ioNamespace) {
      this.ioNamespace.to(code).emit('sound:play', { type: 'phase_change' });
    }
    return this.getState(code, actorId);
  }

  async startVoting(code, actorId, { internal = false } = {}) {
    code = normalizeSessionCode(code);
    const session = internal
      ? await Session.findByCode(code)
      : await this.assertHost(code, actorId);
    if (!session) throw httpError(404, 'Session introuvable');
    if (session.phase !== 'selection') {
      throw httpError(409, 'Le vote ne peut démarrer qu’après la sélection');
    }

    this.clearTimer(code);
    this.clearBotVoteTimers(code);

    const players = await Player.findBySession(session.id);
    const musics = await Music.findBySession(session.id);
    const activeMusics = [];

    for (const player of players) {
      const playerMusics = musics.filter((music) => music.player_id === player.id);
      const hasEnough = playerMusics.length >= session.max_musics_per_player;
      // A player who closed the tab can still come back during the game. Keep
      // them active as long as they submitted enough tracks: being offline at
      // the exact moment the vote starts must not lock them out for good.
      if (!hasEnough) {
        await Player.setObserver(player.id, true, session.id);
        this.log(code, `Player ${player.name} marked as observer (enough: ${hasEnough})`);
      } else {
        await Player.setObserver(player.id, false, session.id);
        activeMusics.push(...playerMusics);
      }
    }

    const shuffledMusics = shuffle(activeMusics);
    for (let index = 0; index < shuffledMusics.length; index += 1) {
      const track = shuffledMusics[index];
      await Music.updatePlayOrder(track.id, index);

      if (session.enable_blind_test) {
        const options = buildBlindTestOptions(track, musics);
        await query('UPDATE musics SET blind_test_options = $1 WHERE id = $2', [
          JSON.stringify(options),
          track.id,
        ]);
      }
    }

    await query('DELETE FROM votes WHERE session_id = $1', [session.id]);
    await query('DELETE FROM blind_test_answers WHERE session_id = $1', [session.id]);
    await Session.updatePhase(code, 'voting', SESSION_TTLS.voting);

    if (shuffledMusics.length === 0) {
      this.log(code, 'No musics available, transitioning directly to results');
      return this.finishSession(code, null, { internal: true });
    }

    const initialStatus = session.auto_advance ? 'listening' : 'idle';
    this.log(code, `Voting phase started, entering first subphase: ${initialStatus}`);
    await this.enterVotingSubphase(code, 0, initialStatus);
    return this.getState(code, actorId);
  }

  async enterVotingSubphase(code, musicIndex, status) {
    const session = await Session.findByCode(code);
    if (!session) return;

    let duration = 0;
    if (status === 'listening') {
      duration = session.extract_duration;
    } else if (status === 'voting') {
      duration = session.voting_duration;
    } else if (status === 'revelation') {
      duration = session.auto_advance ? 10 : 0;
    }

    this.clearTimer(code);
    this.clearBotVoteTimers(code);

    let endsAt = null;
    if (duration > 0) {
      const callback = async () => {
        const freshSession = await Session.findByCode(code);
        if (!freshSession
          || freshSession.phase !== 'voting'
          || freshSession.voting_status !== status
          || freshSession.current_music_index !== musicIndex) {
          return;
        }

        this.log(code, `Subphase timer finished for music index ${musicIndex}, status ${status}`);
        if (status === 'listening') {
          await this.enterVotingSubphase(code, musicIndex, 'voting');
        } else if (status === 'voting') {
          if (freshSession.show_answers) {
            await this.enterVotingSubphase(code, musicIndex, 'revelation');
          } else {
            await this.nextRound(code, musicIndex);
          }
        } else if (status === 'revelation') {
          await this.nextRound(code, musicIndex);
        }
      };
      endsAt = this.startTimer(code, duration, callback);
    }

    await Session.updateVotingState(code, {
      currentMusicIndex: musicIndex,
      votingStatus: status,
      timerEndsAt: endsAt,
    });
    await Session.extendExpiry(code, SESSION_TTLS.voting);
    await this.broadcastState(code);

    if (this.ioNamespace) {
      if (status === 'listening') {
        this.ioNamespace.to(code).emit('sound:play', { type: 'phase_change' });
      } else if (status === 'voting') {
        this.triggerBotVotes(code, musicIndex);
      } else if (status === 'revelation') {
        this.ioNamespace.to(code).emit('sound:play', { type: 'vote_closed' });
      }
    }
  }

  async nextRound(code, currentIndex) {
    const session = await Session.findByCode(code);
    if (!session) return;

    const musics = await Music.findBySession(session.id);
    const activeMusics = musics
      .filter((music) => music.play_order >= 0)
      .sort((first, second) => first.play_order - second.play_order);
    const nextIndex = currentIndex + 1;

    if (nextIndex < activeMusics.length) {
      const nextStatus = session.auto_advance ? 'listening' : 'idle';
      await this.enterVotingSubphase(code, nextIndex, nextStatus);
    } else {
      await this.finishSession(code, null, { internal: true });
    }
  }

  async startRound(code, actorId) {
    code = normalizeSessionCode(code);
    const session = await this.assertHost(code, actorId);
    if (session.phase !== 'voting' || session.voting_status !== 'idle') {
      throw httpError(409, 'Impossible de lancer la manche depuis ce statut');
    }
    await this.enterVotingSubphase(code, session.current_music_index, 'listening');
    return this.getState(code, actorId);
  }

  async advanceRound(code, actorId) {
    code = normalizeSessionCode(code);
    const session = await this.assertHost(code, actorId);
    if (session.phase !== 'voting') {
      throw httpError(409, 'La phase de vote n’est pas active');
    }

    const status = session.voting_status;
    const musicIndex = session.current_music_index;
    if (!['listening', 'voting', 'revelation'].includes(status)) {
      throw httpError(409, 'Aucune manche active à avancer');
    }

    this.clearTimer(code);
    this.clearBotVoteTimers(code);

    if (status === 'listening') {
      await this.enterVotingSubphase(code, musicIndex, 'voting');
    } else if (status === 'voting') {
      if (session.show_answers) {
        await this.enterVotingSubphase(code, musicIndex, 'revelation');
      } else {
        await this.nextRound(code, musicIndex);
      }
    } else if (status === 'revelation') {
      await this.nextRound(code, musicIndex);
    }
    return this.getState(code, actorId);
  }

  triggerBotVotes(code, musicIndex) {
    const run = async () => {
      const session = await Session.findByCode(code);
      if (!session) return;

      const players = await Player.findBySession(session.id);
      const musics = await Music.findBySession(session.id);
      const currentMusic = musics.find((music) => music.play_order === musicIndex);
      if (!currentMusic) return;

      const bots = players.filter((player) => player.is_bot && !player.is_observer && player.is_connected);
      const eligibleTargets = players.filter((player) => !player.is_observer);

      this.clearBotVoteTimers(code);
      for (const bot of bots) {
        const targets = eligibleTargets.filter((target) => target.id !== bot.id);
        if (targets.length === 0) continue;

        const chosenTarget = targets[Math.floor(Math.random() * targets.length)];
        const randomDelay = Math.random() * session.voting_duration * 1000 * 0.8;

        this.scheduleBotVote(code, randomDelay, async () => {
          const freshSession = await Session.findByCode(code);
          if (freshSession.phase === 'voting'
            && freshSession.voting_status === 'voting'
            && freshSession.current_music_index === musicIndex) {
            await this.submitVote(code, bot.id, currentMusic.id, chosenTarget.id);
          }
        });
      }
    };

    run().catch((error) => this.log(code, `Bot vote scheduling failed: ${error.message}`));
  }

  async submitVote(code, voterId, musicId, guessedPlayerId) {
    const session = await Session.findByCode(normalizeSessionCode(code));
    if (!session) throw httpError(404, 'Session introuvable');
    if (session.phase !== 'voting') throw httpError(409, 'La phase de vote n’est pas active');
    if (session.voting_status !== 'voting') throw httpError(409, 'Les votes sont fermés pour ce morceau');

    const players = await Player.findBySession(session.id);
    const voter = players.find((player) => player.id === voterId);
    if (!voter || voter.is_observer) {
      throw httpError(403, 'Vous êtes observateur et ne pouvez pas voter');
    }

    const music = await Music.findById(musicId, session.id);
    if (!music) throw httpError(400, 'Musique invalide');
    if (music.play_order !== session.current_music_index) {
      throw httpError(400, 'Cette musique n’est pas en cours de vote');
    }

    const target = players.find((player) => player.id === guessedPlayerId && !player.is_observer);
    if (!target) throw httpError(400, 'Le joueur ciblé est invalide');

    if (session.timer_ends_at && new Date() > new Date(session.timer_ends_at)) {
      throw httpError(409, 'Le temps est écoulé pour ce vote');
    }
    if (voterId === guessedPlayerId) {
      throw httpError(400, 'Vous ne pouvez pas voter pour vous-même');
    }

    await query(
      `INSERT INTO votes (session_id, voter_id, music_id, guessed_player_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (session_id, voter_id, music_id)
       DO UPDATE SET guessed_player_id = EXCLUDED.guessed_player_id`,
      [session.id, voterId, musicId, guessedPlayerId]
    );

    await Session.extendExpiry(code, SESSION_TTLS.voting);
    this.log(code, `Vote submitted: player ${voterId} voted for player ${guessedPlayerId} on music ${musicId}`);
    await this.broadcastState(code);
    return this.getState(code, voterId);
  }

  async submitBlindTestAnswer(code, playerId, musicId, answerTitle, answerArtist) {
    const session = await Session.findByCode(normalizeSessionCode(code));
    if (!session || session.phase !== 'voting' || session.voting_status !== 'listening' || !session.enable_blind_test) {
      throw httpError(403, 'Action non autorisée');
    }

    const players = await Player.findBySession(session.id);
    const player = players.find((entry) => entry.id === playerId);
    if (!player || player.is_observer) throw httpError(403, 'Action non autorisée');

    const music = await Music.findById(musicId, session.id);
    if (!music) throw httpError(404, 'Musique introuvable');
    if (music.play_order !== session.current_music_index) {
      throw httpError(400, 'Cette musique n’est pas en cours de lecture');
    }
    if (session.timer_ends_at && new Date() > new Date(session.timer_ends_at)) {
      throw httpError(409, 'Le temps du blind test est écoulé');
    }
    if (music.player_id === playerId) {
      throw httpError(400, 'Vous ne pouvez pas participer au blind test pour votre propre musique');
    }

    const isCorrect = music.title === answerTitle && music.artist === answerArtist;
    await query(
      `INSERT INTO blind_test_answers (session_id, player_id, music_id, answer_title, answer_artist, is_correct)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (session_id, player_id, music_id)
       DO UPDATE SET answer_title = EXCLUDED.answer_title, answer_artist = EXCLUDED.answer_artist, is_correct = EXCLUDED.is_correct`,
      [session.id, playerId, musicId, answerTitle, answerArtist, isCorrect]
    );

    await Session.extendExpiry(code, SESSION_TTLS.voting);
    this.log(code, `Blind test answer submitted: player ${playerId} answered ${answerTitle} for music ${musicId}`);
    await this.broadcastState(code);
    return this.getState(code, playerId);
  }

  async finishSession(code, actorId, { internal = false } = {}) {
    code = normalizeSessionCode(code);
    const session = internal
      ? await Session.findByCode(code)
      : await this.assertHost(code, actorId);
    if (!session) throw httpError(404, 'Session introuvable');
    if (session.phase !== 'voting') {
      throw httpError(409, 'La partie ne peut être terminée que pendant le vote');
    }

    this.clearTimer(code);
    this.clearBotVoteTimers(code);
    await Session.updatePhase(code, 'results', SESSION_TTLS.results);
    await Session.updateVotingState(code, {
      currentMusicIndex: -1,
      votingStatus: 'idle',
      timerEndsAt: null,
    });

    const results = await this.getResults(code, actorId);
    for (const player of results.ranking) {
      await query('UPDATE players SET score = $1 WHERE id = $2', [player.score, player.id]);
    }

    this.log(code, 'Session finished');
    await this.broadcastState(code);
    if (this.ioNamespace) {
      this.ioNamespace.to(code).emit('sound:play', { type: 'game_ended' });
    }
    return results;
  }

  async resetSession(code, actorId) {
    code = normalizeSessionCode(code);
    const session = await this.assertHost(code, actorId);
    this.clearTimer(code);
    this.clearBotVoteTimers(code);
    this.cancelHostDisconnect(code);

    const deletedMusics = await Music.deleteAllBySession(session.id);
    await Session.reset(code, SESSION_TTLS.waiting);
    await Player.resetScoresAndStatusBySession(session.id);
    await deleteUploadsForMusics(deletedMusics);

    this.log(code, 'Session reset');
    await this.broadcastState(code);
    if (this.ioNamespace) {
      this.ioNamespace.to(code).emit('sound:play', { type: 'phase_change' });
    }
    return this.getState(code, actorId);
  }

  async getResults(code, playerId = null) {
    const session = await Session.findByCode(normalizeSessionCode(code));
    if (!session) throw httpError(404, 'Session introuvable');
    if (session.phase !== 'results') {
      throw httpError(409, 'Les résultats ne sont disponibles qu’en fin de partie');
    }
    return this.getState(code, playerId);
  }

  async promotePlayer(code, requesterId, targetPlayerId) {
    code = normalizeSessionCode(code);
    const session = await this.assertHost(code, requesterId);
    if (session.phase !== 'waiting') {
      throw httpError(409, 'Le transfert d’hôte n’est possible que dans le salon d’attente');
    }

    const players = await Player.findBySession(session.id);
    const targetPlayer = players.find((player) => player.id === targetPlayerId);
    if (!targetPlayer) throw httpError(404, 'Joueur cible introuvable');
    if (targetPlayer.is_bot) throw httpError(400, 'Impossible de promouvoir un bot');

    await Session.setHost(code, targetPlayer.id, targetPlayer.name);
    this.cancelHostDisconnect(code);

    this.log(code, `Host promoted: ${targetPlayer.name}`);
    await this.broadcastState(code);
    return this.getState(code, requesterId);
  }

  async kickPlayer(code, requesterId, targetPlayerId) {
    code = normalizeSessionCode(code);
    const session = await this.assertHost(code, requesterId);
    if (session.phase !== 'waiting') {
      throw httpError(409, 'L’exclusion n’est possible que dans le salon d’attente');
    }

    const players = await Player.findBySession(session.id);
    const targetPlayer = players.find((player) => player.id === targetPlayerId);
    if (!targetPlayer) throw httpError(404, 'Joueur cible introuvable');
    if (targetPlayer.id === session.host_player_id) {
      throw httpError(400, 'L’hôte ne peut pas se kick lui-même. Transférez d’abord le rôle d’hôte.');
    }

    const targetMusics = await Music.findByPlayer(targetPlayer.id, session.id);

    if (this.ioNamespace) {
      const sockets = await this.ioNamespace.in(code).fetchSockets();
      for (const socket of sockets.filter((entry) => entry.playerId === targetPlayerId)) {
        socket.emit('player:kicked');
        socket.disconnect(true);
      }
    }

    await Player.deletePlayer(targetPlayerId, session.id);
    await deleteUploadsForMusics(targetMusics);
    this.log(code, `Player kicked: ${targetPlayer.name}`);
    await this.broadcastState(code);
    return this.getState(code, requesterId);
  }

  async regenerateAvatar(code, playerId, actorId) {
    code = normalizeSessionCode(code);
    const session = await Session.findByCode(code);
    if (!session) throw httpError(404, 'Session introuvable');
    if (playerId !== actorId) {
      throw httpError(403, 'Vous ne pouvez modifier que votre propre avatar');
    }

    const player = await Player.findById(playerId, session.id);
    if (!player) throw httpError(404, 'Joueur introuvable');

    const updatedPlayer = await Player.updateAvatarSeed(playerId, generateAvatarSeed(), session.id);
    if (!updatedPlayer) throw httpError(404, 'Joueur introuvable');

    this.log(code, `Player ${updatedPlayer.name} regenerated avatar`);
    await this.broadcastState(code);
    return this.getState(code, playerId);
  }

  async deleteSession(code, { reason = 'deleted' } = {}) {
    const normalizedCode = normalizeSessionCode(code);
    const session = await Session.findByCode(normalizedCode);
    if (!session) return false;

    this.clearTimer(normalizedCode);
    this.clearBotVoteTimers(normalizedCode);
    this.cancelHostDisconnect(normalizedCode);

    const musics = await Music.findBySession(session.id);
    await Session.deleteByCode(normalizedCode);
    await deleteUploadsForMusics(musics);

    if (this.ioNamespace) {
      this.ioNamespace.to(normalizedCode).emit('session:deleted');
    }
    this.log(normalizedCode, `Session deleted (${reason})`);
    return true;
  }

  async recoverSessions() {
    try {
      const activeSessions = await query(
        `SELECT * FROM sessions
         WHERE phase IN ('selection', 'voting')
           AND expires_at > NOW()
           AND timer_ends_at IS NOT NULL`
      ).then((result) => result.rows);

      for (const session of activeSessions) {
        const code = session.code;
        if (this.activeTimers.has(code)) continue;

        const endsAtTime = new Date(session.timer_ends_at).getTime();
        const remainingSeconds = Math.max(0, Math.round((endsAtTime - Date.now()) / 1000));
        this.log(code, `Recovering session phase: ${session.phase}, remaining seconds: ${remainingSeconds}`);

        if (session.phase === 'selection') {
          this.startTimer(code, remainingSeconds, async () => {
            this.log(code, 'Recovered selection timer finished, transitioning to voting');
            await this.startVoting(code, null, { internal: true });
          });
        } else if (session.phase === 'voting') {
          const index = session.current_music_index;
          const status = session.voting_status;

          this.startTimer(code, remainingSeconds, async () => {
            const freshSession = await Session.findByCode(code);
            if (!freshSession
              || freshSession.phase !== 'voting'
              || freshSession.voting_status !== status
              || freshSession.current_music_index !== index) {
              return;
            }
            if (status === 'listening') {
              await this.enterVotingSubphase(code, index, 'voting');
            } else if (status === 'voting') {
              if (freshSession.show_answers) {
                await this.enterVotingSubphase(code, index, 'revelation');
              } else {
                await this.nextRound(code, index);
              }
            } else if (status === 'revelation') {
              await this.nextRound(code, index);
            }
          });

          if (status === 'voting') {
            this.triggerBotVotes(code, index);
          }
        }
      }

      const waitingSessions = await query(
        "SELECT code FROM sessions WHERE phase = 'waiting' AND expires_at > NOW()"
      ).then((result) => result.rows);
      for (const session of waitingSessions) {
        this.scheduleHostDisconnect(session.code);
      }
    } catch (error) {
      console.error('Error recovering active sessions:', error);
    }
  }

  async reapExpiredSessions() {
    if (this.isReaping) return;
    this.isReaping = true;

    try {
      const lock = await query("SELECT pg_try_advisory_lock(hashtext('cekikilami-session-reaper')) AS locked");
      if (!lock.rows[0].locked) return;

      try {
        const expired = await Session.findExpired(50);
        for (const session of expired) {
          await this.deleteSession(session.code, { reason: 'expired' });
        }
        await cleanupOrphanUploads();
        if (expired.length > 0) {
          this.log('reaper', `Deleted ${expired.length} expired session(s)`);
        }
      } finally {
        await query("SELECT pg_advisory_unlock(hashtext('cekikilami-session-reaper'))");
      }
    } catch (error) {
      console.error('Session reaper failed:', error);
    } finally {
      this.isReaping = false;
    }
  }

  startMaintenance() {
    if (this.maintenanceInterval) return;
    this.maintenanceInterval = setInterval(() => {
      this.reapExpiredSessions().catch((error) => {
        console.error('Scheduled session reaper failed:', error);
      });
    }, MAINTENANCE_INTERVAL_MS);
    this.maintenanceInterval.unref?.();
  }

  stopMaintenance() {
    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval);
      this.maintenanceInterval = null;
    }
  }

  shutdown() {
    this.stopMaintenance();
    for (const code of [...this.activeTimers.keys()]) this.clearTimer(code);
    for (const code of [...this.botVoteTimers.keys()]) this.clearBotVoteTimers(code);
    for (const code of [...this.hostDisconnectTimeouts.keys()]) this.cancelHostDisconnect(code);
  }
}
