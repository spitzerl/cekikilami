<template>
  <!-- Loading state -->
  <div v-if="isLoading" class="home" style="align-items: center; justify-content: center">
    <div class="status" role="status" aria-label="Chargement de la partie">
      <span class="status-dot is-live"></span>
      Chargement de la partie…
    </div>
  </div>

  <!-- Arriving via an invite link without a player identity yet -->
  <div v-else-if="!store.player || store.player.session_id !== store.session?.id" class="home">
    <header class="home-top shell">
      <span class="brand">
        <span class="brand-mark" aria-hidden="true"></span>
        Cékikilami
      </span>
      <span class="spacer"></span>
      <RouterLink to="/" class="text-link">Accueil</RouterLink>
    </header>

    <main class="home-main shell" style="align-items: center">
      <div class="panel panel-pad reveal" style="width: 100%; max-width: 420px">
        <h1 class="console-title">Rejoindre la partie</h1>
        <p class="console-sub">
          Salon <span class="mono" style="color: var(--ink)">{{ route.params.code }}</span>. Choisissez le pseudo que verront les autres joueurs.
        </p>

        <form @submit.prevent="joinDirectly" novalidate>
          <div class="field">
            <label for="direct-pseudo" class="label">Votre pseudo</label>
            <input
              id="direct-pseudo"
              v-model="directPseudo"
              required
              class="input"
              placeholder="Ex. Lucas"
              autocomplete="nickname"
              maxlength="32"
            />
          </div>
          <button type="submit" class="btn btn-primary btn-block btn-lg" style="margin-top: 16px" :disabled="!directPseudo.trim()">
            <AppIcon name="log-in" :size="16" />
            Rejoindre
          </button>
        </form>

        <div v-if="errorMsg" class="form-error" role="alert" aria-live="polite">
          <AppIcon name="alert-triangle" :size="15" style="flex-shrink: 0; margin-top: 1px" />
          {{ errorMsg }}
        </div>
      </div>
    </main>
  </div>

  <!-- Waiting room -->
  <div v-else class="game-layout">
    <GameHeader
      title="Salon d’attente"
      subtitle="Partagez le code, puis lancez la sélection quand tout le monde est là."
      :step="1"
    >
      <template #actions>
        <span class="status">
          <span class="status-dot is-live"></span>
          En attente
        </span>
      </template>
    </GameHeader>

    <main class="game-shell game-body">
      <div class="waiting-grid">
        <!-- Players -->
        <section class="panel" aria-labelledby="players-heading">
          <div class="panel-pad" style="padding-bottom: 10px">
            <div class="panel-head" style="margin-bottom: 0">
              <div>
                <h2 id="players-heading" class="panel-title">
                  Joueurs
                  <span class="count-pill">{{ store.players.length }}/{{ store.session?.max_players || 8 }}</span>
                </h2>
                <p class="panel-sub">Le salon est ouvert. Les joueurs peuvent rejoindre à tout moment.</p>
              </div>
              <div class="roster-actions">
                <button type="button" class="btn btn-secondary btn-sm" @click="copyCode">
                  <AppIcon name="copy" :size="14" />
                  <span class="hidden sm:inline">Copier le lien</span>
                </button>
              </div>
            </div>
            <Transition name="fade">
              <p v-if="copied" class="hint" style="color: var(--success); margin-top: 6px">
                Lien d’invitation copié.
              </p>
            </Transition>
          </div>

          <div class="row-list" style="padding: 0 clamp(16px, 2.6vw, 24px) 4px">
            <TransitionGroup name="list" tag="div">
              <div
                v-for="player in store.players"
                :key="player.id"
                class="row row-static"
                :class="{ 'is-offline-row': !player.is_connected }"
              >
                <div class="media-row">
                  <div style="position: relative; flex-shrink: 0">
                    <img
                      v-if="player.avatar_seed"
                      :src="avatarUrl(player.avatar_seed)"
                      class="avatar"
                      :alt="`Avatar de ${player.name}`"
                      loading="lazy"
                    />
                    <span v-else class="avatar avatar-fallback">{{ initials(player.name) }}</span>
                    <span
                      :class="['status-dot', player.is_connected ? 'is-online' : 'is-offline']"
                      role="img"
                      style="position: absolute; right: -1px; bottom: -1px; border: 2px solid var(--surface); width: 10px; height: 10px"
                      :aria-label="player.is_connected ? 'En ligne' : 'Hors ligne'"
                    ></span>
                  </div>

                  <div class="media-text">
                    <div class="media-title" style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap">
                      {{ player.name }}
                      <span v-if="player.id === store.player?.id" class="tag tag-accent">Vous</span>
                      <span v-if="player.name === store.session?.host_name" class="tag">Hôte</span>
                      <span v-if="player.is_bot" class="tag">Bot</span>
                    </div>
                    <p class="media-sub">{{ player.is_connected ? 'En ligne' : 'Hors ligne' }}</p>
                  </div>
                </div>

                <div style="display: flex; align-items: center; gap: 4px">
                  <button
                    v-if="player.id === store.player?.id"
                    type="button"
                    class="btn btn-ghost btn-icon btn-sm"
                    title="Générer un nouvel avatar"
                    aria-label="Générer un nouvel avatar"
                    @click="regenerateAvatar(player.id)"
                  >
                    <AppIcon name="refresh-cw" :size="14" />
                  </button>

                  <div v-if="isHost && player.id !== store.player?.id" class="player-row-actions">
                    <button
                      v-if="!player.is_bot"
                      type="button"
                      class="btn btn-secondary btn-icon btn-sm"
                      title="Transférer les droits d’hôte"
                      :aria-label="`Promouvoir ${player.name} comme hôte`"
                      @click="promotePlayer(player.id)"
                    >
                      <AppIcon name="crown" :size="14" />
                    </button>
                    <button
                      type="button"
                      class="btn btn-danger btn-icon btn-sm"
                      title="Exclure du salon"
                      :aria-label="`Exclure ${player.name} du salon`"
                      @click="kickPlayer(player.id)"
                    >
                      <AppIcon name="user-x" :size="14" />
                    </button>
                  </div>
                </div>
              </div>
            </TransitionGroup>

            <div v-if="!store.players.length" class="empty-state" style="margin: 8px 0 16px">
              <AppIcon name="users" :size="20" />
              <strong>Personne pour l’instant</strong>
              <p>Partagez le code {{ route.params.code }} pour inviter les premiers joueurs.</p>
            </div>
          </div>

          <div class="rule-top" style="padding: 14px clamp(16px, 2.6vw, 24px)">
            <template v-if="isHost">
              <div class="hidden md:flex" style="gap: 8px">
                <button type="button" class="btn btn-secondary" @click="addBot">
                  <AppIcon name="robot" :size="15" />
                  Ajouter un bot
                </button>
                <button type="button" class="btn btn-primary" style="flex: 1" @click="startSelection">
                  <AppIcon name="play" :size="15" />
                  Lancer la sélection
                </button>
              </div>
              <p class="hidden md:block hint" style="margin-top: 10px">
                Astuce : la barre d’espace lance aussi la sélection.
              </p>
            </template>
            <p v-else class="hint">
              En attente de l’hôte <strong style="color: var(--ink)">{{ store.session?.host_name }}</strong> pour lancer la partie.
            </p>
          </div>
        </section>

        <!-- Settings -->
        <aside class="panel" aria-labelledby="config-heading">
          <div class="panel-pad">
            <div class="panel-head">
              <div>
                <h2 id="config-heading" class="panel-title">
                  Paramètres
                  <AppIcon name="sliders" :size="15" style="color: var(--ink-3)" />
                </h2>
                <p class="panel-sub">
                  {{ isHost ? 'Réglez la partie selon votre groupe.' : 'Seul l’hôte peut modifier ces réglages.' }}
                </p>
              </div>
              <button
                type="button"
                class="btn btn-ghost btn-icon md:hidden"
                :aria-expanded="showConfigOnMobile"
                aria-controls="config-body"
                :aria-label="showConfigOnMobile ? 'Masquer les paramètres' : 'Afficher les paramètres'"
                @click="toggleConfigMobile"
              >
                <AppIcon
                  name="chevron-down"
                  :size="17"
                  :style="{ transform: showConfigOnMobile ? 'rotate(180deg)' : 'none', transition: 'transform .2s ease' }"
                />
              </button>
            </div>

            <div
              id="config-body"
              :class="['settings-body', showConfigOnMobile ? '' : 'settings-collapsed']"
              style="margin-top: 18px"
            >
              <div class="setting">
                <p class="setting-label">Musiques par joueur</p>
                <div class="seg">
                  <button
                    v-for="val in [1, 2, 3, 4, 5]"
                    :key="val"
                    type="button"
                    :class="['seg-btn', config.maxMusicsPerPlayer === val ? 'is-active' : '']"
                    :disabled="!isHost"
                    :aria-pressed="config.maxMusicsPerPlayer === val"
                    @click="isHost && (config.maxMusicsPerPlayer = val) && saveConfig()"
                  >{{ val }}</button>
                </div>
              </div>

              <div class="setting">
                <p class="setting-label">Durée de sélection</p>
                <div class="seg">
                  <button
                    v-for="opt in [{ v: 30, l: '30 s' }, { v: 60, l: '1 min' }, { v: 120, l: '2 min' }, { v: 180, l: '3 min' }, { v: 300, l: '5 min' }]"
                    :key="opt.v"
                    type="button"
                    :class="['seg-btn', config.selectionDuration === opt.v ? 'is-active' : '']"
                    :disabled="!isHost"
                    :aria-pressed="config.selectionDuration === opt.v"
                    @click="isHost && (config.selectionDuration = opt.v) && saveConfig()"
                  >{{ opt.l }}</button>
                </div>
              </div>

              <div class="setting">
                <p class="setting-label">Durée d’extrait</p>
                <div class="seg">
                  <button
                    v-for="val in [10, 15, 20, 30]"
                    :key="val"
                    type="button"
                    :class="['seg-btn', config.extractDuration === val ? 'is-active' : '']"
                    :disabled="!isHost"
                    :aria-pressed="config.extractDuration === val"
                    @click="isHost && (config.extractDuration = val) && saveConfig()"
                  >{{ val }} s</button>
                </div>
              </div>

              <div class="setting">
                <p class="setting-label">Temps de vote</p>
                <div class="seg">
                  <button
                    v-for="val in [20, 30, 40, 50, 60]"
                    :key="val"
                    type="button"
                    :class="['seg-btn', config.votingDuration === val ? 'is-active' : '']"
                    :disabled="!isHost"
                    :aria-pressed="config.votingDuration === val"
                    @click="isHost && (config.votingDuration = val) && saveConfig()"
                  >{{ val }} s</button>
                </div>
              </div>

              <div class="setting">
                <p class="setting-label">Limite de joueurs</p>
                <div class="seg">
                  <button
                    v-for="val in [4, 8, 12, 16]"
                    :key="val"
                    type="button"
                    :class="['seg-btn', config.maxPlayers === val ? 'is-active' : '']"
                    :disabled="!isHost"
                    :aria-pressed="config.maxPlayers === val"
                    @click="isHost && (config.maxPlayers = val) && saveConfig()"
                  >{{ val }}</button>
                </div>
              </div>

              <div>
                <div
                  v-for="toggle in toggleOptions"
                  :key="toggle.key"
                  class="toggle-row"
                >
                  <div class="toggle-copy">
                    <p class="toggle-name">
                      {{ toggle.label }}
                      <span v-if="toggle.key === 'enableBlindTest'" class="tag tag-accent" style="margin-left: 4px; height: 18px; font-size: 10px">+1 pt</span>
                    </p>
                    <p class="toggle-desc">{{ toggle.desc }}</p>
                  </div>
                  <label class="switch">
                    <input
                      :id="`toggle-${toggle.key}`"
                      v-model="config[toggle.key]"
                      type="checkbox"
                      :disabled="!isHost"
                      :aria-label="toggle.label"
                      @change="saveConfig"
                    />
                    <span class="switch-track"><span class="switch-thumb"></span></span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>

    <!-- Mobile host actions -->
    <div v-if="isHost" class="mobile-bar md:hidden">
      <button type="button" class="btn btn-secondary" @click="addBot">
        <AppIcon name="robot" :size="15" />
        Bot
      </button>
      <button type="button" class="btn btn-primary" style="flex: 1" @click="startSelection">
        <AppIcon name="play" :size="15" />
        Lancer la sélection
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, reactive, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useGameStore } from '../stores/gameStore';
import GameHeader from './GameHeader.vue';
import AppIcon from './AppIcon.vue';

