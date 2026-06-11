<template>
  <div class="relative min-h-dvh flex flex-col overflow-hidden bg-[var(--surface-base)]">

    <!-- Floating background notes -->
    <div class="absolute inset-0 pointer-events-none overflow-hidden select-none z-0" aria-hidden="true">
      <div class="floating-item text-indigo-400/15 text-3xl" style="left:8%;animation-delay:0s;animation-duration:14s">🎵</div>
      <div class="floating-item text-violet-400/15 text-4xl" style="left:22%;animation-delay:3s;animation-duration:18s">🎶</div>
      <div class="floating-item text-cyan-400/15 text-2xl" style="left:45%;animation-delay:6s;animation-duration:13s">🎧</div>
      <div class="floating-item text-violet-400/15 text-3xl" style="left:73%;animation-delay:1.5s;animation-duration:19s">🎵</div>
      <div class="floating-item text-indigo-400/15 text-4xl" style="left:88%;animation-delay:8s;animation-duration:15s">🎹</div>
    </div>

    <!-- Ambient blobs -->
    <div class="absolute -top-48 -left-48 w-96 h-96 rounded-full blur-[120px] opacity-20 bg-indigo-600 pointer-events-none" aria-hidden="true"></div>
    <div class="absolute -bottom-48 -right-48 w-96 h-96 rounded-full blur-[120px] opacity-20 bg-violet-600 pointer-events-none" aria-hidden="true"></div>

    <!-- ── MAIN CONTENT ── -->
    <main class="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-10 sm:py-16 gap-8 max-w-6xl mx-auto w-full">

      <!-- Hero -->
      <div class="text-center animate-fade-in-up opacity-0" style="animation-delay:0s">
        <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 text-xs font-bold uppercase tracking-widest mb-5">
          <span class="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
          Blind Test Social Interactif
        </div>
        <h1 class="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight mb-4">
          <span class="bg-gradient-to-r from-indigo-400 via-violet-300 to-cyan-400 bg-clip-text text-transparent">
            Cékikilami
          </span>
        </h1>
        <p class="text-base sm:text-lg text-[var(--text-secondary)] max-w-lg mx-auto leading-relaxed">
          Devinez qui a proposé chaque morceau et devenez le maître du rythme.
        </p>
      </div>

      <!-- PWA Install Banner -->
      <Transition name="fade">
        <div v-if="isAppInstallable" role="banner" class="glass-panel p-4 rounded-2xl border border-indigo-500/20 w-full max-w-md flex items-center justify-between gap-4 shadow-lg animate-fade-in-up opacity-0">
          <div class="flex items-center gap-3">
            <img src="/icon-192.png" class="w-10 h-10 rounded-xl object-cover border border-indigo-500/25 flex-shrink-0" alt="Logo Cékikilami" />
            <div class="text-left">
              <p class="text-sm font-bold text-white">Installer l'application</p>
              <p class="text-xs text-[var(--text-secondary)]">Jouez en plein écran, accès hors-ligne.</p>
            </div>
          </div>
          <button @click="installPWA" class="btn btn-primary text-sm px-4 py-2" style="min-height:36px">
            Installer
          </button>
        </div>
      </Transition>

      <!-- Main grid: forms left/top, simulator right/bottom -->
      <div class="grid grid-cols-1 lg:grid-cols-11 gap-6 lg:gap-10 w-full items-start">

        <!-- ── RIGHT COL (order-1 mobile): Forms ── -->
        <div class="lg:col-span-5 flex flex-col gap-4 order-1 lg:order-2 animate-fade-in-up opacity-0" style="animation-delay:.08s">

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

          <!-- Form card -->
          <Transition name="slide-up" mode="out-in">
            <!-- CREATE -->
            <div v-if="activeAction==='create'" key="create" id="panel-create" role="tabpanel" aria-labelledby="tab-create" class="glass-panel p-7 rounded-2xl border border-indigo-500/20 shadow-xl">
              <div class="w-11 h-11 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-5">
                <i class="fa-solid fa-plus text-[20px]"></i>
              </div>
              <h2 class="text-2xl font-bold text-white mb-1">Créer un Salon</h2>
              <p class="text-sm text-[var(--text-secondary)] mb-6">Devenez l'hôte et invitez vos amis via un code.</p>

              <form @submit.prevent="onCreate" class="space-y-4" novalidate>
                <div>
                  <label for="create-name" class="form-label">Votre Pseudo</label>
                  <input
                    id="create-name" v-model="createName" required
                    class="form-input" placeholder="Ex: Lucas"
                    :aria-invalid="!!error && activeAction==='create'"
                    autocomplete="nickname" maxlength="32"
                  />
                </div>
                <button type="submit" class="btn btn-primary w-full text-base" :disabled="!createName.trim()">
                  <i class="fa-solid fa-play text-[16px] mr-1.5"></i>
                  Lancer le Salon
                </button>
              </form>
            </div>

            <!-- JOIN -->
            <div v-else key="join" id="panel-join" role="tabpanel" aria-labelledby="tab-join" class="glass-panel p-7 rounded-2xl border border-violet-500/20 shadow-xl">
              <div class="w-11 h-11 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 mb-5">
                <i class="fa-regular fa-user text-[20px]"></i>
              </div>
              <h2 class="text-2xl font-bold text-white mb-1">Rejoindre un Salon</h2>
              <p class="text-sm text-[var(--text-secondary)] mb-6">Entrez le code à 6 caractères communiqué par l'hôte.</p>

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
                    <label for="join-name" class="form-label">Votre Pseudo</label>
                    <input
                      id="join-name" v-model="joinName" required
                      class="form-input" placeholder="Ex: Lucas"
                      autocomplete="nickname" maxlength="32"
                    />
                  </div>
                </div>
                <button type="submit" class="btn btn-secondary w-full text-base" :disabled="!joinCode.trim() || !joinName.trim()">
                  <i class="fa-solid fa-right-to-bracket text-[16px] mr-1.5"></i>
                  Rejoindre la Partie
                </button>
              </form>
            </div>
          </Transition>

          <!-- Error alert -->
          <Transition name="fade">
            <div v-if="error" role="alert" aria-live="assertive" class="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold" style="background:var(--clr-danger-dim);border:1px solid rgba(244,63,94,.3);color:#fda4af">
              <i class="fa-solid fa-triangle-exclamation text-[18px] text-rose-400 flex-shrink-0"></i>
              {{ error }}
            </div>
          </Transition>
        </div>

        <!-- ── LEFT COL (order-2 mobile): Rules + Simulator ── -->
        <div class="lg:col-span-6 flex flex-col gap-5 order-2 lg:order-1 animate-fade-in-up opacity-0" style="animation-delay:.16s">

          <!-- Rules grid -->
          <div class="grid grid-cols-2 gap-3">
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

          <!-- Simulator -->
          <div class="glass-panel p-5 rounded-2xl border border-violet-500/15 hover:border-violet-500/30 transition-all duration-300">
            <div class="flex items-center justify-between mb-4">
              <h2 class="section-header text-base">
                <i class="fa-solid fa-sliders text-[18px] icon"></i>
                Simuler un Tour
              </h2>
              <button @click="resetMockGame" class="text-xs text-[var(--text-secondary)] hover:text-white underline underline-offset-2 transition-colors">
                Réinitialiser
              </button>
            </div>

            <!-- Track player -->
            <div class="flex items-center gap-4 bg-slate-900/70 p-4 rounded-xl border border-[var(--border)] mb-4">
              <!-- Vinyl -->
              <button
                @click="mockPlaying=!mockPlaying"
                :aria-label="mockPlaying ? 'Mettre en pause' : 'Lancer la lecture'"
                class="relative w-20 h-20 rounded-full flex-shrink-0 cursor-pointer group touch-target"
              >
                <div :class="['absolute inset-0 bg-slate-950 rounded-full border-2 border-slate-800 flex items-center justify-center shadow-lg', mockPlaying ? 'animate-spin-slow' : '']">
                  <div class="w-16 h-16 rounded-full border border-slate-800/40 flex items-center justify-center">
                    <div class="w-10 h-10 rounded-full border border-slate-800/60 flex items-center justify-center overflow-hidden relative">
                      <img v-if="mockTrack?.cover" :src="mockTrack.cover" class="absolute inset-0 w-full h-full object-cover opacity-60" alt="" />
                      <div class="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center z-10 relative">
                        <div class="w-1.5 h-1.5 rounded-full bg-slate-950"></div>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="absolute inset-0 bg-slate-950/60 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <i v-if="mockPlaying" class="fa-solid fa-pause text-[24px] text-white"></i>
                  <i v-else class="fa-solid fa-play text-[24px] text-white ml-1"></i>
                </div>
              </button>

              <!-- Track info -->
              <div class="flex-grow min-w-0">
                <div class="text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-black mb-0.5">Thème : Chanson de la honte</div>
                <div class="text-sm font-extrabold text-white flex flex-wrap items-center gap-1.5">
                  Morceau Mystère 📻
                  <span class="badge badge-accent">Devinez l'auteur !</span>
                </div>
                <!-- Equalizer -->
                <div class="flex items-end gap-1 h-6 mt-3" aria-hidden="true">
                  <span :class="['w-1.5 bg-indigo-400 rounded-full transition-all duration-300', mockPlaying ? 'animate-eq-1' : 'h-1.5']"></span>
                  <span :class="['w-1.5 bg-indigo-300 rounded-full transition-all duration-300', mockPlaying ? 'animate-eq-2' : 'h-3']"></span>
                  <span :class="['w-1.5 bg-violet-400 rounded-full transition-all duration-300', mockPlaying ? 'animate-eq-3' : 'h-1']"></span>
                  <span :class="['w-1.5 bg-violet-500 rounded-full transition-all duration-300', mockPlaying ? 'animate-eq-4' : 'h-2']"></span>
                  <span :class="['w-1.5 bg-cyan-400 rounded-full transition-all duration-300', mockPlaying ? 'animate-eq-5' : 'h-1.5']"></span>
                </div>
              </div>
            </div>

            <!-- Vote choices / Result -->
            <div v-if="!mockGuessed">
              <p class="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Qui est le coupable ?</p>
              <div class="grid grid-cols-3 gap-2">
                <button v-for="suspect in mockSuspects" :key="suspect.name"
                  @click="guessSuspect(suspect.name)"
                  class="vote-btn justify-center text-sm py-3 min-h-[52px]"
                >
                  {{ suspect.emoji }} {{ suspect.name }}
                </button>
              </div>
            </div>

            <Transition name="slide-up" mode="out-in">
              <div v-if="mockGuessed==='success'" key="success" class="rounded-xl p-4 flex flex-col gap-1.5" style="background:var(--clr-success-dim);border:1px solid rgba(16,185,129,.3)">
                <div class="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <i class="fa-solid fa-circle-check text-[18px] text-emerald-400 flex-shrink-0"></i>
                  Bingo ! +100 points !
                </div>
                <p class="text-xs text-emerald-300/80 leading-relaxed">C'est bien Alice qui a proposé ce morceau. Vous gagnez 100 pts !</p>
                <button @click="resetMockGame" class="btn btn-ghost text-xs self-start mt-1" style="min-height:32px;padding:.3rem .9rem">Rejouer</button>
              </div>
              <div v-else-if="mockGuessed==='error'" key="error" class="rounded-xl p-4 flex flex-col gap-1.5" style="background:var(--clr-danger-dim);border:1px solid rgba(244,63,94,.3)">
                <div class="flex items-center gap-2 text-rose-400 font-bold text-sm">
                  <i class="fa-solid fa-circle-xmark text-[18px] text-rose-400 flex-shrink-0"></i>
                  Faux ! Ce n'est pas {{ mockSuspectName }}.
                </div>
                <p class="text-xs text-rose-300/80 leading-relaxed">{{ mockSuspectName }} sourit en coin… Analysez mieux le style !</p>
                <button @click="resetMockGame" class="btn btn-ghost text-xs self-start mt-1" style="min-height:32px;padding:.3rem .9rem">Réessayer</button>
              </div>
            </Transition>
          </div>
        </div>
      </div>
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

