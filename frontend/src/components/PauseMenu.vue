<template>
  <div v-if="isVisible">
    <Transition name="fade">
      <div v-if="isOpen" class="overlay" @click.self="closeMenu">
        <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="pause-title">
          <template v-if="currentTab === 'main'">
            <div class="dialog-head">
              <div>
                <h2 id="pause-title" class="dialog-title">Partie en pause</h2>
                <div style="display: flex; align-items: center; gap: 8px; margin-top: 8px; flex-wrap: wrap">
                  <span class="hint">Code</span>
                  <button
                    type="button"
                    class="code-chip"
                    style="height: 28px; font-size: 11px"
                    title="Copier le lien d’invitation"
                    @click="copyLink"
                  >
                    {{ store.session?.code }}
                    <AppIcon name="copy" :size="12" />
                  </button>
                  <span v-if="copied" class="hint" style="color: var(--success)">Copié</span>
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
            </div>

            <div class="dialog-section">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px">
                <span class="label" style="margin: 0">Volume de la musique</span>
                <span class="mono" style="font-size: 12px; color: var(--ink-2)">{{ Math.round(store.volume * 100) }} %</span>
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

            <div class="dialog-actions">
              <button type="button" class="btn btn-primary btn-block" @click="closeMenu">
                <AppIcon name="play" :size="15" />
                Reprendre la partie
              </button>
              <button type="button" class="btn btn-secondary btn-block" @click="currentTab = 'players'">
                <AppIcon name="users" :size="15" />
                Gérer les joueurs ({{ store.players.length }})
              </button>
              <button
                v-if="isHost && isNotInWaitingRoom"
                type="button"
                class="btn btn-warning btn-block"
                @click="confirmReset"
              >
                <AppIcon name="rotate-ccw" :size="15" />
                Retourner au salon d’attente
              </button>
              <button type="button" class="btn btn-danger btn-block" @click="confirmLeave">
                <AppIcon name="log-out" :size="15" />
                Quitter la partie
              </button>
            </div>
          </template>

          <template v-else>
            <div class="dialog-head">
              <div style="display: flex; align-items: flex-start; gap: 8px">
                <button
                  type="button"
                  class="btn btn-ghost btn-icon btn-sm"
                  aria-label="Retour au menu"
                  @click="currentTab = 'main'"
                >
                  <AppIcon name="chevron-left" :size="16" />
                </button>
                <div>
                  <h2 class="dialog-title" style="font-size: 18px">Gérer les joueurs</h2>
                  <p class="panel-sub">{{ store.players.length }} personne{{ store.players.length > 1 ? 's' : '' }} dans ce salon.</p>
                </div>
              </div>
              <button type="button" class="btn btn-ghost btn-icon btn-sm" aria-label="Fermer le menu" @click="closeMenu">
                <AppIcon name="x" :size="16" />
              </button>
            </div>

            <div style="padding-top: 8px">
              <div v-for="p in store.players" :key="p.id" class="row">
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
                      <template v-if="p.name === store.session?.host_name">Hôte</template>
                      <template v-else-if="p.is_bot">Bot</template>
                      <template v-else>{{ p.is_connected ? 'En ligne' : 'Hors ligne' }}</template>
                    </p>
                  </div>
                </div>

                <div v-if="isHost && p.id !== store.player?.id" style="display: flex; gap: 4px">
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
import AppIcon from './AppIcon.vue';

const route = useRoute();
const router = useRouter();
const store = useGameStore();

const isOpen = ref(false);
const currentTab = ref('main');
const copied = ref(false);
const closeButton = ref(null);

const isVisible = computed(() => {
  return store.session && store.player && route.path.startsWith('/game/');
});

const isHost = computed(() => {
  return store.player && store.session && store.player.name === store.session.host_name;
});

const isNotInWaitingRoom = computed(() => {
  return route.path !== `/game/${store.session?.code}`;
});

const avatarUrl = (seed) =>
  `https://api.dicebear.com/9.x/notionists-neutral/svg?seed=${encodeURIComponent(seed)}&backgroundColor=e9e8e2,f1f1ec,ffffff`;

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

const handleKeyDown = (e) => {
  if (e.key === 'Escape' && isVisible.value) {
    if (isOpen.value) {
      if (currentTab.value === 'players') {
        currentTab.value = 'main';
      } else {
        closeMenu();
      }
    } else {
      openMenu();
    }
  }
};

const handleOpenPauseMenu = () => {
  openMenu();
};

watch(isOpen, async (open) => {
  document.body.style.overflow = open ? 'hidden' : '';
  if (open) {
    await nextTick();
    closeButton.value?.focus();
  }
});

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('open-pause-menu', handleOpenPauseMenu);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('open-pause-menu', handleOpenPauseMenu);
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
    currentTab.value = 'main';
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
