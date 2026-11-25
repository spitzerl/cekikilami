<template>
  <div :class="{ 'game-layout': true, 'no-dock': !showScoreboard }">
    <GameHeader
      title="Sélection"
      :subtitle="selectionSubtitle"
      :step="2"
    >
      <template #actions>
        <div class="status-bar" role="group" aria-label="État de la sélection">
          <span
            :class="['status-segment', 'is-timer', remainingTime < 20 ? 'is-urgent' : '']"
            role="timer"
            :aria-label="`Temps restant : ${formatTime(remainingTime)}`"
          >
            <AppIcon name="clock" :size="14" />
            <span class="status-value">{{ formatTime(remainingTime) }}</span>
          </span>
          <span
            class="status-segment"
            :title="`${submittedTracks} morceaux envoyés sur ${expectedTracks} attendus`"
            :aria-label="`${submittedTracks} morceaux envoyés sur ${expectedTracks} attendus`"
          >
            <AppIcon name="music" :size="14" />
            <span>
              <span class="status-value">{{ submittedTracks }}/{{ expectedTracks }}</span>
              morceaux
            </span>
          </span>
          <span
            :class="['status-segment', allPlayersReady ? 'is-ready' : '']"
            :title="`${readyCount} joueurs prêts sur ${activeCount} connectés`"
            :aria-label="`${readyCount} joueurs prêts sur ${activeCount} connectés`"
          >
            <span :class="['status-dot', allPlayersReady ? 'is-online' : '']" aria-hidden="true"></span>
            <span>
              <span class="status-value">{{ readyCount }}/{{ activeCount }}</span>
              prêts
            </span>
          </span>
        </div>
        <button
          v-if="isHost"
          type="button"
          class="btn btn-primary btn-waiting"
          :disabled="!allPlayersReady"
          :title="allPlayersReady ? 'Tous les joueurs ont choisi. Passer au vote.' : 'Tous les joueurs n’ont pas encore choisi.'"
          @click="forceStartVoting"
        >
          <AppIcon name="forward" :size="15" />
          Passer au vote
        </button>
      </template>
    </GameHeader>

    <main class="game-shell game-body">
      <!-- Mobile tabs -->
      <div class="selection-tabs lg:hidden" role="tablist" aria-label="Recherche ou sélection">
        <button
          id="tab-search"
          type="button"
          role="tab"
          :aria-selected="activeTab === 'search'"
          aria-controls="panel-search"
          :class="['selection-tab', activeTab === 'search' ? 'is-active' : '']"
          @click="activeTab = 'search'"
        >
          <AppIcon name="search" :size="15" />
          Rechercher
        </button>
        <button
          id="tab-selected"
          type="button"
          role="tab"
          :aria-selected="activeTab === 'selected'"
          aria-controls="panel-selected"
          :class="['selection-tab', activeTab === 'selected' ? 'is-active' : '']"
          @click="activeTab = 'selected'"
        >
          <AppIcon name="music" :size="15" />
          Sélection
          <span class="count-pill">
            {{ store.musics.length }}/{{ maxMusics }}
          </span>
        </button>
      </div>

      <div class="selection-grid">
        <!-- Search -->
        <section
          id="panel-search"
          class="selection-search"
          :class="activeTab === 'search' ? 'block' : 'hidden lg:block'"
          aria-label="Rechercher un morceau"
        >
          <div v-if="remainingPicks > 0">
            <div class="input-wrap" style="margin-bottom: 12px">
              <label for="music-search" class="sr-only">Rechercher un artiste ou un titre</label>
              <input
                id="music-search"
                v-model="searchQuery"
                class="input input-search"
                placeholder="Rechercher un artiste ou un titre…"
                autocomplete="off"
                autocorrect="off"
                spellcheck="false"
              />
              <AppIcon
                v-if="!isSearching"
                name="search"
                :size="16"
                class="input-icon"
              />
              <AppIcon
                v-else
                name="loader"
                :size="16"
                class="input-icon animate-spin"
              />
            </div>

            <p v-if="searchError" role="alert" class="hint" style="color: var(--danger); margin-bottom: 8px">
              {{ searchError }}
            </p>

            <TransitionGroup
              v-if="tracks.length"
              ref="trackListRef"
              name="list"
              tag="div"
              class="track-list"
              :class="{ 'has-fade-top': canScrollUp, 'has-fade-bottom': canScrollDown }"
              aria-label="Résultats de recherche"
              @scroll="updateTrackFades"
            >
              <div v-for="track in tracks" :key="track.id" class="track-row">
                <div class="media-row">
                  <img
                    v-if="track.cover && !isCoverFailed(track.cover)"
                    :src="formatCoverUrl(track.cover)"
                    class="media-cover"
                    :alt="`Pochette de ${track.title}`"
                    loading="lazy"
                    @error="markCoverFailed(track.cover)"
                  />
                  <span v-else class="media-cover media-cover-fallback">
                    <AppIcon name="music" :size="18" />
                  </span>
                  <div class="media-text">
                    <p class="media-title">{{ track.title }}</p>
                    <p class="media-sub">{{ track.artist }}</p>
                  </div>
                </div>

                <div class="track-row-actions">
                  <button
                    type="button"
                    class="btn btn-ghost btn-icon btn-sm"
                    :aria-label="previewUrl === track.preview && isPlaying ? `Mettre ${track.title} en pause` : `Écouter ${track.title}`"
                    @click="togglePreview(track)"
                  >
                    <AppIcon :name="previewUrl === track.preview && isPlaying ? 'pause' : 'play'" :size="14" />
                  </button>
                  <button
                    type="button"
                    class="btn btn-secondary btn-sm"
                    :aria-label="`Ajouter ${track.title} à votre sélection`"
                    @click="chooseTrack(track)"
                  >
                    <AppIcon name="plus" :size="14" />
                    <span class="hidden sm:inline">Ajouter</span>
                  </button>
                </div>
              </div>
            </TransitionGroup>

            <div v-else-if="!isSearching && !searchError" class="hint" style="padding: 20px 0; text-align: center">
              Aucun résultat. Essayez un autre artiste.
            </div>
          </div>

          <div v-else class="selection-note">
            <AppIcon name="check-circle" :size="17" />
            <div>
              <strong>Sélection complète</strong>
              <p>Vous avez proposé {{ maxMusics }} morceau{{ maxMusics > 1 ? 'x' : '' }}. Attendez la fin du chrono ou la validation de l’hôte.</p>
            </div>
          </div>
        </section>

        <!-- Selection -->
        <section
          id="panel-selected"
          class="selection-side"
          :class="activeTab === 'selected' ? 'block' : 'hidden lg:block'"
          aria-labelledby="selected-heading"
        >
          <div class="selection-side-head">
            <h2 id="selected-heading" class="selection-side-title">Votre sélection</h2>
            <span
              class="count-pill"
              :aria-label="`${store.musics.length} morceau${store.musics.length > 1 ? 'x' : ''} sur ${maxMusics}`"
            >{{ store.musics.length }}/{{ maxMusics }}</span>
          </div>

          <TransitionGroup v-if="store.musics.length" name="list" tag="div" class="row-list">
            <div v-for="music in store.musics" :key="music.id" class="row row-static">
              <div class="media-row">
                <img
                  v-if="music.cover_url && !isCoverFailed(music.cover_url)"
                  :src="formatCoverUrl(music.cover_url)"
                  class="media-cover"
                  :alt="`Pochette de ${music.title}`"
                  loading="lazy"
                  @error="markCoverFailed(music.cover_url)"
                />
                <span v-else class="media-cover media-cover-fallback">
                  <AppIcon name="music" :size="18" />
                </span>
                <div class="media-text">
                  <p class="media-title">{{ music.title }}</p>
                  <p class="media-sub">{{ music.artist }}</p>
                </div>
              </div>
              <button
                type="button"
                class="btn btn-ghost btn-icon btn-sm"
                style="color: var(--danger)"
                :aria-label="`Retirer ${music.title}`"
                @click="deleteSubmittedMusic(music.id)"
              >
                <AppIcon name="trash" :size="14" />
              </button>
            </div>
          </TransitionGroup>

          <div v-else class="selection-empty">
            <p>Aucun morceau pour l’instant.</p>
            <p class="hint">Ajoutez-en un depuis les résultats.</p>
          </div>
        </section>
      </div>
    </main>

    <GamePlayersTracker />
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import apiService from '../services/apiService';
import { useGameStore } from '../stores/gameStore';
import GameHeader from './GameHeader.vue';
import GamePlayersTracker from './GamePlayersTracker.vue';
import AppIcon from './AppIcon.vue';

