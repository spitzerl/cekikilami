<template>
  <div v-if="isVisible">
    <Transition name="pause">
      <div v-if="isOpen" class="overlay pause-overlay" @click.self="closeMenu">
        <div
          ref="dialog"
          class="dialog pause-dialog"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="currentTab === 'main' ? 'pause-title' : 'players-title'"
        >
          <template v-if="currentTab === 'main'">
            <header class="pause-head">
              <div class="pause-head-copy">
                <h2 id="pause-title" class="dialog-title">Menu de la partie</h2>
                <div class="pause-meta">
                  <span class="pause-phase">
                    <span class="status-dot is-live" aria-hidden="true"></span>
                    {{ phaseLabel }}
                  </span>
                  <span
                    v-if="timerLabel"
                    :class="['pause-timer', 'mono', isTimerUrgent ? 'is-urgent' : '']"
                    role="timer"
                    :aria-label="`Temps restant : ${timerLabel}`"
                  >
                    <AppIcon name="clock" :size="12" />
                    {{ timerLabel }}
                  </span>
                  <button
                    type="button"
                    :class="['pause-code', copied ? 'is-copied' : '']"
                    :title="copied ? 'Lien d’invitation copié' : 'Copier le lien d’invitation'"
                    :aria-label="copied ? 'Lien d’invitation copié' : `Copier le lien d’invitation du salon ${store.session?.code}`"
                    @click="copyLink"
                  >
                    <span class="mono">{{ store.session?.code }}</span>
                    <AppIcon :name="copied ? 'check' : 'copy'" :size="13" />
                  </button>
                  <span class="sr-only" aria-live="polite">{{ copied ? 'Lien d’invitation copié' : '' }}</span>
                </div>
              </div>
              <button
                ref="closeButton"
                type="button"
                class="btn btn-ghost btn-icon btn-sm"
                aria-label="Fermer le menu"
                @click="closeMenu"
              >
                <AppIcon name="x" :size="16" />
              </button>
            </header>

            <div class="pause-body">
              <section class="pause-section" aria-label="Joueurs">
                <button type="button" class="pause-players" @click="openPlayers">
                  <span class="pause-avatars" aria-hidden="true">
                    <template v-for="p in visiblePlayers" :key="p.id">
                      <img v-if="p.avatar_seed" :src="avatarUrl(p.avatar_seed)" class="avatar avatar-sm" alt="" />
                      <span v-else class="avatar avatar-sm avatar-fallback">{{ initials(p.name) }}</span>
                    </template>
                    <span v-if="extraPlayers" class="pause-avatars-more">+{{ extraPlayers }}</span>
                  </span>
                  <span class="pause-players-copy">
                    <span class="pause-players-title">{{ playerCountLabel }}</span>
                    <span class="pause-players-sub">{{ playersSummary }}</span>
                  </span>
                  <AppIcon name="chevron-right" :size="17" class="pause-chevron" />
                </button>
              </section>

              <section class="pause-section" aria-labelledby="pause-prefs-section">
                <div class="pause-section-head">
                  <span id="pause-prefs-section" class="label">Préférences</span>
                </div>

                <div class="pause-setting">
                  <div class="pause-setting-head">
                    <span class="pause-setting-label">Volume</span>
                    <span class="pause-setting-value mono">{{ volumePercent }} %</span>
                  </div>
                  <div class="volume-row">
                    <button
                      type="button"
                      class="btn btn-ghost btn-icon btn-sm"
                      :aria-label="store.volume === 0 ? 'Rétablir le son' : 'Couper le son'"
                      @click="toggleMute"
                    >
                      <AppIcon :name="store.volume === 0 ? 'volume-x' : store.volume < 0.5 ? 'volume-1' : 'volume-2'" :size="17" />
                    </button>
                    <input
                      v-model.number="store.volume"
                      class="range"
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      aria-label="Volume de la musique"
                      @input="updateStoreVolume"
                    />
                  </div>
                </div>

                <div class="pause-setting pause-setting-row">
                  <span class="pause-setting-label">Apparence</span>
                  <div class="seg pause-seg" role="group" aria-label="Thème de l’interface">
                    <button
                      type="button"
                      :class="['seg-btn', theme === 'dark' ? 'is-active' : '']"
                      :aria-pressed="theme === 'dark'"
                      @click="setTheme('dark')"
                    >Sombre</button>
                    <button
                      type="button"
                      :class="['seg-btn', theme === 'light' ? 'is-active' : '']"
                      :aria-pressed="theme === 'light'"
                      @click="setTheme('light')"
                    >Clair</button>
                  </div>
                </div>
              </section>

              <section v-if="isHost && !isWaitingRoom" class="pause-section" aria-labelledby="pause-host-section">
                <div class="pause-section-head">
                  <span id="pause-host-section" class="label">Hôte</span>
                </div>
                <p class="hint pause-host-hint">
                  {{ isFinished
                    ? 'Revenir au salon efface les morceaux et les scores de cette partie.'
                    : 'Revenir au salon efface la manche en cours et les morceaux proposés.' }}
                </p>
                <button type="button" class="btn btn-warning btn-block" @click="confirmReset">
                  <AppIcon name="rotate-ccw" :size="15" />
                  Retourner au salon d’attente
                </button>
              </section>
            </div>

            <footer class="pause-foot">
              <button type="button" class="btn btn-primary btn-block" @click="closeMenu">
                <AppIcon :name="isWaitingRoom || isFinished ? 'x' : 'play'" :size="15" />
                {{ resumeLabel }}
              </button>
              <button type="button" class="pause-leave" @click="confirmLeave">
                <AppIcon name="log-out" :size="15" />
                Quitter la partie
              </button>
              <p class="hint">Vous pourrez revenir avec le code du salon.</p>
              <p class="version-line">Cékikilami v{{ APP_VERSION }} · {{ APP_CHANNEL_LABEL }}</p>
            </footer>
          </template>

          <template v-else>
            <header class="pause-head">
              <div class="pause-title-row">
                <button
                  ref="playersBackButton"
                  type="button"
                  class="btn btn-ghost btn-icon btn-sm"
                  aria-label="Retour au menu"
                  @click="currentTab = 'main'"
                >
                  <AppIcon name="chevron-left" :size="16" />
                </button>
                <div class="pause-head-copy">
                  <h2 id="players-title" class="dialog-title">Joueurs</h2>
                  <p class="pause-sub">{{ playersSubtitle }}</p>
                </div>
              </div>
              <button type="button" class="btn btn-ghost btn-icon btn-sm" aria-label="Fermer le menu" @click="closeMenu">
                <AppIcon name="x" :size="16" />
              </button>
            </header>

            <div class="pause-body pause-body-list">
              <div v-for="p in store.players" :key="p.id" class="row pause-player-row">
                <div class="media-row">
                  <div style="position: relative; flex-shrink: 0">
                    <img v-if="p.avatar_seed" :src="avatarUrl(p.avatar_seed)" class="avatar avatar-sm" alt="" />
                    <span v-else class="avatar avatar-sm avatar-fallback">{{ initials(p.name) }}</span>
                    <span
                      :class="['status-dot', p.is_connected ? 'is-online' : 'is-offline']"
                      style="position: absolute; right: -1px; bottom: -1px; width: 8px; height: 8px; border: 1.5px solid var(--surface)"
                    ></span>
                  </div>
                  <div class="media-text">
                    <p class="media-title">
                      {{ p.name }}
                      <span v-if="p.id === store.player?.id" class="tag tag-accent" style="margin-left: 4px">Vous</span>
                    </p>
                    <p class="media-sub">
                      <template v-if="p.id === store.session?.host_player_id">Hôte</template>
                      <template v-else-if="p.is_bot">Bot</template>
                      <template v-else>{{ p.is_connected ? 'En ligne' : 'Hors ligne' }}</template>
                    </p>
                  </div>
                </div>

                <div v-if="isHost && p.id !== store.player?.id" class="pause-player-actions">
                  <button
                    v-if="!p.is_bot"
                    type="button"
                    class="btn btn-secondary btn-icon btn-sm"
                    title="Transférer les droits d’hôte"
                    :aria-label="`Promouvoir ${p.name} comme hôte`"
                    @click="promotePlayer(p.id)"
                  >
                    <AppIcon name="crown" :size="13" />
                  </button>
                  <button
                    type="button"
                    class="btn btn-danger btn-icon btn-sm"
                    title="Exclure de la partie"
                    :aria-label="`Exclure ${p.name}`"
                    @click="kickPlayer(p.id)"
                  >
                    <AppIcon name="user-x" :size="13" />
                  </button>
                </div>
              </div>
            </div>

            <footer class="pause-foot">
              <button type="button" class="btn btn-primary btn-block" @click="closeMenu">
                <AppIcon :name="isWaitingRoom || isFinished ? 'x' : 'play'" :size="15" />
                {{ resumeLabel }}
              </button>
              <p class="hint">
                {{ isHost ? 'Transférez vos droits d’hôte ou excluez un joueur.' : 'Seul l’hôte peut modifier les joueurs.' }}
              </p>
            </footer>
          </template>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useGameStore } from '../stores/gameStore';
