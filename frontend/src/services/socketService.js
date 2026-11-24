import { io } from 'socket.io-client';

const HEARTBEAT_INTERVAL_MS = 120_000;

let socket;
let currentCode = null;
let heartbeatInterval = null;

const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;

function tokenFromStorage() {
  return localStorage.getItem('music_game_token');
}

function startHeartbeat() {
  stopHeartbeat();
  heartbeatInterval = setInterval(() => {
    if (socket?.connected) socket.emit('session:touch');
  }, HEARTBEAT_INTERVAL_MS);
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

function onConnect() {
  startHeartbeat();
  if (socket && currentCode) {
    socket.emit('join', { code: currentCode });
  }
}

function connect() {
  if (!socket) {
    socket = io(`${socketUrl}/game`, {
      transports: ['websocket', 'polling'],
      auth: (callback) => callback({ token: tokenFromStorage() }),
    });
    socket.on('connect', startHeartbeat);
    socket.on('disconnect', stopHeartbeat);
  }
  return socket;
}

export default {
  connect() {
    return connect();
  },
  join(code, token = null) {
    const nextToken = token || tokenFromStorage();

    if (socket && socket.auth?.token !== nextToken) {
      stopHeartbeat();
      socket.off('connect', onConnect);
      socket.off('connect', startHeartbeat);
      socket.off('disconnect', stopHeartbeat);
      socket.disconnect();
      socket = null;
    }

    currentCode = code;
    if (token) localStorage.setItem('music_game_token', token);

    const activeSocket = connect();
    activeSocket.auth = { token: nextToken };
    activeSocket.off('connect', onConnect);
    activeSocket.on('connect', onConnect);
    activeSocket.off('disconnect', stopHeartbeat);
    activeSocket.on('disconnect', stopHeartbeat);
    if (activeSocket.connected) onConnect();
  },
  on(event, callback) {
    connect().on(event, callback);
  },
  off(event, callback) {
    if (!socket) return;
    socket.off(event, callback);
  },
  disconnect() {
    currentCode = null;
    stopHeartbeat();
    if (!socket) return;
    socket.off('connect', onConnect);
    socket.off('connect', startHeartbeat);
    socket.off('disconnect', stopHeartbeat);
    socket.disconnect();
    socket = null;
  },
};
