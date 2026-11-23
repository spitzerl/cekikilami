import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('music_game_token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default {
  createSession(hostName) {
    return api.post('/sessions', { hostName });
  },
  joinSession(code, playerName) {
    return api.post(`/sessions/${code}/join`, { playerName });
  },
  getSessionSummary(code) {
    return api.get(`/sessions/${code}/summary`);
  },
  getSession(code) {
    return api.get(`/sessions/${code}`);
  },
  updateConfig(code, config) {
    return api.post(`/sessions/${code}/config`, config);
  },
  addBot(code) {
    return api.post(`/sessions/${code}/bots`);
  },
  startSelection(code) {
    return api.post(`/sessions/${code}/start-selection`);
  },
  startRound(code) {
    return api.post(`/sessions/${code}/start-round`);
  },
  addMusic(code, payload) {
    if (payload.audio instanceof File) {
      const form = new FormData();
      Object.entries(payload).forEach(([key, value]) => {
        if (value !== undefined && value !== null) form.append(key, value);
      });
      return api.post(`/sessions/${code}/musics`, form);
    }
    return api.post(`/sessions/${code}/musics`, payload);
  },
  deleteMusic(code, musicId) {
    return api.delete(`/sessions/${code}/musics/${musicId}`);
  },
  searchDeezer(query = '') {
    return api.get('/deezer/search', { params: { q: query } });
  },
  startVoting(code) {
    return api.post(`/sessions/${code}/start-voting`);
  },
  submitVote(code, payload) {
    return api.post(`/sessions/${code}/votes`, payload);
  },
  submitBlindTestAnswer(code, payload) {
    return api.post(`/sessions/${code}/blind-test-answers`, payload);
  },
  getResults(code) {
    return api.get(`/sessions/${code}/results`);
  },
  finishSession(code) {
    return api.post(`/sessions/${code}/finish`);
  },
  resetSession(code) {
    return api.post(`/sessions/${code}/reset`);
  },
  promotePlayer(code, targetPlayerId) {
    return api.post(`/sessions/${code}/players/${targetPlayerId}/promote`);
  },
  kickPlayer(code, targetPlayerId) {
    return api.post(`/sessions/${code}/players/${targetPlayerId}/kick`);
  },
  advanceRound(code) {
    return api.post(`/sessions/${code}/advance-round`);
  },
  regenerateAvatar(code, playerId) {
    return api.post(`/sessions/${code}/players/${playerId}/avatar`);
  },
  avatarUrl(seed) {
    return `/api/avatars/${encodeURIComponent(seed)}`;
  },
};
