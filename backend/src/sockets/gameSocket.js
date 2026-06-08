import Player from '../models/Player.js';
import Session from '../models/Session.js';
import { query } from '../config/database.js';

const hostDisconnectTimeouts = new Map();

export default function registerGameSocket(ioNamespace, gameService) {
  ioNamespace.on('connection', (socket) => {
    socket.on('join', async ({ code, playerId }) => {
      try {
        if (!code || typeof code !== 'string') {
          return;
        }

        const sessionCode = code.trim().toUpperCase();
        socket.join(sessionCode);
        
        if (playerId) {
          const parsedPlayerId = Number.parseInt(playerId, 10);
          socket.playerId = parsedPlayerId;
          socket.code = sessionCode;

          // Update connection status to connected
          const player = await Player.updateConnectionStatus(parsedPlayerId, true);
          gameService.log(sessionCode, `Socket connected for player ${parsedPlayerId}`);

          // Cancel host disconnect deletion timer if this player is the host
          if (player) {
            const session = await Session.findByCode(sessionCode);
            if (session && player.name === session.host_name) {
              if (hostDisconnectTimeouts.has(sessionCode)) {
                gameService.log(sessionCode, `Host reconnected, cancelling deletion timer`);
                clearTimeout(hostDisconnectTimeouts.get(sessionCode));
                hostDisconnectTimeouts.delete(sessionCode);
              }
            }
          }
        }

        // Send state to this client
        const state = await gameService.getState(sessionCode, playerId);
        socket.emit('state:update', state);

        // Broadcast updated players list to everyone else
        await gameService.broadcastState(sessionCode);
      } catch (error) {
        socket.emit('game:error', { message: error.message });
      }
    });

    socket.on('disconnect', async () => {
      const code = socket.code;
      const playerId = socket.playerId;

      if (code && playerId) {
        try {
          // Check if there are other sockets for this player in the same room
          const sockets = await ioNamespace.in(code).fetchSockets();
          const anotherSocketExists = sockets.some(s => s.playerId === playerId && s.id !== socket.id);

          if (!anotherSocketExists) {
            // No other socket, player disconnected!
            const player = await Player.updateConnectionStatus(playerId, false);
            gameService.log(code, `Player ${playerId} marked as disconnected`);

            const session = await Session.findByCode(code);
            if (session && player && player.name === session.host_name) {
              gameService.log(code, `Host disconnected, starting deletion grace period (15s)`);
              
              if (hostDisconnectTimeouts.has(code)) {
                clearTimeout(hostDisconnectTimeouts.get(code));
              }

              const timeoutId = setTimeout(async () => {
                try {
                  const freshSession = await Session.findByCode(code);
                  if (freshSession) {
                    const players = await Player.findBySession(freshSession.id);
                    const hostPlayer = players.find(p => p.name === freshSession.host_name);
                    if (!hostPlayer || !hostPlayer.is_connected) {
                      gameService.log(code, `Host remained disconnected, deleting session`);
                      await query('DELETE FROM sessions WHERE id = $1', [freshSession.id]);
                      ioNamespace.to(code).emit('session:deleted');
                      gameService.clearTimer(code);
                    }
                  }
                } catch (err) {
                  console.error('Error in host disconnect timeout:', err);
                } finally {
                  hostDisconnectTimeouts.delete(code);
                }
              }, 15000); // 15 seconds grace period is perfect for a refresh!

              hostDisconnectTimeouts.set(code, timeoutId);
            }

            await gameService.broadcastState(code);
          }
        } catch (error) {
          console.error('Error handling disconnect:', error);
        }
      }
    });
  });
}
