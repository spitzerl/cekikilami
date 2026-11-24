import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import pool from './config/database.js';
import { closeRedis, connectRedis } from './config/redis.js';
import { CORS_ORIGIN } from './config/game.js';
import createApp from './app.js';
import GameService from './services/GameService.js';
import registerGameSocket from './sockets/gameSocket.js';
import { initSchema } from './db/schema.js';
import { ensureUploadDir } from './services/uploadService.js';
import Player from './models/Player.js';

dotenv.config();

const PORT = Number.parseInt(process.env.PORT || '3001', 10);

// A malformed client event must never take down every room and timer. Log
// unexpected failures instead of letting Node terminate the whole process.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

async function bootstrap() {
  try {
    await initSchema(pool);
    await ensureUploadDir();
    await Player.resetConnectionStatuses();

    // The cache is optional: never block HTTP startup on Redis.
    void connectRedis();

    const io = new Server({
      cors: {
        origin: CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean),
        credentials: false,
      },
      maxHttpBufferSize: 1_000_000,
      // Mobile networks and suspended tabs can miss a heartbeat without being
      // gone; keep the default interval and allow a longer reply window so a
      // short stall does not drop the socket.
      pingTimeout: 30_000,
    });

    const gameNamespace = io.of('/game');
    const gameService = new GameService();
    gameService.setIoNamespace(gameNamespace);
    registerGameSocket(gameNamespace, gameService);

    const app = createApp(gameService, gameNamespace);
    const server = createServer(app);
    io.attach(server);

    await gameService.recoverSessions();
    gameService.startMaintenance();

    server.listen(PORT, () => {
      console.log(`Backend running on http://localhost:${PORT}`);
    });

    let shuttingDown = false;
    const shutdown = async (signal) => {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log(`Received ${signal}, shutting down`);
      gameService.shutdown();
      io.close();
      server.close();
      await closeRedis();
      await pool.end();
      process.exit(0);
    };

    process.on('SIGINT', () => { void shutdown('SIGINT'); });
    process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
  } catch (error) {
    console.error('Unable to start backend:', error);
    process.exit(1);
  }
}

bootstrap();