const route = useRoute();
const router = useRouter();
const store = useGameStore();

const showScoreboard = computed(() => store.session?.show_scoreboard !== false);

const searchQuery = ref('');
const tracks = ref([]);
const isSearching = ref(false);
const searchError = ref('');
const activeTab = ref('search');
const remainingTime = ref(0);
const trackListRef = ref(null);
const canScrollUp = ref(false);
const canScrollDown = ref(false);
let timerInterval = null;

const previewUrl = ref(null);
const isPlaying = ref(false);
const failedCovers = ref(new Set());
let audioObject = null;

const formatCoverUrl = (url) => (url ? url.replace(/^http:\/\//i, 'https://') : '');
const isCoverFailed = (url) => failedCovers.value.has(url);
const markCoverFailed = (url) => failedCovers.value.add(url);

const formatTime = (secs) => {
  const m = Math.floor(secs / 60), s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const updateTimer = () => {
  if (store.session?.timer_ends_at) {
    remainingTime.value = Math.max(0, Math.round((new Date(store.session.timer_ends_at).getTime() - store.correctedNow()) / 1000));
  } else {
    remainingTime.value = 0;
  }
};

const updateTrackFades = () => {
  const el = trackListRef.value?.$el || trackListRef.value;
  if (!el) return;
  canScrollUp.value = el.scrollTop > 2;
  canScrollDown.value = el.scrollTop + el.clientHeight < el.scrollHeight - 2;
};

watch([tracks, isSearching], async () => {
  await nextTick();
  updateTrackFades();
});

const isHost = computed(() => store.isHost);

const maxMusics = computed(() => store.session?.max_musics_per_player || 2);

const remainingPicks = computed(() => Math.max(0, maxMusics.value - store.musics.length));

const selectionSubtitle = computed(
  () => `Choisissez jusqu’à ${maxMusics.value} morceau${maxMusics.value > 1 ? 'x' : ''}, en secret.`
);

const activePlayers = computed(() =>
  (store.players || []).filter((p) => p.is_connected && !p.is_observer)
);

const participantPlayers = computed(() =>
  (store.players || []).filter((p) => !p.is_observer)
);

const submittedTracks = computed(() =>
  participantPlayers.value.reduce(
    (total, player) => total + (store.musicCounts?.[player.id] || 0),
    0
  )
);

const expectedTracks = computed(() => participantPlayers.value.length * maxMusics.value);

const readyCount = computed(() =>
  activePlayers.value.filter((p) => (store.musicCounts?.[p.id] || 0) >= maxMusics.value).length
);

const activeCount = computed(() => activePlayers.value.length);

const allPlayersReady = computed(
  () => activeCount.value > 0 && readyCount.value >= activeCount.value
);

const handleKeyDown = (e) => {
  if (e.code === 'Space' && isHost.value && allPlayersReady.value && !['INPUT', 'TEXTAREA', 'BUTTON', 'A', 'SELECT'].includes(document.activeElement?.tagName)) {
    e.preventDefault(); forceStartVoting();
  }
};

onMounted(async () => {
  await store.loadSession(route.params.code);
  if (!store.token || !store.player || store.player.session_id !== store.session?.id) {
    router.push(`/game/${route.params.code}`);
    return;
  }
  store.connectSocket(route.params.code);
  updateTimer();
  timerInterval = setInterval(updateTimer, 1000);
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('resize', updateTrackFades);
  searchTracks();
});

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval);
  if (audioObject) audioObject.pause();
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('resize', updateTrackFades);
});

