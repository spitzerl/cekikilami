import { defineStore } from 'pinia';
import apiService from '../services/apiService';
import socketService from '../services/socketService';

// Only warn once a disconnection lasts long enough to be meaningful, so short
// network blips (mobile switching networks, laptop sleeping) stay silent.
const CONNECTION_LOST_NOTICE_DELAY = 4000;

let connectionLostNoticeTimer = null;
let connectionLostNoticeId = null;

function readStoredPlayer() {
  try {
    return JSON.parse(localStorage.getItem('music_game_player')) || null;
  } catch {
    return null;
  }
}

export const useGameStore = defineStore('game', {
  state: () => ({
    session: null,
    player: readStoredPlayer(),
    token: localStorage.getItem('music_game_token') || null,
    players: [],
    musics: [],
    currentMusic: null,
    votes: null,
    voteProgress: null,
    musicCounts: null,
    ranking: [],
    error: null,
    notifications: [],
    volume: localStorage.getItem('cekikilami_volume') !== null ? Number(localStorage.getItem('cekikilami_volume')) : 0.5,
    serverTimeOffset: 0,
  }),
  getters: {
    correctedNow: (state) => {
      return () => Date.now() + state.serverTimeOffset;
    },
    isHost: (state) => Boolean(
      state.session
      && state.player
      && state.session.host_player_id === state.player.id
    ),
  },
  actions: {
    persistIdentity(player, token) {
      this.player = player || null;
      this.token = token || null;
      if (player) {
        localStorage.setItem('music_game_player', JSON.stringify(player));
      } else {
        localStorage.removeItem('music_game_player');
      }
      if (token) {
        localStorage.setItem('music_game_token', token);
      } else {
        localStorage.removeItem('music_game_token');
      }
    },
    clearIdentity() {
      this.player = null;
      this.token = null;
      localStorage.removeItem('music_game_player');
      localStorage.removeItem('music_game_token');
    },
    applyState(data) {
      if (!data) return;
      if (data.serverTime) this.updateServerTimeOffset(data.serverTime);
      if (data.session) this.session = data.session;
      if (data.players) this.players = data.players;
      if (data.musics !== undefined) this.musics = data.musics || [];
      if (data.currentMusic !== undefined) this.currentMusic = data.currentMusic || null;
      if (data.votes !== undefined) this.votes = data.votes || null;
      if (data.voteProgress !== undefined) this.voteProgress = data.voteProgress || null;
      if (data.musicCounts !== undefined) this.musicCounts = data.musicCounts || null;
      if (data.ranking !== undefined) this.ranking = data.ranking || [];
      if (data.player) {
        this.player = data.player;
        localStorage.setItem('music_game_player', JSON.stringify(data.player));
      }
    },
    async createSession(hostName) {
      const { data } = await apiService.createSession(hostName);
      this.session = data.session;
      this.persistIdentity(data.host, data.token);
      return data;
    },
    async joinSession(code, playerName) {
      let response;
      try {
        response = await apiService.joinSession(code, playerName);
      } catch (error) {
        if (error.response?.status === 401) {
          this.disconnectSocket();
          this.clearIdentity();
          response = await apiService.joinSession(code, playerName);
        } else {
          throw error;
        }
      }

      const { data } = response;
      this.persistIdentity(data.player, data.token);
      this.applyState(data);
      return data;
    },
    async loadSession(code) {
      if (!this.token) {
        const { data } = await apiService.getSessionSummary(code);
        this.session = data.session;
        this.players = [];
        this.musics = [];
        this.currentMusic = null;
        this.votes = null;
        this.voteProgress = null;
        this.musicCounts = null;
        return data;
      }

      try {
        const { data } = await apiService.getSession(code);
        this.applyState(data);
        return data;
      } catch (error) {
        const status = error.response?.status;
        if (status === 401 || status === 403) {
          this.disconnectSocket();
          this.clearIdentity();
          const { data } = await apiService.getSessionSummary(code);
          this.session = data.session;
          this.players = [];
          this.musics = [];
          this.currentMusic = null;
          this.votes = null;
          this.voteProgress = null;
          this.musicCounts = null;
          return data;
        }
        throw error;
      }
    },
    async restoreSession() {
      const token = this.token;
      if (!token) return null;

      try {
        const { data } = await apiService.getCurrentSession();
        // The player may have joined another game while this request was in flight.
        if (this.token !== token) return null;
        this.applyState(data);
        return data;
      } catch (error) {
        if (this.token !== token) return null;
        const status = error.response?.status;
        if (status === 401 || status === 403 || status === 404) {
          this.disconnectSocket();
          this.clearIdentity();
        }
        return null;
      }
    },
    async updateConfig(config) {
      if (!this.session) return;
      const { data } = await apiService.updateConfig(this.session.code, config);
      this.applyState(data);
      return data;
    },
    async addBot() {
      if (!this.session) return;
      const { data } = await apiService.addBot(this.session.code);
      this.applyState(data);
      return data;
    },
    async startSelection() {
      if (!this.session) return;
      const { data } = await apiService.startSelection(this.session.code);
      this.applyState(data);
      return data;
    },
    async startRound() {
      if (!this.session) return;
      const { data } = await apiService.startRound(this.session.code);
      this.applyState(data);
      return data;
    },
    async deleteMusic(musicId) {
      if (!this.session || !this.player) return;
      const { data } = await apiService.deleteMusic(this.session.code, musicId);
      this.applyState(data);
      return data;
    },
    async startVoting() {
      if (!this.session) return;
      const { data } = await apiService.startVoting(this.session.code);
      this.applyState(data);
      return data;
    },
    async submitVote(musicId, guessedPlayerId) {
      if (!this.session || !this.player) return;
      const { data } = await apiService.submitVote(this.session.code, {
        musicId,
        guessedPlayerId,
      });
      this.applyState(data);
      return data;
    },
    async submitBlindTestAnswer(musicId, answerTitle, answerArtist) {
      if (!this.session || !this.player) return;
      const { data } = await apiService.submitBlindTestAnswer(this.session.code, {
        musicId,
        answerTitle,
        answerArtist,
      });
      this.applyState(data);
      return data;
    },
    async loadResults(code) {
      const { data } = await apiService.getResults(code);
      this.ranking = data.ranking || [];
      this.applyState(data);
      return data;
    },
    async resetSession() {
      if (!this.session) return;
      const { data } = await apiService.resetSession(this.session.code);
      this.applyState(data);
      this.musics = [];
      this.currentMusic = null;
      this.votes = null;
      this.voteProgress = null;
      this.musicCounts = null;
      this.ranking = [];
      return data;
    },
    async promotePlayer(targetPlayerId) {
      if (!this.session || !this.player) return;
      const { data } = await apiService.promotePlayer(this.session.code, targetPlayerId);
      this.applyState(data);
      return data;
    },
    async kickPlayer(targetPlayerId) {
      if (!this.session || !this.player) return;
      const { data } = await apiService.kickPlayer(this.session.code, targetPlayerId);
      this.applyState(data);
      return data;
    },
    async advanceRound() {
      if (!this.session) return;
      const { data } = await apiService.advanceRound(this.session.code);
      this.applyState(data);
      return data;
    },
    async regenerateAvatar(playerId) {
      if (!this.session || !this.player) return;
      const { data } = await apiService.regenerateAvatar(this.session.code, playerId);
      this.applyState(data);
      return data;
    },
    addNotification(message, type = 'info') {
      // Avoid stacking identical toasts when an event is emitted repeatedly.
      if (this.notifications.some(n => n.message === message && n.type === type)) return null;
      const id = Date.now() + Math.random().toString(36).substring(2, 9);
      if (this.notifications.length >= 3) {
        this.notifications.shift();
      }
      this.notifications.push({ id, message, type });
      setTimeout(() => {
        this.removeNotification(id);
      }, 5000);
      return id;
    },
    removeNotification(id) {
      this.notifications = this.notifications.filter(n => n.id !== id);
    },
    connectSocket(code) {
      if (!this.token) return;
      const playerId = this.player?.id || null;

      socketService.off('state:update');
      socketService.off('sound:play');
      socketService.off('player:kicked');
      socketService.off('session:deleted');
      socketService.off('game:error');
      socketService.off('connect');
      socketService.off('disconnect');
      socketService.off('connect_error');

      socketService.join(code, this.token);

      socketService.on('state:update', (state) => {
        if (state && state.serverTime) {
          this.updateServerTimeOffset(state.serverTime);
        }
        this.session = state.session;
        this.players = state.players;
        this.musics = state.musics || [];
        this.currentMusic = state.currentMusic || null;
        this.votes = state.votes || null;
        this.voteProgress = state.voteProgress || null;
        this.musicCounts = state.musicCounts || null;
        if (state.ranking) this.ranking = state.ranking;
        if (state.player) {
          this.player = state.player;
          localStorage.setItem('music_game_player', JSON.stringify(state.player));
        }
      });

      socketService.on('sound:play', ({ type }) => {
        import('../services/soundService.js').then((module) => {
          module.default.play(type);
        });
      });

      socketService.on('connect_error', (error) => {
        const message = error?.message || 'Connexion refusée par le serveur';
        this.addNotification(message, 'error');

        // The player row no longer exists (kicked, session reaped, database
        // reset). Retrying forever would leave the page stuck on stale data.
        if (/Jeton joueur invalide|Authentification requise/.test(message)) {
          this.leaveSession();
          if (window.location.pathname !== '/') window.location.href = '/';
        }
      });

      socketService.on('game:error', ({ message } = {}) => {
        if (!message) return;
        this.addNotification(message, 'error');
        if (message === 'Session introuvable') {
          this.leaveSession();
          if (window.location.pathname !== '/') window.location.href = '/';
        }
      });

      socketService.on('player:kicked', () => {
        alert("Vous avez été exclu (kicked) de la partie par l'hôte.");
        this.leaveSession();
        window.location.href = '/';
      });

      socketService.on('session:deleted', () => {
        alert("L'hôte a quitté ou la partie a été supprimée. Retour à l'accueil.");
        this.leaveSession();
        window.location.href = '/';
      });

      socketService.on('connect', () => {
        // A successful initial or automatic reconnection is expected: the UI
        // already reflects it, so no toast is needed.
        if (connectionLostNoticeTimer) {
          clearTimeout(connectionLostNoticeTimer);
          connectionLostNoticeTimer = null;
        }
        if (connectionLostNoticeId) {
          this.removeNotification(connectionLostNoticeId);
          connectionLostNoticeId = null;
        }
      });

      socketService.on('disconnect', (reason) => {
        // The socket was closed on purpose (leaving the session).
        if (reason === 'io client disconnect' || connectionLostNoticeTimer) return;
        connectionLostNoticeTimer = setTimeout(() => {
          connectionLostNoticeTimer = null;
          connectionLostNoticeId = this.addNotification(
            'Connexion perdue. Tentative de reconnexion...',
            'warning'
          );
        }, CONNECTION_LOST_NOTICE_DELAY);
      });
    },
    disconnectSocket() {
      if (connectionLostNoticeTimer) {
        clearTimeout(connectionLostNoticeTimer);
        connectionLostNoticeTimer = null;
      }
      connectionLostNoticeId = null;
      socketService.disconnect();
    },
    leaveSession() {
      this.disconnectSocket();
      this.clearIdentity();
      this.session = null;
      this.players = [];
      this.musics = [];
      this.currentMusic = null;
      this.votes = null;
      this.voteProgress = null;
      this.musicCounts = null;
      this.ranking = [];
    },
    updateServerTimeOffset(serverTime) {
      if (serverTime) {
        this.serverTimeOffset = new Date(serverTime).getTime() - Date.now();
      }
    }
  },
});
