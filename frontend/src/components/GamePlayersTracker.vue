<template>
  <div v-if="store.session && store.session.phase !== 'waiting'" class="tracker-outer-container fixed bottom-0 left-0 right-0 z-[100] flex justify-center items-end pointer-events-none px-4 pb-0">
    <!-- Horizontal Deck Container -->
    <div 
      class="flex gap-2.5 sm:gap-4 items-end overflow-visible max-w-full pointer-events-auto pt-16 pb-0 scrollbar-none snap-x"
      @mouseleave="activePlayerId = null"
    >
      <div v-for="(player, index) in sortedPlayers" :key="player.id" 
        @click="toggleActive(player.id)"
        class="player-card-dock relative flex flex-col items-center justify-start bg-gradient-to-b from-slate-900/92 to-slate-950/98 backdrop-blur-md border border-white/[0.06] border-t-white/[0.12] shadow-2xl transition-all select-none cursor-pointer"
        :class="{ 
          'opacity-60': !player.is_connected,
          'active': activePlayerId === player.id
        }"
      >
        <!-- Avatar overlapping top of card (half-outside) -->
        <div class="avatar-wrapper absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex-shrink-0">
          <!-- Rank badge for non-selection phase, placed over the avatar -->
          <span v-if="!isSelectionPhase && getPlayerRank(player) !== null" 
            class="absolute -top-1.5 -left-1.5 z-30 w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center text-[9px] sm:text-[10px] font-black rounded-full border shadow-md font-mono select-none"
            :class="[
              getPlayerRank(player) === 1 ? 'bg-yellow-400 text-slate-950 border-yellow-300 shadow-yellow-500/30' :
              getPlayerRank(player) === 2 ? 'bg-slate-300 text-slate-950 border-slate-200' :
              getPlayerRank(player) === 3 ? 'bg-amber-600 text-white border-amber-500' :
              'bg-slate-800 text-slate-350 border-slate-700'
            ]"
          >
            {{ getPlayerRank(player) }}
          </span>

          <img v-if="player.avatar_seed" 
            :src="`https://api.dicebear.com/9.x/notionists-neutral/svg?seed=${player.avatar_seed}&backgroundColor=6366f1,8b5cf6,38bdf8,f43f5e,10b981`" 
            class="w-9 h-9 sm:w-11 sm:h-11 rounded-full border border-white/[0.08] bg-[var(--surface-overlay)] shadow-lg" 
            :alt="player.name" 
            loading="lazy"
          />
          <span :class="['absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-slate-900', player.is_connected ? 'bg-[var(--clr-success)] animate-pulse' : 'bg-[var(--clr-danger)]']"></span>
        </div>

        <!-- Content of the card -->
        <div class="card-content flex flex-col items-center justify-start w-full px-2">
          <!-- Score (Only info visible under avatar in collapsed state) -->
          <div class="score-display font-extrabold text-xs sm:text-sm tracking-wide select-none">
            <span v-if="isSelectionPhase" :class="isReady(player) ? 'text-emerald-450 font-black' : 'text-slate-400/80 font-semibold'">
              🎵 {{ getMusicCount(player) }}/{{ maxMusics }}
            </span>
            <span v-else class="text-[var(--clr-accent)] font-black text-sm sm:text-base">
              {{ player.score || 0 }}<span class="text-[10px] sm:text-xs font-semibold text-slate-400/70 ml-0.5">pt</span>
            </span>
          </div>

          <!-- Extended details (revealed when card is lifted/hovered/active) -->
          <div class="extended-info flex flex-col items-center gap-0.5 sm:gap-1 w-full text-center mt-2.5 opacity-0 transform translate-y-2">
            <p class="font-black text-xs sm:text-sm tracking-wide text-slate-100 truncate max-w-full select-all">{{ player.name }}</p>
            
            <div class="flex gap-1 items-center justify-center flex-wrap max-w-full mt-0.5">
              <span v-if="player.is_bot" class="text-[8px] sm:text-[9px] bg-cyan-500/10 text-cyan-400 px-1.5 py-0.2 rounded font-black border border-cyan-500/20 uppercase tracking-widest">Bot</span>
              <span v-if="player.name === store.session?.host_name" class="text-[8px] sm:text-[9px] bg-purple-500/10 text-purple-400 px-1.5 py-0.2 rounded font-black border border-purple-500/20 uppercase tracking-widest">Hôte</span>
            </div>
            
            <!-- Live stats (guesses/votes) -->
            <div v-if="!isSelectionPhase" class="flex gap-2 text-[9px] sm:text-[10px] font-extrabold text-slate-350 mt-1.5 bg-slate-950/40 px-2 py-0.5 rounded-full border border-white/[0.03] shadow-inner select-none">
              <span title="Bonnes réponses" class="flex items-center gap-0.5">🎯 <span class="font-mono text-slate-200">{{ player.correctGuesses || 0 }}</span></span>
              <span title="Votes reçus" class="flex items-center gap-0.5">💜 <span class="font-mono text-slate-200">{{ player.votesReceived || 0 }}</span></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useGameStore } from '../stores/gameStore';
