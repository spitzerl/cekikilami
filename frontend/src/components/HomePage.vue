<template>
  <div class="relative min-h-dvh flex flex-col items-center justify-center overflow-hidden bg-[var(--surface-base)] px-4 py-8 sm:py-12">

    <!-- Magic UI inspired Dot Pattern Background with Radial Gradient Mask -->
    <div class="absolute inset-0 bg-dot-pattern opacity-50 z-0 pointer-events-none"
      style="mask-image: radial-gradient(ellipse at center, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 80%); -webkit-mask-image: radial-gradient(ellipse at center, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 80%);">
    </div>

    <!-- Ambient glowing backgrounds behind the card -->
    <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] sm:w-[500px] h-[350px] sm:h-[500px] rounded-full blur-[140px] opacity-15 bg-indigo-600 pointer-events-none z-0" aria-hidden="true"></div>
    <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] sm:w-[450px] h-[300px] sm:h-[450px] rounded-full blur-[120px] opacity-15 bg-violet-600 pointer-events-none z-0" aria-hidden="true"></div>

    <!-- ── MAIN CONTENT ── -->
    <main class="relative z-10 w-full max-w-5xl flex flex-col items-center gap-6">

      <!-- Hero Header -->
      <div class="text-center">
        <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 text-xs font-bold uppercase tracking-widest mb-4">
          <span class="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
          Blind Test Social Interactif
        </div>
        <h1 class="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight mb-2 animate-tracking-in">
          <span class="bg-gradient-to-r from-indigo-400 via-violet-300 to-cyan-400 bg-clip-text text-transparent">
            Cékikilami
          </span>
        </h1>
        <p class="text-sm sm:text-base text-[var(--text-secondary)] max-w-md mx-auto leading-relaxed">
          Devinez qui a proposé chaque morceau et devenez le maître du rythme.
        </p>
      </div>

      <!-- PWA Install Banner (sleeker floating style) -->
      <Transition name="slide-up">
        <div v-if="isAppInstallable" role="banner" class="glass-panel px-4 py-3 rounded-2xl border border-indigo-500/20 w-full max-w-md flex items-center justify-between gap-3 shadow-lg">
          <div class="flex items-center gap-2.5">
            <img src="/icon-192.png" class="w-8 h-8 rounded-lg object-cover border border-indigo-500/25 flex-shrink-0" alt="Logo Cékikilami" />
            <div class="text-left">
              <p class="text-xs font-bold text-white">Installer l'application</p>
              <p class="text-[10px] text-[var(--text-secondary)]">Accès rapide en plein écran</p>
            </div>
          </div>
          <button @click="installPWA" class="btn btn-primary btn-sm px-3.5" style="min-height:32px">
            Installer
          </button>
        </div>
      </Transition>

      <!-- Central Action Card (Magic UI Border Beam & Glassmorphism) -->
      <div class="w-full max-w-md border-beam-card shadow-2xl">
        <div class="border-beam-card-inner p-6 sm:p-8 flex flex-col gap-5">
          <!-- Segmented tab -->
          <div class="seg-control" role="tablist" aria-label="Action principale">
            <button
              id="tab-create" role="tab" :aria-selected="activeAction==='create'" aria-controls="panel-create"
              @click="activeAction='create'"
              :class="['seg-btn', activeAction==='create' ? 'active-primary' : '']"
            >
              <i class="fa-solid fa-plus mr-1.5"></i>
              Créer un Salon
            </button>
            <button
              id="tab-join" role="tab" :aria-selected="activeAction==='join'" aria-controls="panel-join"
              @click="activeAction='join'"
              :class="['seg-btn', activeAction==='join' ? 'active-primary' : '']"
            >
              <i class="fa-regular fa-user mr-1.5"></i>
              Rejoindre
            </button>
          </div>

          <!-- Form cards -->
          <Transition name="slide-up" mode="out-in">
            <!-- CREATE -->
            <div v-if="activeAction==='create'" key="create" id="panel-create" role="tabpanel" aria-labelledby="tab-create" class="flex flex-col">
              <h2 class="text-xl font-bold text-white mb-1">Créer un Salon</h2>
              <p class="text-xs text-[var(--text-secondary)] mb-5">Configurez une nouvelle partie et invitez vos amis.</p>

              <form @submit.prevent="onCreate" class="space-y-4" novalidate>
                <div>
                  <label for="create-name" class="form-label">Pseudo</label>
                  <input
                    id="create-name" v-model="createName" required
                    class="form-input" placeholder="Ex: Lucas"
                    :aria-invalid="!!error && activeAction==='create'"
                    autocomplete="nickname" maxlength="32"
                  />
                </div>
                <button type="submit" class="btn btn-primary w-full text-base btn-shiny" :disabled="!createName.trim()">
                  <i class="fa-solid fa-play text-[16px] mr-1.5"></i>
                  Lancer le Salon
                </button>
              </form>
            </div>

            <!-- JOIN -->
            <div v-else key="join" id="panel-join" role="tabpanel" aria-labelledby="tab-join" class="flex flex-col">
              <h2 class="text-xl font-bold text-white mb-1">Rejoindre un Salon</h2>
              <p class="text-xs text-[var(--text-secondary)] mb-5">Entrez le code à 6 caractères de la partie.</p>

              <form @submit.prevent="onJoin" class="space-y-4" novalidate>
                <div class="grid grid-cols-5 gap-3">
                  <div class="col-span-2">
                    <label for="join-code" class="form-label">Code</label>
                    <input
                      id="join-code" v-model="joinCode" required maxlength="6"
                      class="form-input text-center font-mono uppercase tracking-widest text-lg"
                      placeholder="ABCDEF"
                      :aria-invalid="!!error && activeAction==='join'"
                      autocomplete="off" spellcheck="false"
                    />
                  </div>
                  <div class="col-span-3">
                    <label for="join-name" class="form-label">Pseudo</label>
                    <input
                      id="join-name" v-model="joinName" required
                      class="form-input" placeholder="Ex: Lucas"
                      autocomplete="nickname" maxlength="32"
                    />
                  </div>
                </div>
                <button type="submit" class="btn btn-secondary w-full text-base btn-shiny" :disabled="!joinCode.trim() || !joinName.trim()">
                  <i class="fa-solid fa-right-to-bracket text-[16px] mr-1.5"></i>
                  Rejoindre la Partie
                </button>
              </form>
            </div>
          </Transition>

          <!-- Error alert -->
          <Transition name="fade">
            <div v-if="error" role="alert" aria-live="assertive" class="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold" style="background:var(--clr-danger-dim);border:1px solid rgba(244,63,94,.3);color:#fda4af">
              <i class="fa-solid fa-triangle-exclamation text-[16px] text-rose-400 flex-shrink-0"></i>
              {{ error }}
            </div>
          </Transition>
        </div>
      </div>

      <!-- Collapsible Rules & Simulator Trigger -->
      <div class="mt-2">
        <button
          @click="toggleHelp"
          class="flex items-center gap-2 text-xs font-bold text-[var(--text-secondary)] hover:text-white transition-colors cursor-pointer bg-slate-900/40 hover:bg-slate-900/60 border border-[var(--border-strong)] px-4 py-2 rounded-full backdrop-blur-sm"
          :aria-expanded="showHelp"
        >
          <span>{{ showHelp ? 'Masquer la démo et les règles' : 'Comment jouer ? (Règles & Démo)' }}</span>
          <i :class="['fa-solid', showHelp ? 'fa-chevron-up' : 'fa-chevron-down', 'text-[10px]']"></i>
        </button>
      </div>

      <!-- Collapsible Rules & Simulator Section -->
      <Transition name="slide-up">
        <div v-if="showHelp" class="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-6 mt-4">
          <!-- Rules (Left column) -->
          <div class="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div v-for="step in rules" :key="step.id" class="glass-card p-4 rounded-xl hover:border-indigo-500/30 transition-all duration-300 group" style="border:1px solid var(--border)">
              <div class="flex items-center gap-2 mb-2">
                <div class="w-7 h-7 rounded-lg flex items-center justify-center transition-colors" :style="`background:${step.dimColor};border:1px solid ${step.borderColor}`">
                  <span v-html="step.icon" class="text-sm"></span>
                </div>
                <span class="text-[10px] font-black uppercase tracking-wider" :style="`color:${step.color}`">Étape {{ step.id }}</span>
              </div>
              <p class="text-sm font-bold text-white mb-0.5">{{ step.title }}</p>
              <p class="text-xs text-[var(--text-secondary)] leading-relaxed">{{ step.desc }}</p>
            </div>
          </div>

          <!-- Simulator (Right column) -->
          <div class="lg:col-span-6 glass-panel p-5 rounded-2xl border border-violet-500/15 hover:border-violet-500/30 transition-all duration-300 flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between mb-3.5">
                <h2 class="section-header text-sm">
                  <i class="fa-solid fa-sliders text-[16px] icon"></i>
                  Simuler un Tour
                </h2>
                <button @click="resetMockGame" class="text-[10px] text-[var(--text-secondary)] hover:text-white underline underline-offset-2 transition-colors">
                  Réinitialiser
                </button>
              </div>

              <!-- Track player -->
              <div class="flex items-center gap-4 bg-slate-900/70 p-3.5 rounded-xl border border-[var(--border)] mb-4">
                <!-- Vinyl -->
                <button
                  @click="mockPlaying=!mockPlaying"
                  :aria-label="mockPlaying ? 'Mettre en pause' : 'Lancer la lecture'"
                  class="relative w-16 h-16 rounded-full flex-shrink-0 cursor-pointer group touch-target"
                >
                  <div :class="['absolute inset-0 bg-slate-950 rounded-full border-2 border-slate-800 flex items-center justify-center shadow-lg', mockPlaying ? 'animate-spin-slow' : '']">
                    <div class="w-12 h-12 rounded-full border border-slate-800/40 flex items-center justify-center">
                      <div class="w-8 h-8 rounded-full border border-slate-800/60 flex items-center justify-center overflow-hidden relative">
                        <img v-if="mockTrack?.cover" :src="mockTrack.cover" class="absolute inset-0 w-full h-full object-cover opacity-60" alt="" />
                        <div class="w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center z-10 relative">
                          <div class="w-1.5 h-1.5 rounded-full bg-slate-950"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="absolute inset-0 bg-slate-950/60 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <i v-if="mockPlaying" class="fa-solid fa-pause text-[18px] text-white"></i>
                    <i v-else class="fa-solid fa-play text-[18px] text-white ml-0.5"></i>
                  </div>
                </button>

                <!-- Track info -->
                <div class="flex-grow min-w-0">
                  <div class="text-[9px] text-[var(--text-muted)] uppercase tracking-widest font-black mb-0.5">Thème : Chanson de la honte</div>
                  <div class="text-xs font-extrabold text-white flex flex-wrap items-center gap-1.5">
                    Morceau Mystère 📻
                    <span class="badge badge-accent">Devinez l'auteur !</span>
                  </div>
                  <!-- Equalizer -->
                  <div class="flex items-end gap-1 h-5 mt-2.5" aria-hidden="true">
                    <span :class="['w-1 bg-indigo-400 rounded-full transition-all duration-300', mockPlaying ? 'animate-eq-1' : 'h-1.5']"></span>
                    <span :class="['w-1 bg-indigo-300 rounded-full transition-all duration-300', mockPlaying ? 'animate-eq-2' : 'h-3']"></span>
                    <span :class="['w-1 bg-violet-400 rounded-full transition-all duration-300', mockPlaying ? 'animate-eq-3' : 'h-1']"></span>
                    <span :class="['w-1 bg-violet-500 rounded-full transition-all duration-300', mockPlaying ? 'animate-eq-4' : 'h-2']"></span>
                    <span :class="['w-1 bg-cyan-400 rounded-full transition-all duration-300', mockPlaying ? 'animate-eq-5' : 'h-1.5']"></span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Vote choices / Result -->
            <div>
              <div v-if="!mockGuessed">
                <p class="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Qui est le coupable ?</p>
                <div class="grid grid-cols-3 gap-2">
                  <button v-for="suspect in mockSuspects" :key="suspect.name"
                    @click="guessSuspect(suspect.name)"
                    class="vote-btn justify-center text-xs py-2.5 min-h-[44px]"
                  >
                    {{ suspect.emoji }} {{ suspect.name }}
                  </button>
                </div>
              </div>

              <Transition name="slide-up" mode="out-in">
                <div v-if="mockGuessed==='success'" key="success" class="rounded-xl p-3.5 flex flex-col gap-1" style="background:var(--clr-success-dim);border:1px solid rgba(16,185,129,.3)">
                  <div class="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                    <i class="fa-solid fa-circle-check text-[16px] text-emerald-400 flex-shrink-0"></i>
                    Bingo ! +100 points !
                  </div>
                  <p class="text-[11px] text-emerald-300/80 leading-relaxed">C'est bien Alice qui a proposé ce morceau. Vous gagnez 100 pts !</p>
                  <button @click="resetMockGame" class="btn btn-ghost text-[10px] self-start mt-1.5" style="min-height:28px;height:28px;padding:.2rem .75rem">Rejouer</button>
                </div>
                <div v-else-if="mockGuessed==='error'" key="error" class="rounded-xl p-3.5 flex flex-col gap-1" style="background:var(--clr-danger-dim);border:1px solid rgba(244,63,94,.3)">
                  <div class="flex items-center gap-2 text-rose-400 font-bold text-xs">
                    <i class="fa-solid fa-circle-xmark text-[16px] text-rose-400 flex-shrink-0"></i>
                    Faux ! Ce n'est pas {{ mockSuspectName }}.
                  </div>
                  <p class="text-[11px] text-rose-300/80 leading-relaxed">{{ mockSuspectName }} sourit en coin… Analysez mieux le style !</p>
                  <button @click="resetMockGame" class="btn btn-ghost text-[10px] self-start mt-1.5" style="min-height:28px;height:28px;padding:.2rem .75rem">Réessayer</button>
                </div>
              </Transition>
            </div>
          </div>
        </div>
      </Transition>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useGameStore } from '../stores/gameStore';
