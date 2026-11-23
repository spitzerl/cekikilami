<template>
  <div class="home">
    <header class="home-top shell">
      <span class="brand">
        <span class="brand-mark" aria-hidden="true"></span>
        Cékikilami
      </span>
      <span class="spacer"></span>
      <ThemeToggle />
      <button
        v-if="isAppInstallable"
        type="button"
        class="install-link"
        @click="installPWA"
      >
        <AppIcon name="download" :size="14" />
        Installer l’app
      </button>
    </header>

    <main class="home-main shell">
      <section class="home-hero">
        <div class="hero-copy reveal">
          <h1 class="wordmark">
            Cékikilami<span
              class="wordmark-disc"
              :class="{ 'is-spinning': showHelp && mockPlaying }"
              aria-hidden="true"
            ></span>
          </h1>

          <p class="hero-tagline balance">
            Chacun glisse un morceau. Tout le monde devine qui l’a choisi.
          </p>
        </div>

        <div class="console reveal-late" role="region" aria-label="Créer ou rejoindre un salon">
          <div class="menu-slider" role="group" aria-label="Choisir entre créer et rejoindre un salon">
            <span
              class="menu-slider-thumb"
              :style="{ transform: activeAction === 'join' ? 'translateX(100%)' : 'translateX(0)' }"
              aria-hidden="true"
            ></span>
            <button
              type="button"
              :class="['menu-slider-btn', activeAction === 'create' ? 'is-active' : '']"
              :aria-pressed="activeAction === 'create'"
              @click="setAction('create')"
            >
              Créer un salon
            </button>
            <button
              type="button"
              :class="['menu-slider-btn', activeAction === 'join' ? 'is-active' : '']"
              :aria-pressed="activeAction === 'join'"
              @click="setAction('join')"
            >
              Rejoindre un salon
            </button>
          </div>

          <div class="menu-viewport">
            <div
              class="menu-slide menu-slide-create"
              :class="{ 'is-active': activeAction === 'create' }"
              :inert="activeAction !== 'create'"
              :aria-hidden="activeAction !== 'create'"
            >
                <p class="menu-slide-sub">Choisissez un pseudo. Vous serez l’hôte du salon.</p>
                <form class="console-form console-form-create" @submit.prevent="onCreate" novalidate>
                  <div class="field">
                    <label for="create-name" class="label">Votre pseudo</label>
                    <input
                      id="create-name"
                      v-model="createName"
                      required
                      class="input"
                      placeholder="Ex. Lucas"
                      :aria-invalid="!!error && activeAction === 'create'"
                      autocomplete="nickname"
                      maxlength="32"
                    />
                  </div>
                  <div class="create-aside">
                    <p><strong>Votre salon est prêt tout de suite.</strong> Un code à 6 caractères et un lien à partager.</p>
                  </div>
                  <button
                    type="submit"
                    class="btn btn-primary btn-block btn-lg menu-submit"
                    :disabled="!createName.trim()"
                  >
                    <AppIcon name="play" :size="18" />
                    Créer le salon
                  </button>
                </form>
              </div>

            <div
              class="menu-slide menu-slide-join"
              :class="{ 'is-active': activeAction === 'join' }"
              :inert="activeAction !== 'join'"
              :aria-hidden="activeAction !== 'join'"
            >
                <p class="menu-slide-sub">Entrez le code de l’hôte et choisissez un pseudo.</p>
                <form class="console-form console-form-join" @submit.prevent="onJoin" novalidate>
                  <div class="field">
                    <div class="field-label-row">
                      <label for="join-code" class="label">Code du salon</label>
                      <button type="button" class="menu-paste" @click="pasteCode">Coller</button>
                    </div>
                    <input
                      id="join-code"
                      v-model="joinCode"
                      required
                      maxlength="6"
                      class="input input-code"
                      placeholder="ABCDEF"
                      :aria-invalid="!!error && activeAction === 'join'"
                      autocomplete="off"
                      autocapitalize="characters"
                      spellcheck="false"
                    />
                  </div>
                  <div class="field">
                    <label for="join-name" class="label">Votre pseudo</label>
                    <input
                      id="join-name"
                      v-model="joinName"
                      required
                      class="input"
                      placeholder="Ex. Lucas"
                      autocomplete="nickname"
                      maxlength="32"
                    />
                  </div>
                  <button
                    type="submit"
                    class="btn btn-primary btn-block btn-lg menu-submit"
                    :disabled="!joinCode.trim() || !joinName.trim()"
                  >
                    <AppIcon name="log-in" :size="18" />
                    Rejoindre le salon
                  </button>
                </form>
            </div>
          </div>

          <Transition name="fade">
            <div v-if="error" class="form-error" role="alert">
              <AppIcon name="alert-triangle" :size="15" style="flex-shrink: 0; margin-top: 1px" />
              {{ error }}
            </div>
          </Transition>

          <div class="menu-footer">
            <span class="menu-footer-disc" aria-hidden="true"></span>
            Pas de compte. Juste un pseudo.
          </div>
        </div>

        <p class="hero-note pretty">
          <strong>Une playlist que personne n’a vue venir.</strong>
          Écoutez, accusez, marquez. Le blind test est optionnel ; le bluff,
          beaucoup moins.
        </p>
      </section>

      <section class="home-steps" aria-labelledby="steps-title">
        <div class="steps-head">
          <h2 id="steps-title" class="steps-title">Comment ça se joue</h2>
          <button
            type="button"
            class="text-link"
            :aria-expanded="showHelp"
            aria-controls="demo-panel"
            @click="toggleHelp"
          >
            {{ showHelp ? 'Masquer la démo' : 'Essayer la démo' }}
            <AppIcon :name="showHelp ? 'chevron-down' : 'arrow-right'" :size="13" />
          </button>
        </div>

        <Transition name="drop">
          <div v-if="showHelp" id="demo-panel" class="demo">
            <div class="demo-record">
              <button
                type="button"
                class="record"
                :class="{ 'is-spinning': mockPlaying }"
                :aria-label="mockPlaying ? 'Mettre la démo en pause' : 'Lancer la démo'"
                @click="mockPlaying = !mockPlaying"
              >
                <span class="record-label">
                  <img v-if="mockTrack?.cover" :src="mockTrack.cover" alt="" />
                  <AppIcon v-else name="music" :size="18" />
                </span>
                <span class="record-hole"></span>
                <span class="record-hint">
                  <AppIcon :name="mockPlaying ? 'pause' : 'play'" :size="18" />
                </span>
              </button>

              <div style="min-width: 0">
                <p class="hint" style="margin-bottom: 3px">Démo : le morceau surprise</p>
                <p class="media-title">{{ mockTrack?.title || 'Morceau mystère' }}</p>
                <p class="media-sub">{{ mockTrack?.artist || 'Extrait de démonstration' }}</p>
                <div class="eq" :class="{ 'is-playing': mockPlaying }" aria-hidden="true">
                  <span></span><span></span><span></span><span></span><span></span>
                </div>
              </div>
            </div>

            <div>
              <template v-if="!mockGuessed">
                <p class="label">Qui a proposé ce morceau ?</p>
                <div class="demo-suspects">
                  <button
                    v-for="suspect in mockSuspects"
                    :key="suspect.name"
                    type="button"
                    class="demo-suspect"
                    @click="guessSuspect(suspect.name)"
                  >
                    {{ suspect.emoji }} {{ suspect.name }}
                  </button>
                </div>
              </template>

              <Transition name="pop" mode="out-in">
                <div
                  v-if="mockGuessed === 'success'"
                  key="success"
                  class="demo-result is-success"
                >
                  <strong>Bien vu.</strong> C’est Alice qui a proposé ce morceau. +1 point.
                  <button type="button" class="text-link" style="display: block; margin-top: 6px" @click="resetMockGame">
                    Rejouer
                  </button>
                </div>
                <div
                  v-else-if="mockGuessed === 'error'"
                  key="error"
                  class="demo-result is-error"
                >
                  <strong>Raté.</strong> Ce n’est pas {{ mockSuspectName }}. Alice sourit en coin…
                  <button type="button" class="text-link" style="display: block; margin-top: 6px" @click="resetMockGame">
                    Réessayer
                  </button>
                </div>
              </Transition>
            </div>
          </div>
        </Transition>

        <ol class="steps-grid">
          <li v-for="(step, index) in rules" :key="step.id" class="step-card">
            <span class="num">{{ String(index + 1).padStart(2, '0') }}</span>
            <h3>{{ step.title }}</h3>
            <p>{{ step.desc }}</p>
          </li>
        </ol>
      </section>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useGameStore } from '../stores/gameStore';
