import { Router } from 'express';
import multer from 'multer';
import { createRateLimiters } from '../security/rateLimits.js';
import {
  extractBearerToken,
  requireAuth,
  requireHost,
  requireSessionPlayer,
  resolvePlayerToken,
} from '../security/auth.js';
import { httpError } from '../security/errors.js';
import {
  normalizeSessionCode,
  requireNonEmptyString,
  requirePlayerName,
  requirePositiveInteger,
} from '../security/validation.js';
import { requireAudioUrl, requireCoverUrl } from '../security/media.js';
import { UPLOAD_LIMITS } from '../config/game.js';
import {
  deleteUpload,
  detectAudioExtension,
  saveUpload,
} from '../services/uploadService.js';
import { saveTrackPreview, searchTracks } from '../services/deezerService.js';
import { getAvatar } from '../services/avatarService.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: UPLOAD_LIMITS.maxFileBytes,
    files: 1,
    fields: 20,
    parts: 25,
  },
});

function uploadMiddleware(req, res, next) {
  upload.single('audio')(req, res, (error) => {
    if (!error) {
      next();
      return;
    }
    if (error.code === 'LIMIT_FILE_SIZE') {
      error.status = 413;
      error.message = 'Fichier audio trop volumineux';
    } else if (error.code?.startsWith('LIMIT_')) {
      error.status = 400;
      error.message = 'Envoi de fichier invalide';
    }
    next(error);
  });
}

function sessionResponse(session) {
  const { expires_at, ...safe } = session;
  return safe;
}