const route = useRoute();
const router = useRouter();
const store = useGameStore();

const directPseudo = ref('');
const errorMsg = ref(null);
const isLoading = ref(true);
const showConfigOnMobile = ref(false);
const copied = ref(false);

const toggleOptions = [
  { key: 'showAnswers', label: 'Révéler les réponses', desc: 'Affiche l’auteur du morceau au moment de la révélation.' },
  { key: 'autoAdvance', label: 'Enchaîner les manches', desc: 'Passe à la manche suivante sans action de l’hôte.' },
  { key: 'showVoteCount', label: 'Afficher les votes en direct', desc: 'Montre le nombre de votes reçus pendant le vote.' },
  { key: 'enableBlindTest', label: 'Blind test', desc: 'Devinez aussi le titre. Une bonne réponse rapporte un point.' },
];

const toggleConfigMobile = () => {
  if (window.innerWidth < 768) showConfigOnMobile.value = !showConfigOnMobile.value;
};

const copyCode = async () => {
  try {
    await navigator.clipboard.writeText(`${window.location.origin}/game/${route.params.code}`);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 2000);
  } catch { /* clipboard unavailable */ }
};

const avatarUrl = (seed) =>
  `https://api.dicebear.com/9.x/notionists-neutral/svg?seed=${encodeURIComponent(seed)}&backgroundColor=f5d7b6,f2c7a1,ebd3ba`;

