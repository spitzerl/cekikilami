import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { RATE_LIMITS } from '../config/game.js';

function buildLimiter({ windowMs, limit, message }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: message },
  });
}

function playerOrIp(req) {
  if (req.player?.id) return `player:${req.player.id}`;
  return `ip:${ipKeyGenerator(req.ip)}`;
}

export function createRateLimiters() {
  return {
    createSession: buildLimiter({
      windowMs: 60 * 60 * 1000,
      limit: RATE_LIMITS.createSessionPerHour,
      message: 'Trop de sessions créées. Réessayez plus tard.',
    }),
    join: buildLimiter({
      windowMs: 60 * 1000,
      limit: RATE_LIMITS.joinPerMinute,
      message: 'Trop de tentatives de connexion. Réessayez dans une minute.',
    }),
    summary: buildLimiter({
      windowMs: 60 * 1000,
      limit: RATE_LIMITS.summaryPerMinute,
      message: 'Trop de consultations de salon. Réessayez dans une minute.',
    }),
    state: rateLimit({
      windowMs: 60 * 1000,
      limit: RATE_LIMITS.statePerMinute,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      keyGenerator: playerOrIp,
      message: { error: 'Trop de mises à jour d’état. Réessayez dans une minute.' },
    }),
    vote: rateLimit({
      windowMs: 60 * 1000,
      limit: RATE_LIMITS.votePerMinute,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      keyGenerator: playerOrIp,
      message: { error: 'Trop d’actions de jeu. Réessayez dans une minute.' },
    }),
    upload: rateLimit({
      windowMs: 60 * 60 * 1000,
      limit: RATE_LIMITS.uploadPerHour,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      keyGenerator: playerOrIp,
      message: { error: 'Trop d’upload. Réessayez plus tard.' },
    }),
    deezer: rateLimit({
      windowMs: 60 * 1000,
      limit: RATE_LIMITS.deezerPerMinute,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      keyGenerator: playerOrIp,
      message: { error: 'Trop de recherches Deezer. Réessayez dans une minute.' },
    }),
    avatar: buildLimiter({
      windowMs: 60 * 1000,
      limit: RATE_LIMITS.avatarPerMinute,
      message: 'Trop de demandes d’avatar. Réessayez dans une minute.',
    }),
  };
}
