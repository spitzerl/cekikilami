import { io } from 'socket.io-client';

let socket;
let currentCode = null;

const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;

function tokenFromStorage() {
  return localStorage.getItem('music_game_token');
}

function onConnect() {
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
      socket.off('connect', onConnect);
      socket.disconnect();
      socket = null;
    }

    currentCode = code;
    if (token) localStorage.setItem('music_game_token', token);

    const activeSocket = connect();
    activeSocket.auth = { token: nextToken };
    activeSocket.off('connect', onConnect);
    activeSocket.on('connect', onConnect);
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
    if (!socket) return;
    socket.off('connect', onConnect);
    socket.disconnect();
    socket = null;
  },
};
