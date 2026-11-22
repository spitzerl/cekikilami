<template>
  <div class="game-layout">
    <GameHeader
      title="Sélection"
      :subtitle="`Choisissez jusqu’à ${store.session?.max_musics_per_player || 2} morceau${(store.session?.max_musics_per_player || 2) > 1 ? 'x' : ''} sur le thème. Votre sélection reste secrète.`"
      :step="2"
    >
      <template #actions>
        <div
          :class="['timer', remainingTime < 20 ? 'is-urgent' : '']"
          role="timer"
          :aria-label="`Temps restant : ${formatTime(remainingTime)}`"
        >
          <AppIcon name="clock" :size="15" />
          {{ formatTime(remainingTime) }}
        </div>
        <button
          v-if="isHost && allPlayersReady"
          type="button"
          class="btn btn-primary"
          title="Tous les joueurs ont choisi — passer au vote"
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
          Votre sélection
          <span class="count-pill">
            {{ store.musics.length }}/{{ store.session?.max_musics_per_player || 2 }}
          </span>
        </button>
      </div>

      <div class="grid lg:grid-cols-2 gap-4 items-start">
        <!-- Search -->
        <section
          id="panel-search"
          class="panel panel-pad"
          :class="activeTab === 'search' ? 'block' : 'hidden lg:block'"
          aria-labelledby="search-heading"
        >
          <div class="panel-head">
            <div>
              <h2 id="search-heading" class="panel-title">
                <AppIcon name="search" :size="16" />
                Chercher un morceau
              </h2>
              <p class="panel-sub">Artiste, titre ou les deux.</p>
            </div>
            <span class="count-pill">
              {{ store.musics.length }}/{{ store.session?.max_musics_per_player || 2 }}
            </span>
          </div>

          <div v-if="store.musics.length < (store.session?.max_musics_per_player || 2)">
            <div class="input-wrap" style="margin-bottom: 12px">
              <label for="music-search" class="sr-only">Rechercher un artiste ou un titre</label>
              <input
                id="music-search"
                v-model="searchQuery"
                class="input input-search"
                placeholder="Ex. Daft Punk, Billie Jean…"
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
              name="list"
              tag="div"
              class="track-list"
              aria-label="Résultats de recherche"
            >
              <div v-for="track in tracks" :key="track.id" class="track-row">
                <div class="media-row">
                  <img
                    v-if="track.cover"
                    :src="track.cover"
                    class="media-cover"
                    :alt="`Pochette de ${track.title}`"
                    loading="lazy"
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

          <div v-else class="empty-state">
            <span class="status-dot is-online"></span>
            <strong>Sélection complète</strong>
            <p>
              Vous avez proposé {{ store.session?.max_musics_per_player || 2 }} morceaux.
              Attendez la fin du chrono ou la validation de l’hôte.
            </p>
          </div>
        </section>

        <!-- Selection -->
        <section
          id="panel-selected"
          class="panel panel-pad"
          :class="activeTab === 'selected' ? 'block' : 'hidden lg:block'"
          aria-labelledby="selected-heading"
        >
          <div class="panel-head">
            <div>
              <h2 id="selected-heading" class="panel-title">
                <AppIcon name="music" :size="16" />
                Votre sélection
              </h2>
              <p class="panel-sub">Elle restera invisible jusqu’à la révélation.</p>
            </div>
            <div class="progress-dots" aria-hidden="true">
              <span
                v-for="i in (store.session?.max_musics_per_player || 2)"
                :key="i"
                :class="['progress-dot', i <= store.musics.length ? 'is-filled' : '']"
              ></span>
            </div>
          </div>

          <TransitionGroup v-if="store.musics.length" name="list" tag="div" class="row-list">
            <div v-for="music in store.musics" :key="music.id" class="row row-static">
              <div class="media-row">
                <img
                  v-if="music.cover_url"
                  :src="music.cover_url"
                  class="media-cover"
                  :alt="`Pochette de ${music.title}`"
                  loading="lazy"
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

          <div v-else class="empty-state">
            <AppIcon name="music" :size="20" />
            <strong>Aucune musique pour l’instant</strong>
            <p>Cherchez un morceau et ajoutez-le. Vous pouvez encore changer d’avis.</p>
          </div>
        </section>
      </div>
    </main>

    <GamePlayersTracker />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import apiService from '../services/apiService';
import { useGameStore } from '../stores/gameStore';
import GameHeader from './GameHeader.vue';
import GamePlayersTracker from './GamePlayersTracker.vue';
import AppIcon from './AppIcon.vue';

const route = useRoute();
const router = useRouter();
const store = useGameStore();

const searchQuery = ref('');
const tracks = ref([]);
const isSearching = ref(false);
const searchError = ref('');
const activeTab = ref('search');
const remainingTime = ref(0);
let timerInterval = null;

const previewUrl = ref(null);
const isPlaying = ref(false);
let audioObject = null;

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

const isHost = computed(() => store.player && store.session && store.player.name === store.session.host_name);

const allPlayersReady = computed(() => {
  if (!store.players || !store.musicCounts || !store.session) return false;
  const max = store.session.max_musics_per_player || 2;
  const active = store.players.filter(p => p.is_connected && !p.is_observer);
  return active.length > 0 && active.every(p => (store.musicCounts[p.id] || 0) >= max);
});

const handleKeyDown = (e) => {
  if (e.code === 'Space' && isHost.value && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
    e.preventDefault(); forceStartVoting();
  }
};

onMounted(async () => {
  if (!store.player) { router.push(`/game/${route.params.code}`); return; }
  await store.loadSession(route.params.code);
  store.connectSocket(route.params.code);
  updateTimer();
  timerInterval = setInterval(updateTimer, 1000);
  window.addEventListener('keydown', handleKeyDown);
  searchTracks();
});

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval);
  if (audioObject) audioObject.pause();
  window.removeEventListener('keydown', handleKeyDown);
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
    audioObject.volume = 0.5;
    audioObject.play();
    isPlaying.value = true;
    audioObject.addEventListener('ended', () => { isPlaying.value = false; previewUrl.value = null; });
  }
};

const chooseTrack = async (track) => {
  if (!store.player?.id) return;
  if (audioObject) { audioObject.pause(); isPlaying.value = false; }
  try {
    await apiService.addMusic(route.params.code, {
      playerId: String(store.player.id),
      title: track.title, artist: track.artist,
      deezerPreviewUrl: track.preview, coverUrl: track.cover,
    });
    await store.loadSession(route.params.code);
    searchQuery.value = '';
  } catch (err) { console.error('Failed to add music:', err); }
};

const deleteSubmittedMusic = async (id) => { try { await store.deleteMusic(id); } catch { /* noop */ } };
const forceStartVoting = async () => { if (isHost.value) try { await store.startVoting(); } catch { /* noop */ } };
</script>