import api from '../services/apiService';

const store = useGameStore();
const router = useRouter();

const activeAction = ref('create');
const createName   = ref('');
const joinCode     = ref('');
const joinName     = ref('');
const error        = ref(null);
const showHelp     = ref(false);

// PWA
const deferredPrompt  = ref(null);
const isAppInstallable = ref(false);

const handleBeforeInstallPrompt = (e) => { e.preventDefault(); deferredPrompt.value = e; isAppInstallable.value = true; };
const handleAppInstalled        = ()  => { deferredPrompt.value = null; isAppInstallable.value = false; };

const installPWA = async () => {
  if (!deferredPrompt.value) return;
  deferredPrompt.value.prompt();
  await deferredPrompt.value.userChoice;
  deferredPrompt.value = null;
  isAppInstallable.value = false;
};

// Rules data
const rules = [
  { id:1, title:'La Sélection',  desc:'Proposez secrètement la meilleure musique selon le thème.',  color:'#a5b4fc', dimColor:'rgba(99,102,241,.1)',   borderColor:'rgba(99,102,241,.2)',   icon:'🎵' },
  { id:2, title:"L'Écoute",      desc:"L'extrait est diffusé en direct. Écoutez attentivement.",    color:'#67e8f9', dimColor:'rgba(6,182,212,.1)',    borderColor:'rgba(6,182,212,.2)',    icon:'🎧' },
  { id:3, title:'Le Vote',       desc:"Accusez le suspect ! Qui a proposé ce morceau ?",            color:'#c4b5fd', dimColor:'rgba(139,92,246,.1)',   borderColor:'rgba(139,92,246,.2)',   icon:'🗳️' },
  { id:4, title:'La Révélation', desc:'Les coupables sont démasqués. Marquez des points bonus !',   color:'#fda4af', dimColor:'rgba(244,63,94,.1)',    borderColor:'rgba(244,63,94,.2)',    icon:'🎭' },
];

// Simulator
const mockSuspects   = [{ name:'Alice', emoji:'👩‍🦰' }, { name:'Bob', emoji:'🧔' }, { name:'Clara', emoji:'👩' }];
const mockGuessed    = ref(null);
const mockSuspectName = ref('');
const mockPlaying    = ref(false);
const mockTrack      = ref(null);
const mockAudio      = ref(null);

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

// Lazy initialization of the simulator
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
  } catch { /* silently ignore */ }
};

// Watchers
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