const initials = (name) =>
  (name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();

const config = reactive({
  maxMusicsPerPlayer: 2,
  selectionDuration: 120,
  extractDuration: 20,
  votingDuration: 30,
  showAnswers: true,
  maxPlayers: 8,
  autoAdvance: false,
  showVoteCount: true,
  enableBlindTest: false,
});

const isHost = computed(() =>
  store.player && store.session && store.player.name === store.session.host_name
);

const syncConfig = (s) => {
  if (!s) return;
  config.maxMusicsPerPlayer = s.max_musics_per_player;
  config.selectionDuration = s.selection_duration;
  config.extractDuration = s.extract_duration;
  config.votingDuration = s.voting_duration;
  config.showAnswers = s.show_answers;
  config.maxPlayers = s.max_players;
  config.autoAdvance = s.auto_advance;
  config.showVoteCount = s.show_vote_count;
  config.enableBlindTest = s.enable_blind_test;
};

const loadAndSyncConfig = async () => {
  await store.loadSession(route.params.code);
  syncConfig(store.session);
};

const handleKeyDown = (e) => {
  if (e.code === 'Space' && isHost.value) {
    if (!['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
      e.preventDefault();
      startSelection();
    }
  }
};

onMounted(async () => {
  try {
    await loadAndSyncConfig();
    if (store.player && store.player.session_id === store.session?.id) {
      store.connectSocket(route.params.code);
    }
    window.addEventListener('keydown', handleKeyDown);
  } catch (err) {
    console.error('Failed to load waiting room:', err);
  } finally {
    isLoading.value = false;
  }
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});

watch(() => store.session, (s) => {
  if (!s) return;
  syncConfig(s);
  if (s.phase === 'selection') router.push(`/game/${route.params.code}/selection`);
  else if (s.phase === 'voting') router.push(`/game/${route.params.code}/voting`);
  else if (s.phase === 'results') router.push(`/game/${route.params.code}/results`);
}, { deep: true });

const joinDirectly = async () => {
  errorMsg.value = null;
  try {
    const code = route.params.code.toUpperCase();
    await store.joinSession(code, directPseudo.value);
    store.connectSocket(code);
    await loadAndSyncConfig();
  } catch (err) {
    errorMsg.value = err.response?.data?.error || err.response?.data?.message || err.message || 'Erreur de connexion';
  }
};

const saveConfig = async () => {
  if (!isHost.value) return;
  try {
    await store.updateConfig({ ...config, maxMusicsPerPlayer: config.maxMusicsPerPlayer });
  } catch (err) { console.error('Failed to update config:', err); }
};

const addBot = async () => { if (isHost.value) try { await store.addBot(); } catch { /* noop */ } };
const startSelection = async () => { if (isHost.value) try { await store.startSelection(); } catch { /* noop */ } };
const promotePlayer = async (id) => { try { await store.promotePlayer(id); } catch { /* noop */ } };
const kickPlayer = async (id) => { try { await store.kickPlayer(id); } catch { /* noop */ } };
const regenerateAvatar = async (id) => { try { await store.regenerateAvatar(id); } catch { /* noop */ } };
</script>
