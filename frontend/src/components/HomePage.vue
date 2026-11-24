<template>
  <div class="home">
    <header class="home-top shell">
      <span class="brand">
        <span class="brand-mark" aria-hidden="true"></span>
        Cékikilami
        <span class="version-badge" :title="`Version ${APP_VERSION}`">
          {{ APP_CHANNEL === 'beta' ? APP_CHANNEL_LABEL : `v${APP_VERSION}` }}
        </span>
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
            Connaissez vous vraiment les goûts musicaux de vos amis ?
          </p>
        </div>

        <div class="console reveal-late" role="region" aria-label="Créer ou rejoindre un salon">
          <Transition name="console-step" mode="out-in" @after-enter="focusStep">
            <form
              v-if="step === 'identity'"
              key="identity"
              class="console-step"
              @submit.prevent="onCreate"
              novalidate
            >
              <div class="console-head">
                <h2 class="console-heading">On joue ?</h2>
              </div>

              <div class="field">
                <label for="player-name" class="label">Votre pseudo</label>
                <input
                  id="player-name"
                  ref="pseudoInput"
                  v-model="pseudo"
                  class="input"
                  placeholder="Ex. Jean-Eude"
                  autocomplete="nickname"
                  maxlength="32"
                  :aria-invalid="!!error"
                  @input="clearError"
                />
              </div>

              <div class="console-actions">
                <button type="submit" class="btn btn-primary btn-lg">
                  <AppIcon name="plus" :size="18" />
                  Créer le salon
                </button>
                <button type="button" class="btn btn-secondary btn-lg" @click="startJoin">
                  <AppIcon name="log-in" :size="18" />
                  Rejoindre avec un code
                </button>
              </div>
            </form>

            <div v-else key="join" class="console-step">
              <div class="console-head">
                <button
                  type="button"
                  class="console-back"
                  aria-label="Revenir au pseudo"
                  @click="backToIdentity"
                >
                  <AppIcon name="arrow-left" :size="17" />
                </button>
                <div>
                  <h2 class="console-heading">Rejoindre un salon</h2>
                  <p class="console-identity">
                    Vous jouez en tant que <strong>{{ pseudo.trim() }}</strong>.
                  </p>
                </div>
              </div>

              <form class="console-form" @submit.prevent="onJoin" novalidate>
                <div class="field">
                  <div class="field-label-row">
                    <label for="join-code" class="label">Code du salon</label>
                    <button type="button" class="console-paste" @click="pasteCode">Coller</button>
                  </div>
                  <input
                    id="join-code"
                    ref="codeInput"
                    v-model="joinCode"
                    class="input input-code"
                    placeholder="ABCDEF"
                    maxlength="6"
                    autocomplete="off"
                    autocapitalize="characters"
                    spellcheck="false"
                    :aria-invalid="!!error"
                    @input="clearError"
                  />
                </div>
                <button type="submit" class="btn btn-primary btn-block btn-lg console-submit">
                  <AppIcon name="log-in" :size="18" />
                  Rejoindre le salon
                </button>
              </form>
            </div>
          </Transition>

          <Transition name="fade">
            <div v-if="error" class="form-error" role="alert">
              <AppIcon name="alert-triangle" :size="15" style="flex-shrink: 0; margin-top: 1px" />
              {{ error }}
            </div>
          </Transition>

          <div class="console-footer">
            <span class="console-footer-disc" aria-hidden="true"></span>
            Pas besoin de créer de compte. Juste un pseudo !
            <span class="spacer"></span>
            <span class="version-text">v{{ APP_VERSION }}</span>
          </div>
        </div>

        <!-- <p class="hero-note pretty">
          <strong>Une playlist que personne n’a vue venir.</strong>
          Écoutez, accusez, marquez des points. Le blind test est optionnel, le bluff beaucoup moins.
        </p> -->
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
                  <strong>Bien vu.</strong> C’est Alice qui a proposé ce morceau.
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
import { ref, nextTick, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useGameStore } from '../stores/gameStore';
import AppIcon from './AppIcon.vue';
import ThemeToggle from './ThemeToggle.vue';
import { APP_CHANNEL, APP_CHANNEL_LABEL, APP_VERSION } from '../version';

const store = useGameStore();
const router = useRouter();

const step = ref('identity');
const pseudo = ref('');
const joinCode = ref('');
const pseudoInput = ref(null);
const codeInput = ref(null);
const error = ref(null);
const showHelp = ref(false);

const clearError = () => {
  error.value = null;
};

const focusStep = () => {
  if (step.value === 'join') codeInput.value?.focus();
  else pseudoInput.value?.focus();
};

const startJoin = () => {
  if (!pseudo.value.trim()) {
    error.value = 'Choisissez un pseudo avant de rejoindre un salon.';
    pseudoInput.value?.focus();
    return;
  }
  error.value = null;
  step.value = 'join';
};

const backToIdentity = () => {
  error.value = null;
  step.value = 'identity';
};

const pasteCode = async () => {
  try {
    const text = await navigator.clipboard.readText();
    const match = text.toUpperCase().match(/[A-Z0-9]{6}/);
    if (match) {
      joinCode.value = match[0];
      clearError();
    }
    codeInput.value?.focus();
  } catch {
    codeInput.value?.focus();
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
  { id: 1, title: 'Proposition', desc: 'Chaque joueur choisis ses morceaux parmis ceux proposé sur Deezer.' },
  { id: 2, title: 'Ecoute', desc: 'Les extraits défilent dans un ordre complétement aléatoire.' },
  { id: 3, title: 'Vote', desc: 'Votez pour le joueur que vous soupçonnez d’avoir proposé le titre.' },
  { id: 4, title: 'Révélation', desc: 'Les joueurs sont démasqués. Bonnes accusations et bluffs réussis rapportent des points selon le mode choisi !' },
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
  mockTrack.value = {
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    preview: 'https://cdns-preview-e.dzcdn.net/stream/c-e12ac87d5b1b748f06f7ad86903f262b-6.mp3',
  };
  mockAudio.value = new Audio(mockTrack.value.preview);
  mockAudio.value.loop = true;
  mockAudio.value.volume = store.volume;
  if (showHelp.value) {
    mockPlaying.value = true;
    mockAudio.value.play().catch(() => { mockPlaying.value = false; });
  }
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

watch(() => store.volume, (newVolume) => {
  if (mockAudio.value) mockAudio.value.volume = newVolume;
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
  const name = pseudo.value.trim();
  if (!name) {
    error.value = 'Choisissez un pseudo avant de créer le salon.';
    pseudoInput.value?.focus();
    return;
  }
  try {
    if (store.session) store.leaveSession();
    const { session } = await store.createSession(name);
    store.connectSocket(session.code);
    router.push(`/game/${session.code}`);
  } catch (err) {
    error.value = err.response?.data?.error || err.response?.data?.message || err.message || 'Erreur de création';
  }
};

const onJoin = async () => {
  error.value = null;
  const code = joinCode.value.trim().toUpperCase();
  if (!code) {
    error.value = 'Entrez le code partagé par l’hôte.';
    codeInput.value?.focus();
    return;
  }
  try {
    if (store.session && store.session.code !== code) store.leaveSession();
    await store.joinSession(code, pseudo.value.trim());
    store.connectSocket(code);
    router.push(`/game/${code}`);
  } catch (err) {
    error.value = err.response?.data?.error || err.response?.data?.message || err.message || 'Impossible de rejoindre';
  }
};
</script>
