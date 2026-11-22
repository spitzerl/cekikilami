<template>
  <div
    v-if="store.session && store.session.phase !== 'waiting'"
    class="dock"
    role="region"
    aria-label="Joueurs et scores"
  >
    <div class="dock-inner">
      <span class="dock-label">Joueurs</span>
      <div class="dock-scroll">
        <button
          v-for="player in sortedPlayers"
          :key="player.id"
          type="button"
          :class="[
            'dock-player',
            activePlayerId === player.id ? 'is-active' : '',
            isLocalPlayer(player) ? 'is-local' : '',
            player.is_connected ? '' : 'is-offline',
          ]"
          :aria-expanded="activePlayerId === player.id"
          :aria-label="`${player.name}${isLocalPlayer(player) ? ' (vous)' : ''} — ${isSelectionPhase ? `${getMusicCount(player)} morceau${getMusicCount(player) > 1 ? 'x' : ''} sur ${maxMusics}` : `${player.score || 0} points`}`"
          @click="toggleActive(player.id)"
          @keydown.esc="activePlayerId = null"
        >
          <span class="dock-avatar">
            <img
              v-if="player.avatar_seed"
              :src="avatarUrl(player.avatar_seed)"
              class="avatar"
              :alt="''"
              loading="lazy"
            />
            <span v-else class="avatar avatar-sm avatar-fallback">{{ initials(player.name) }}</span>
            <span
              v-if="!isSelectionPhase && getPlayerRank(player) !== null"
              class="dock-rank"
              role="img"
              :aria-label="`Rang ${getPlayerRank(player)}`"
            >{{ getPlayerRank(player) }}</span>
            <span :class="['dock-status', player.is_connected ? '' : 'is-offline']"></span>
          </span>

          <span class="dock-name">{{ player.name }}</span>

          <span v-if="isSelectionPhase" class="dock-score">
            <span v-if="isReady(player)" class="dock-ready"><AppIcon name="check" :size="12" /></span>
            {{ getMusicCount(player) }}/{{ maxMusics }}
          </span>
          <span v-else class="dock-score">{{ player.score || 0 }}<span class="faint"> pt</span></span>
        </button>
      </div>
    </div>

    <Transition name="pop">
      <div v-if="activePlayer" class="dock-detail">
        <img
          v-if="activePlayer.avatar_seed"
          :src="avatarUrl(activePlayer.avatar_seed)"
          class="avatar avatar-lg"
          alt=""
        />
        <span v-else class="avatar avatar-lg avatar-fallback">{{ initials(activePlayer.name) }}</span>
        <div style="min-width: 0">
          <p class="dock-detail-name">
            {{ activePlayer.name }}
            <span v-if="isLocalPlayer(activePlayer)" class="tag tag-accent" style="margin-left: 4px">Vous</span>
          </p>
          <div class="dock-detail-stats">
            <span v-if="activePlayer.is_bot">Bot</span>
            <span v-if="activePlayer.name === store.session?.host_name">Hôte</span>
            <span v-if="!isSelectionPhase">🎯 {{ activePlayer.correctGuesses || 0 }} correct</span>
            <span v-if="!isSelectionPhase">💜 {{ activePlayer.votesReceived || 0 }} votes</span>
            <span v-if="isSelectionPhase">{{ getMusicCount(activePlayer) }} / {{ maxMusics }} morceaux</span>
            <span>{{ activePlayer.is_connected ? 'En ligne' : 'Hors ligne' }}</span>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useGameStore } from '../stores/gameStore';
import { getPlayersRankings } from '../utils/ranking';
import AppIcon from './AppIcon.vue';

const store = useGameStore();
const activePlayerId = ref(null);

const isSelectionPhase = computed(() => store.session?.phase === 'selection');
const rankings = computed(() => getPlayersRankings(store.players));
const getPlayerRank = (player) => rankings.value[player.id];
const isLocalPlayer = (player) => store.player && player.id === store.player.id;

const maxMusics = computed(() => store.session?.max_musics_per_player || 2);

const activePlayer = computed(() =>
  sortedPlayers.value.find((player) => player.id === activePlayerId.value) || null
);

const getMusicCount = (player) => {
  if (!store.musicCounts) return 0;
  return store.musicCounts[player.id] || 0;
};

const isReady = (player) => getMusicCount(player) >= maxMusics.value;

const initials = (name) =>
  (name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();

const avatarUrl = (seed) =>
  `https://api.dicebear.com/9.x/notionists-neutral/svg?seed=${encodeURIComponent(seed)}&backgroundColor=e9e8e2,f1f1ec,ffffff`;

const toggleActive = (playerId) => {
  activePlayerId.value = activePlayerId.value === playerId ? null : playerId;
};

const closeOnOutsideClick = (event) => {
  if (activePlayerId.value && !event.target.closest('.dock')) {
    activePlayerId.value = null;
  }
};

onMounted(() => document.addEventListener('click', closeOnOutsideClick));
onUnmounted(() => document.removeEventListener('click', closeOnOutsideClick));

const sortedPlayers = computed(() => {
  if (!store.players) return [];
  const playersCopy = [...store.players];

  if (isSelectionPhase.value) {
    return playersCopy.filter((p) => !p.is_observer).sort((a, b) => {
      if (a.is_connected !== b.is_connected) return a.is_connected ? -1 : 1;
      const aReady = isReady(a) ? 1 : 0;
      const bReady = isReady(b) ? 1 : 0;
      if (aReady !== bReady) return bReady - aReady;
      return a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });
    });
  }

  return playersCopy.filter((p) => !p.is_observer).sort((a, b) => {
    const aScore = a.score || 0;
    const bScore = b.score || 0;
    if (bScore !== aScore) return bScore - aScore;
    if (a.is_connected !== b.is_connected) return a.is_connected ? -1 : 1;
    return a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });
  });
});
</script>

<style scoped>
.dock-status {
  position: absolute;
  right: -1px;
  bottom: -1px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1.5px solid var(--surface);
  background: var(--success);
}
.dock-status.is-offline { background: var(--ink-3); }
</style>
