import { hashToken } from './tokens.js';
import { httpError } from './errors.js';
import { normalizeSessionCode } from './validation.js';
import Player from '../models/Player.js';
import Session from '../models/Session.js';

export function extractBearerToken(req) {
  const header = req.headers?.authorization;
  if (typeof header !== 'string') return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  if (!token || token.length > 200) return null;
  return token;
}

export async function resolvePlayerToken(token) {
  if (!token) return null;
  return Player.findByTokenHash(hashToken(token));
}

export async function requireAuth(req, _res, next) {
  try {
    const token = extractBearerToken(req);
    if (!token) throw httpError(401, 'Authentification requise');
    const player = await resolvePlayerToken(token);
    if (!player) throw httpError(401, 'Jeton joueur invalide');
    req.authToken = token;
    req.player = player;
    next();
  } catch (error) {
    next(error);
  }
}

export async function requireSessionPlayer(req, _res, next) {
  try {
    if (!req.player) throw httpError(401, 'Authentification requise');
    const code = normalizeSessionCode(req.params.code);
    const session = await Session.findByCode(code);
    if (!session) throw httpError(404, 'Session introuvable');
    if (req.player.session_id !== session.id) {
      throw httpError(403, 'Ce joueur n’appartient pas à cette session');
    }
    req.session = session;
    req.sessionCode = code;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireHost(req, _res, next) {
  if (!req.session || !req.player) {
    next(httpError(401, 'Authentification requise'));
    return;
  }
  if (req.session.host_player_id !== req.player.id) {
    next(httpError(403, 'Seul l’hôte peut effectuer cette action'));
    return;
  }
  next();
}