import { theme, setTheme } from '../services/themeService';
import { avatarUrl } from '../utils/avatar';
import AppIcon from './AppIcon.vue';
import { APP_CHANNEL_LABEL, APP_VERSION } from '../version';

const route = useRoute();
const router = useRouter();
const store = useGameStore();

const isOpen = ref(false);
const currentTab = ref('main');
const copied = ref(false);
const dialog = ref(null);
const closeButton = ref(null);
const playersBackButton = ref(null);
const previouslyFocused = ref(null);
const remainingTime = ref(0);
let timerInterval = null;

const isVisible = computed(() => {
  return store.session && store.player && route.path.startsWith('/game/');
});

const isHost = computed(() => store.isHost);

const isWaitingRoom = computed(() => {
  return route.path === `/game/${store.session?.code}`;
});

const isFinished = computed(() => route.path.endsWith('/results'));

const phaseLabel = computed(() => {
  if (isFinished.value) return 'Résultats';
  if (route.path.endsWith('/voting')) {
    if (store.session?.voting_status === 'listening') return 'Écoute';
    if (store.session?.voting_status === 'voting') return 'Vote';
    if (store.session?.voting_status === 'revelation') return 'Révélation';
    return 'Écoute & vote';
  }
  if (route.path.endsWith('/selection')) return 'Sélection';
  return 'Salon d’attente';
});