watch(() => store.session?.phase, (p) => {
  if (p === 'voting') router.push(`/game/${route.params.code}/voting`);
  if (p === 'results') router.push(`/game/${route.params.code}/results`);
  if (p === 'waiting') router.push(`/game/${route.params.code}`);
});

const searchTracks = async () => {
  isSearching.value = true; searchError.value = '';
  try {
    const { data } = await apiService.searchDeezer(searchQuery.value.trim() || '');
    tracks.value = data?.tracks || [];
    if (!tracks.value.length) searchError.value = 'Aucun résultat trouvé.';
  } catch {
    tracks.value = []; searchError.value = 'Recherche indisponible.';
  } finally { isSearching.value = false; }
};

let searchTimeout = null;
watch(searchQuery, () => {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(searchTracks, 300);
});

const togglePreview = (track) => {
  if (audioObject && previewUrl.value === track.preview) {
    if (isPlaying.value) { audioObject.pause(); isPlaying.value = false; }
    else { audioObject.play(); isPlaying.value = true; }
  } else {
    if (audioObject) audioObject.pause();
    previewUrl.value = track.preview;
    audioObject = new Audio(track.preview);
    audioObject.volume = store.volume;
    audioObject.play();
    isPlaying.value = true;
    audioObject.addEventListener('ended', () => { isPlaying.value = false; previewUrl.value = null; });
  }
};

watch(() => store.volume, (newVolume) => {
  if (audioObject) audioObject.volume = newVolume;
});

const chooseTrack = async (track) => {
  if (!store.player?.id) return;
  if (audioObject) { audioObject.pause(); isPlaying.value = false; }
  try {
    await apiService.addMusic(route.params.code, {
      title: track.title, artist: track.artist,
      deezerPreviewUrl: track.preview, coverUrl: track.cover,
    });
    await store.loadSession(route.params.code);
    searchQuery.value = '';
    if (store.musics.length >= maxMusics.value) {
      activeTab.value = 'selected';
    }
  } catch (err) { console.error('Failed to add music:', err); }
};

const deleteSubmittedMusic = async (id) => { try { await store.deleteMusic(id); } catch { /* noop */ } };
const forceStartVoting = async () => { if (isHost.value) try { await store.startVoting(); } catch { /* noop */ } };
</script>