import api from '../services/apiService';
import AppIcon from './AppIcon.vue';
import ThemeToggle from './ThemeToggle.vue';

const store = useGameStore();
const router = useRouter();

const activeAction = ref('create');
const createName = ref('');
const joinCode = ref('');
const joinName = ref('');
const error = ref(null);
const showHelp = ref(false);

const setAction = (action) => {
  if (action === activeAction.value) return;
  error.value = null;
  activeAction.value = action;
};

const pasteCode = async () => {
  try {
    const text = await navigator.clipboard.readText();
    const match = text.toUpperCase().match(/[A-Z0-9]{6}/);
    if (match) joinCode.value = match[0];
    else document.getElementById('join-code')?.focus();
  } catch {
    document.getElementById('join-code')?.focus();
  }
};

const deferredPrompt = ref(null);
const isAppInstallable = ref(false);

const handleBeforeInstallPrompt = (e) => { e.preventDefault(); deferredPrompt.value = e; isAppInstallable.value = true; };
const handleAppInstalled = () => { deferredPrompt.value = null; isAppInstallable.value = false; };

const installPWA = async () => {
  if (!deferredPrompt.value) return;
  deferredPrompt.value.prompt();
  await deferredPrompt.value.userChoice;
  deferredPrompt.value = null;
  isAppInstallable.value = false;
};

