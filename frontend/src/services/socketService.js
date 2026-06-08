import { io } from 'socket.io-client';

let socket;

const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;

export default {
  connect() {
    if (!socket) {
      socket = io(`${socketUrl}/game`, {
        transports: ['websocket', 'polling'],
      });
    }
    return socket;
  },
  join(code, playerId = null) {
    const s = this.connect();
    // Clean up any old connect listener to avoid duplicate joins on reconnect
    s.off('connect');
    // When the socket connects or reconnects, emit the join event
    s.on('connect', () => {
      s.emit('join', { code, playerId });
    });
    // If socket is already connected, emit join immediately
    if (s.connected) {
      s.emit('join', { code, playerId });
    }
  },
  on(event, callback) {
    this.connect().on(event, callback);
  },
  off(event, callback) {
    if (!socket) return;
    socket.off(event, callback);
  },
  disconnect() {
    if (!socket) return;
    socket.disconnect();
    socket = null;
  }
};