const resumeLabel = computed(() => (
  isWaitingRoom.value || isFinished.value ? 'Fermer le menu' : 'Reprendre la partie'
));

const volumePercent = computed(() => Math.round(store.volume * 100));

const visiblePlayers = computed(() => store.players.slice(0, 4));

const extraPlayers = computed(() => Math.max(0, store.players.length - 4));

const playerCountLabel = computed(() => {
  const count = store.players.length;
  return `${count} joueur${count > 1 ? 's' : ''}`;
});

const playersSummary = computed(() => (
  isHost.value ? 'Gérer les joueurs' : 'Voir les joueurs'
));

const playersSubtitle = computed(() => {
  const count = store.players.length;
  return `${count} personne${count > 1 ? 's' : ''} dans ce salon.`;
});

const formatTime = (secs) => {
  const minutes = Math.floor(secs / 60);
  const seconds = secs % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const timerLabel = computed(() => {
  if (isWaitingRoom.value || isFinished.value || !store.session?.timer_ends_at) return '';
  return remainingTime.value > 0 ? formatTime(remainingTime.value) : '';
});

const isTimerUrgent = computed(() => {
  const threshold = route.path.endsWith('/selection') ? 20 : 10;
  return remainingTime.value <= threshold;
});

const updateRemainingTime = () => {
  if (!store.session?.timer_ends_at) {
    remainingTime.value = 0;
    return;
  }
  const end = new Date(store.session.timer_ends_at).getTime();
  remainingTime.value = Math.max(0, Math.round((end - store.correctedNow()) / 1000));
};

const startTimer = () => {
  stopTimer();
  updateRemainingTime();
  timerInterval = setInterval(updateRemainingTime, 1000);
};

const stopTimer = () => {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
};

const initials = (name) =>
  (name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();

const openMenu = () => {
  isOpen.value = true;
  currentTab.value = 'main';
};

const closeMenu = () => {
  isOpen.value = false;
};

const openPlayers = () => {
  currentTab.value = 'players';
};

const focusableSelector = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const trapFocus = (event) => {
  if (event.key !== 'Tab' || !dialog.value) return;

  const focusable = Array.from(dialog.value.querySelectorAll(focusableSelector))
    .filter((element) => element.offsetParent !== null);
  if (!focusable.length) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;

  if (!dialog.value.contains(active)) {
    event.preventDefault();
    first.focus();
  } else if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
};

const handleKeyDown = (e) => {
  if (!isVisible.value) return;

  if (e.key === 'Escape') {
    if (document.querySelector('.settings-dialog')) return;
    if (!isOpen.value) {
      openMenu();
      return;
    }
    if (currentTab.value === 'players') {
      currentTab.value = 'main';
    } else {
      closeMenu();
    }
    return;
  }

  if (isOpen.value) trapFocus(e);
};

const handleOpenPauseMenu = () => {
  openMenu();
};

watch(isOpen, async (open) => {
  document.body.style.overflow = open ? 'hidden' : '';

  if (open) {
    previouslyFocused.value = document.activeElement;
    startTimer();
    await nextTick();
    closeButton.value?.focus();
    return;
  }

  stopTimer();
  if (previouslyFocused.value instanceof HTMLElement) {
    previouslyFocused.value.focus();
    previouslyFocused.value = null;
  }
});

watch(currentTab, async (tab) => {
  if (!isOpen.value) return;
  await nextTick();
  if (tab === 'players') {
    playersBackButton.value?.focus();
  } else {
    closeButton.value?.focus();
  }
});

watch(() => store.session?.timer_ends_at, () => {
  if (isOpen.value) updateRemainingTime();
});

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('open-pause-menu', handleOpenPauseMenu);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('open-pause-menu', handleOpenPauseMenu);
  stopTimer();
  document.body.style.overflow = '';
});

const copyLink = async () => {
  try {
    const inviteLink = `${window.location.origin}/game/${store.session?.code}`;
    await navigator.clipboard.writeText(inviteLink);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 2000);
  } catch (err) {
    console.error('Failed to copy link:', err);
  }
};

const confirmReset = async () => {
  try {
    await store.resetSession();
    closeMenu();
  } catch (err) {
    console.error('Failed to reset session:', err);
  }
};

const confirmLeave = () => {
  store.leaveSession();
  closeMenu();
  router.push('/');
};

const promotePlayer = async (targetId) => {
  try {
    await store.promotePlayer(targetId);
  } catch (err) {
    console.error('Failed to promote player:', err);
  }
};

const kickPlayer = async (targetId) => {
  try {
    await store.kickPlayer(targetId);
  } catch (err) {
    console.error('Failed to kick player:', err);
  }
};

const toggleMute = () => {
  store.volume = store.volume === 0 ? 0.5 : 0;
  updateStoreVolume();
};

const updateStoreVolume = () => {
  store.volume = Number(store.volume);
  localStorage.setItem('cekikilami_volume', String(store.volume));
};
</script>
