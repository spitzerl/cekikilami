import { hashToken } from '../security/tokens.js';
import { RATE_LIMITS, SESSION_TTLS, TRUST_PROXY } from '../config/game.js';
import Player from '../models/Player.js';
import Session from '../models/Session.js';

const connectionAttempts = new Map();
const authenticationFailures = new Map();

function socketIp(socket) {
  if (TRUST_PROXY) {
    const forwarded = socket.handshake.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
      return forwarded.split(',')[0].trim();
    }
  }
  return socket.handshake.address || 'unknown';
}

function allowAttempt(map, key, limit, windowMs) {
  const now = Date.now();
  const attempts = (map.get(key) || []).filter((timestamp) => now - timestamp < windowMs);
  if (attempts.length >= limit) {
    map.set(key, attempts);
    return false;
  }
  attempts.push(now);
  map.set(key, attempts);

  if (map.size > 10_000) {
    for (const [entryKey, entryAttempts] of map) {
      if (entryAttempts.every((timestamp) => now - timestamp >= windowMs)) {
        map.delete(entryKey);
      }
    }
  }
  return true;
}

async function hasOtherPlayerSocket(ioNamespace, code, playerId, socketId) {
  const sockets = await ioNamespace.in(code).fetchSockets();
  return sockets.some((entry) => entry.playerId === playerId && entry.id !== socketId);
}

function sessionTtl(session) {
  return SESSION_TTLS[session.phase] || SESSION_TTLS.waiting;
}

function rejectAuthentication(next, ip, message) {
  if (!allowAttempt(authenticationFailures, ip, RATE_LIMITS.socketAuthFailuresPerMinute, 60_000)) {
    next(new Error('Trop de tentatives d’authentification. Réessayez dans une minute.'));
    return;
  }
  next(new Error(message));
}

export default function registerGameSocket(ioNamespace, gameService) {
  ioNamespace.use(async (socket, next) => {
    try {
      const ip = socketIp(socket);
      if (!allowAttempt(connectionAttempts, ip, RATE_LIMITS.socketConnectionsPerMinute, 60_000)) {
        next(new Error('Trop de connexions. Réessayez dans une minute.'));
        return;
      }

      const token = socket.handshake.auth?.token;
      if (typeof token !== 'string' || !token || token.length > 200) {
        rejectAuthentication(next, ip, 'Authentification requise');
        return;
      }

      const player = await Player.findByTokenHash(hashToken(token));
      if (!player) {
        rejectAuthentication(next, ip, 'Jeton joueur invalide');
        return;
      }

      socket.playerId = player.id;
      socket.sessionId = player.session_id;
      next();
    } catch (error) {
      console.error('Socket authentication failed:', error);
      next(new Error('Authentification impossible'));
    }
  });

  ioNamespace.on('connection', (socket) => {
    socket.joinAttempts = [];
    socket.lastTouchAt = 0;

    // An open game tab keeps its session alive even when no gameplay action is
    // happening (for example while players chat on the results screen).
    socket.on('session:touch', async () => {
      const now = Date.now();
      if (!socket.code || now - socket.lastTouchAt < 30_000) return;
      socket.lastTouchAt = now;

      try {
        const session = await Session.findByCode(socket.code);
        if (session && session.id === socket.sessionId) {
          await Session.extendExpiry(socket.code, sessionTtl(session));
        }
      } catch (error) {
        console.error('Session touch failed:', error);
      }
    });

    socket.on('join', async (payload) => {
      try {
        const { code } = payload && typeof payload === 'object' ? payload : {};
        if (!code || typeof code !== 'string' || code.length > 12) {
          socket.emit('game:error', { message: 'Requête de connexion invalide' });
          return;
        }

        const now = Date.now();
        socket.joinAttempts = socket.joinAttempts.filter((timestamp) => now - timestamp < 60_000);
        if (socket.joinAttempts.length >= RATE_LIMITS.socketJoinsPerMinute) {
          socket.emit('game:error', { message: 'Trop de tentatives de connexion au salon' });
          return;
        }
        socket.joinAttempts.push(now);

        const sessionCode = code.trim().toUpperCase();
        const session = await Session.findByCode(sessionCode);
        if (!session || session.id !== socket.sessionId) {
          socket.emit('game:error', { message: 'Session introuvable' });
          return;
        }

        socket.join(sessionCode);
        socket.code = sessionCode;

        // An active player proves the room is still in use. This also prevents
        // the reaper from deleting a session while its players reconnect.
        await Session.extendExpiry(sessionCode, sessionTtl(session));

        // Cancel a scheduled host transfer as soon as the host is back, before
        // the disconnect handler can race with this join.
        if (session.host_player_id === socket.playerId) {
          gameService.cancelHostDisconnect(sessionCode);
        }

        const sockets = await ioNamespace.in(sessionCode).fetchSockets();
        const anotherSocketExists = sockets.some(
          (entry) => entry.playerId === socket.playerId && entry.id !== socket.id
        );

        const player = await Player.updateConnectionStatus(socket.playerId, true, session.id);
        if (player) {
          gameService.log(sessionCode, `Socket connected for player ${socket.playerId}`);
          if (!anotherSocketExists) {
            ioNamespace.to(sessionCode).emit('player:status', {
              playerId: socket.playerId,
              playerName: player.name,
              isConnected: true,
            });
          }
        }

        const state = await gameService.getState(sessionCode, socket.playerId);
        socket.emit('state:update', state);
        await gameService.broadcastState(sessionCode);
      } catch (error) {
        console.error('Socket join failed:', error);
        socket.emit('game:error', { message: 'Connexion au salon impossible' });
      }
    });

    socket.on('disconnect', async (reason) => {
      const code = socket.code;
      const playerId = socket.playerId;
      const sessionId = socket.sessionId;

      if (!code || !playerId) return;

      // A client that explicitly leaves (or joins another room) sends a
      // disconnect packet. A closed tab or a network loss only closes the
      // transport, so the room must survive long enough to be resumed.
      const explicitLeave = reason === 'client namespace disconnect';

      try {
        const anotherSocketExists = await hasOtherPlayerSocket(
          ioNamespace,
          code,
          playerId,
          socket.id
        );
        if (anotherSocketExists) return;

        const player = await Player.updateConnectionStatus(playerId, false, sessionId);

        // A reconnect can join the room while the previous update is in flight.
        // Re-check before emitting the offline status or starting a host
        // transfer, otherwise a short network blip can leave a connected
        // player marked as offline and trigger the host grace period.
        if (await hasOtherPlayerSocket(ioNamespace, code, playerId, socket.id)) {
          await Player.updateConnectionStatus(playerId, true, sessionId);
          gameService.cancelHostDisconnect(code);
          gameService.log(code, `Player ${playerId} reconnected during disconnect handling`);
          return;
        }

        gameService.log(code, `Player ${playerId} marked as disconnected`);

        if (player) {
          ioNamespace.to(code).emit('player:status', {
            playerId,
            playerName: player.name,
            isConnected: false,
          });
        }

        const session = await Session.findByCode(code);
        if (session && player && session.host_player_id === player.id) {
          gameService.log(code, 'Host disconnected, starting host transfer grace period');
          gameService.scheduleHostDisconnect(code, {
            keepEmptyWaitingRoom: !explicitLeave,
          });
        }

        await gameService.broadcastState(code);
      } catch (error) {
        console.error('Error handling disconnect:', error);
      }
    });
  });
}