onMounted(async () => {
  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  window.addEventListener('appinstalled', handleAppInstalled);
  try {
    const res = await api.searchDeezer();
    const tracks = res.data.tracks;
    if (tracks?.length) {
      mockTrack.value = tracks[Math.floor(Math.random() * tracks.length)];
      if (mockTrack.value.preview) {
        mockAudio.value = new Audio(mockTrack.value.preview);
        mockAudio.value.loop = true;
        mockAudio.value.volume = 0.4;
        mockPlaying.value = true;
        mockAudio.value.play().catch(() => { mockPlaying.value = false; });
      }
    }
  } catch { /* silently ignore */ }
});

onUnmounted(() => {
  window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  window.removeEventListener('appinstalled', handleAppInstalled);
  if (mockAudio.value) { mockAudio.value.pause(); mockAudio.value.src = ''; mockAudio.value = null; }
});

watch(mockPlaying, (playing) => {
  if (!mockAudio.value) return;
  playing ? mockAudio.value.play().catch(() => { mockPlaying.value = false; }) : mockAudio.value.pause();
});

const onCreate = async () => {
  error.value = null;
  try {
    const { session } = await store.createSession(createName.value);
    store.connectSocket(session.code);
    router.push(`/game/${session.code}`);
  } catch (err) {
    error.value = err.response?.data?.message || err.message || 'Erreur de création';
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
    error.value = err.response?.data?.message || err.message || 'Impossible de rejoindre';
  }
};
</script>