import { getPlayersRankings } from '../utils/ranking';

const store = useGameStore();
const activePlayerId = ref(null);

const isSelectionPhase = computed(() => store.session?.phase === 'selection');
const rankings = computed(() => getPlayersRankings(store.players));
const getPlayerRank = (player) => rankings.value[player.id];

const maxMusics = computed(() => store.session?.max_musics_per_player || 2);

const getMusicCount = (player) => {
  if (!store.musicCounts) return 0;
  return store.musicCounts[player.id] || 0;
};

const isReady = (player) => {
  return getMusicCount(player) >= maxMusics.value;
};

const toggleActive = (playerId) => {
  if (activePlayerId.value === playerId) {
    activePlayerId.value = null;
  } else {
    activePlayerId.value = playerId;
  }
};

const sortedPlayers = computed(() => {
  if (!store.players) return [];
  const playersCopy = [...store.players];
  
  if (isSelectionPhase.value) {
    // Sort: connected first, then ready (complete submissions), then alphabetically
    return playersCopy.filter(p => !p.is_observer).sort((a, b) => {
      if (a.is_connected !== b.is_connected) return b.is_connected ? -1 : 1;
      const aReady = isReady(a) ? 1 : 0;
      const bReady = isReady(b) ? 1 : 0;
      if (aReady !== bReady) return bReady - aReady;
      return a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });
    });
  } else {
    // Sort: score descending, then connected first, then alphabetically
    return playersCopy.filter(p => !p.is_observer).sort((a, b) => {
      const aScore = a.score || 0;
      const bScore = b.score || 0;
      if (bScore !== aScore) return bScore - aScore;
      if (a.is_connected !== b.is_connected) return b.is_connected ? -1 : 1;
      return a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });
    });
  }
});
</script>

<style scoped>
.tracker-outer-container {
  height: 150px;
  overflow: hidden;
}
@media (min-width: 640px) {
  .tracker-outer-container {
    height: 200px;
  }
}

/* Responsive docked layout & lifting effect */
.player-card-dock {
  width: 76px;
  height: 104px;
  padding-top: 24px;
  transform: translateY(54px);
  border-top-left-radius: 20px;
  border-top-right-radius: 20px;
  border-bottom: 0 !important; /* Merge seamlessly with the screen bottom */
  /* Smooth ease-out-expo transition curve (no overshoot to avoid bottom gaps) */
  transition: 
    transform 0.45s cubic-bezier(0.16, 1, 0.3, 1), 
    border-radius 0.45s cubic-bezier(0.16, 1, 0.3, 1),
    background-color 0.3s ease, 
    border-color 0.3s ease, 
    box-shadow 0.3s ease;
}

/* Extended details are max-height and opacity transition based */
.extended-info {
  max-height: 0;
  overflow: hidden;
  opacity: 0;
  transform: translateY(8px);
  transition: 
    max-height 0.45s cubic-bezier(0.16, 1, 0.3, 1), 
    opacity 0.3s ease, 
    transform 0.3s ease;
}

.player-card-dock:hover .extended-info,
.player-card-dock.active .extended-info {
  max-height: 72px;
  opacity: 1;
  transform: translateY(0);
}

/* Scale avatar on hover/active */
.player-card-dock:hover .avatar-wrapper img,
.player-card-dock.active .avatar-wrapper img {
  transform: scale(1.12) translateY(-2px);
}

.player-card-dock:hover,
.player-card-dock.active {
  transform: translateY(0px); /* Anchor perfectly at the bottom edge */
  background-color: rgba(15, 23, 42, 0.98);
  border-color: rgba(56, 189, 248, 0.3);
  border-top-color: rgba(255, 255, 255, 0.2);
  border-top-left-radius: 28px;
  border-top-right-radius: 28px;
  box-shadow: 
    0 20px 40px -15px rgba(56, 189, 248, 0.3),
    0 8px 16px -8px rgba(56, 189, 248, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

@media (min-width: 640px) {
  .player-card-dock {
    width: 108px;
    height: 140px;
    padding-top: 32px;
    transform: translateY(74px);
    border-top-left-radius: 28px;
    border-top-right-radius: 28px;
  }
  .player-card-dock:hover,
  .player-card-dock.active {
    transform: translateY(0px); /* Anchor perfectly at the bottom edge */
    border-top-left-radius: 38px;
    border-top-right-radius: 38px;
    box-shadow: 
      0 25px 50px -12px rgba(56, 189, 248, 0.35),
      0 12px 24px -10px rgba(56, 189, 248, 0.2),
      inset 0 1.5px 0 rgba(255, 255, 255, 0.2);
  }
}

.avatar-wrapper img {
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Hide standard scrollbars for clean custom horizontal layout */
.scrollbar-none::-webkit-scrollbar {
  display: none;
}
.scrollbar-none {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