const rules = [
  { id: 1, title: 'Chacun propose', desc: 'Chaque joueur glisse un morceau, en secret.' },
  { id: 2, title: 'On écoute', desc: 'Les extraits défilent. Personne ne sait qui a choisi quoi.' },
  { id: 3, title: 'On dénonce', desc: 'Votez pour le joueur que vous soupçonnez d’avoir proposé le titre.' },
  { id: 4, title: 'On révèle', desc: 'Les auteurs sont démasqués. Bonnes accusations et blind test rapportent des points.' },
];

const mockSuspects = [
  { name: 'Alice', emoji: '👩‍🦰' },
  { name: 'Bob', emoji: '🧔' },
  { name: 'Clara', emoji: '👩' },
];
const mockGuessed = ref(null);
const mockSuspectName = ref('');
const mockPlaying = ref(false);
const mockTrack = ref(null);
const mockAudio = ref(null);

const resetMockGame = () => {
  mockGuessed.value = null;
  mockSuspectName.value = '';
  mockPlaying.value = true;
  if (mockAudio.value) {
    mockAudio.value.currentTime = 0;
    mockAudio.value.play().catch(() => { mockPlaying.value = false; });
  }
};

const guessSuspect = (name) => {
  mockSuspectName.value = name;
  mockGuessed.value = name === 'Alice' ? 'success' : 'error';
};

const toggleHelp = () => {
  showHelp.value = !showHelp.value;
};

const initSimulator = async () => {
  try {
    const res = await api.searchDeezer();
    const tracks = res.data.tracks;
    if (tracks?.length) {
      mockTrack.value = tracks[Math.floor(Math.random() * tracks.length)];
      if (mockTrack.value.preview) {
        mockAudio.value = new Audio(mockTrack.value.preview);
        mockAudio.value.loop = true;
        mockAudio.value.volume = 0.4;
        if (showHelp.value) {
          mockPlaying.value = true;
          mockAudio.value.play().catch(() => { mockPlaying.value = false; });
        }
      }
    }
  } catch { /* demo is optional */ }
};

watch(showHelp, async (val) => {
  if (val) {
    if (!mockTrack.value) {
      await initSimulator();
    } else if (mockAudio.value) {
      mockPlaying.value = true;
    }
  } else {
    mockPlaying.value = false;
  }
});

watch(mockPlaying, (playing) => {
  if (!mockAudio.value) return;
  playing ? mockAudio.value.play().catch(() => { mockPlaying.value = false; }) : mockAudio.value.pause();
});

onMounted(() => {
  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  window.addEventListener('appinstalled', handleAppInstalled);
});

onUnmounted(() => {
  window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  window.removeEventListener('appinstalled', handleAppInstalled);
  if (mockAudio.value) {
    mockAudio.value.pause();
    mockAudio.value.src = '';
    mockAudio.value = null;
  }
});

const onCreate = async () => {
  error.value = null;
  try {
    const { session } = await store.createSession(createName.value);
    store.connectSocket(session.code);
    router.push(`/game/${session.code}`);
  } catch (err) {
    error.value = err.response?.data?.error || err.response?.data?.message || err.message || 'Erreur de création';
  }
};

const onJoin = async () => {
  error.value = null;
  const code = joinCode.value.trim().toUpperCase();
  try {
    await store.joinSession(code, joinName.value);
    store.connectSocket(code);
    router.push(`/game/${code}`);
  } catch (err) {
    error.value = err.response?.data?.error || err.response?.data?.message || err.message || 'Impossible de rejoindre';
  }
};
</script>