export default function buildRoutes(gameService, ioNamespace) {
  const router = Router();
  const limits = createRateLimiters();

  router.get('/avatars/:seed', limits.avatar, async (req, res, next) => {
    try {
      const avatar = await getAvatar(req.params.seed);
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.send(avatar.buffer);
    } catch (error) {
      next(error);
    }
  });

  router.post('/sessions', limits.createSession, async (req, res, next) => {
    try {
      const hostName = requirePlayerName(req.body?.hostName, 'hostName');
      const data = await gameService.createSession(hostName);
      res.status(201).json({
        session: sessionResponse(data.session),
        host: data.player,
        token: data.token,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/sessions/:code/summary', limits.summary, async (req, res, next) => {
    try {
      const code = normalizeSessionCode(req.params.code);
      res.setHeader('Cache-Control', 'no-store');
      res.json(await gameService.getSessionSummary(code));
    } catch (error) {
      next(error);
    }
  });

  router.post('/sessions/:code/join', limits.join, async (req, res, next) => {
    try {
      const code = normalizeSessionCode(req.params.code);
      const playerName = requirePlayerName(req.body?.playerName);
      const token = extractBearerToken(req);
      let tokenPlayer = null;

      if (token) {
        tokenPlayer = await resolvePlayerToken(token);
        if (!tokenPlayer) throw httpError(401, 'Jeton joueur invalide');
      }

      const data = await gameService.joinSession(code, playerName, { token, tokenPlayer });
      await gameService.broadcastState(code);
      ioNamespace.to(code).emit('sound:play', { type: 'join' });
      res.status(201).json({
        session: sessionResponse(data.session),
        player: data.player,
        token: data.token,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/deezer/search', requireAuth, limits.deezer, async (req, res, next) => {
    try {
      const query = typeof req.query?.q === 'string' ? req.query.q.slice(0, 100) : '';
      const tracks = await searchTracks(query, { limit: 25 });
      res.setHeader('Cache-Control', 'private, max-age=300');
      res.json({ tracks });
    } catch (error) {
      if (error.status) {
        next(error);
      } else {
        next(httpError(502, 'Deezer indisponible'));
      }
    }
  });

  router.use('/sessions/:code', requireAuth, requireSessionPlayer);

  router.get('/sessions/:code', limits.state, async (req, res, next) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      res.json(await gameService.getState(req.sessionCode, req.player.id));
    } catch (error) {
      next(error);
    }
  });

  router.post('/sessions/:code/config', requireHost, async (req, res, next) => {
    try {
      res.json(await gameService.updateConfig(req.sessionCode, req.body, req.player.id));
    } catch (error) {
      next(error);
    }
  });

  router.post('/sessions/:code/bots', requireHost, async (req, res, next) => {
    try {
      const state = await gameService.addBot(req.sessionCode, req.player.id);
      ioNamespace.to(req.sessionCode).emit('sound:play', { type: 'join' });
      res.json(state);
    } catch (error) {
      next(error);
    }
  });

  router.post('/sessions/:code/start-selection', requireHost, async (req, res, next) => {
    try {
      res.json(await gameService.startSelection(req.sessionCode, req.player.id));
    } catch (error) {
      next(error);
    }
  });

  router.post(
    '/sessions/:code/musics',
    limits.upload,
    uploadMiddleware,
    async (req, res, next) => {
      let storedPath = null;
      try {
        const title = requireNonEmptyString(req.body?.title, 'title', { maxLength: 255 });
        const artist = requireNonEmptyString(req.body?.artist, 'artist', { maxLength: 255 });
        let filePath = null;
        let fileSize = 0;

        if (req.file) {
          const extension = await detectAudioExtension(req.file.buffer);
          if (!extension) {
            throw httpError(400, 'Format audio non supporté (mp3, wav, ogg ou m4a)');
          }
          const saved = await saveUpload(req.file.buffer, extension);
          filePath = saved.filePath;
          fileSize = saved.fileSize;
          storedPath = saved.filePath;
        } else if (req.body?.deezerPreviewUrl) {
          const previewUrl = requireAudioUrl(req.body.deezerPreviewUrl, 'deezerPreviewUrl');
          try {
            const saved = await saveTrackPreview(previewUrl);
            filePath = saved.filePath;
            fileSize = saved.fileSize;
            storedPath = saved.filePath;
          } catch {
            throw httpError(502, 'Extrait Deezer indisponible, relancez la recherche');
          }
        }

        if (!filePath) throw httpError(400, 'Le fichier audio est requis');
        const coverUrl = req.body?.coverUrl ? requireCoverUrl(req.body.coverUrl, 'coverUrl') : null;

        const music = await gameService.addMusic(req.sessionCode, {
          playerId: req.player.id,
          title,
          artist,
          filePath,
          coverUrl,
          fileSize,
        });
        storedPath = null;

        await gameService.broadcastState(req.sessionCode);
        res.status(201).json(music);
      } catch (error) {
        if (storedPath) await deleteUpload(storedPath);
        next(error);
      }
    }
  );

  router.delete('/sessions/:code/musics/:musicId', async (req, res, next) => {
    try {
      const musicId = requirePositiveInteger(req.params.musicId, 'musicId');
      res.json(await gameService.deleteMusic(req.sessionCode, musicId, req.player.id));
    } catch (error) {
      next(error);
    }
  });

  router.post('/sessions/:code/start-voting', requireHost, async (req, res, next) => {
    try {
      res.json(await gameService.startVoting(req.sessionCode, req.player.id));
    } catch (error) {
      next(error);
    }
  });

  router.post('/sessions/:code/start-round', requireHost, async (req, res, next) => {
    try {
      res.json(await gameService.startRound(req.sessionCode, req.player.id));
    } catch (error) {
      next(error);
    }
  });

  router.post('/sessions/:code/advance-round', requireHost, async (req, res, next) => {
    try {
      res.json(await gameService.advanceRound(req.sessionCode, req.player.id));
    } catch (error) {
      next(error);
    }
  });

  router.post('/sessions/:code/votes', limits.vote, async (req, res, next) => {
    try {
      const musicId = requirePositiveInteger(req.body?.musicId, 'musicId');
      const guessedPlayerId = requirePositiveInteger(req.body?.guessedPlayerId, 'guessedPlayerId');
      const state = await gameService.submitVote(req.sessionCode, req.player.id, musicId, guessedPlayerId);
      res.json(state);
    } catch (error) {
      next(error);
    }
  });

  router.post('/sessions/:code/blind-test-answers', limits.vote, async (req, res, next) => {
    try {
      const musicId = requirePositiveInteger(req.body?.musicId, 'musicId');
      const answerTitle = requireNonEmptyString(req.body?.answerTitle, 'answerTitle', { maxLength: 255 });
      const answerArtist = requireNonEmptyString(req.body?.answerArtist, 'answerArtist', { maxLength: 255 });
      const state = await gameService.submitBlindTestAnswer(
        req.sessionCode,
        req.player.id,
        musicId,
        answerTitle,
        answerArtist
      );
      res.json(state);
    } catch (error) {
      next(error);
    }
  });

  router.post('/sessions/:code/finish', requireHost, async (req, res, next) => {
    try {
      res.json(await gameService.finishSession(req.sessionCode, req.player.id));
    } catch (error) {
      next(error);
    }
  });

  router.post('/sessions/:code/reset', requireHost, async (req, res, next) => {
    try {
      res.json(await gameService.resetSession(req.sessionCode, req.player.id));
    } catch (error) {
      next(error);
    }
  });

  router.get('/sessions/:code/results', limits.state, async (req, res, next) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      res.json(await gameService.getResults(req.sessionCode, req.player.id));
    } catch (error) {
      next(error);
    }
  });

  router.post('/sessions/:code/players/:playerId/promote', requireHost, async (req, res, next) => {
    try {
      const targetPlayerId = requirePositiveInteger(req.params.playerId, 'playerId');
      res.json(await gameService.promotePlayer(req.sessionCode, req.player.id, targetPlayerId));
    } catch (error) {
      next(error);
    }
  });

  router.post('/sessions/:code/players/:playerId/kick', requireHost, async (req, res, next) => {
    try {
      const targetPlayerId = requirePositiveInteger(req.params.playerId, 'playerId');
      res.json(await gameService.kickPlayer(req.sessionCode, req.player.id, targetPlayerId));
    } catch (error) {
      next(error);
    }
  });

  router.post('/sessions/:code/players/:playerId/avatar', async (req, res, next) => {
    try {
      const targetPlayerId = requirePositiveInteger(req.params.playerId, 'playerId');
      res.json(await gameService.regenerateAvatar(req.sessionCode, targetPlayerId, req.player.id));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
