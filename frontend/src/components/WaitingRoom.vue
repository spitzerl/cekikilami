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
      <ThemeToggle />
      <RouterLink to="/" class="text-link">Accueil</RouterLink>
    </header>

    <main class="home-main shell" style="align-items: center">
      <div class="panel panel-pad reveal" style="width: 100%; max-width: 420px">
        <h1 class="console-title">Rejoindre le salon</h1>
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
            Rejoindre le salon
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
      :subtitle="headerSubtitle"
      :step="1"
      :show-code="false"
    >
      <template #actions>
        <div class="lobby-invite reveal-late">
          <p class="lobby-kicker">Code du salon</p>
          <RoomCode :code="route.params.code" />
        </div>
      </template>
    </GameHeader>

    <main class="game-shell game-body lobby">
      <!-- Players -->
      <section class="lobby-section" aria-labelledby="players-heading">
        <div class="lobby-section-head">
          <h2 id="players-heading" class="lobby-title">
            Joueurs
            <span class="count-pill">{{ store.players.length }}/{{ maxPlayers }}</span>
          </h2>
          <span class="status">
            <span :class="['status-dot', store.players.length > 1 ? 'is-online' : 'is-live']"></span>
            {{ store.players.length > 1 ? 'Salon ouvert' : 'En attente' }}
          </span>
        </div>

        <TransitionGroup name="list" tag="ul" class="player-grid">
          <li
            v-for="player in store.players"
            :key="player.id"
            :class="['player-tile', {
              'is-local': player.id === store.player?.id,
              'is-offline': !player.is_connected,
            }]"
          >
            <span
              class="player-avatar"
              role="img"
              :aria-label="player.is_connected ? 'En ligne' : 'Hors ligne'"
            >
              <img
                v-if="player.avatar_seed"
                :src="avatarUrl(player.avatar_seed)"
                alt=""
                loading="lazy"
              />
              <span v-else class="player-avatar-fallback">{{ initials(player.name) }}</span>
              <span
                :class="['status-dot', player.is_connected ? 'is-online' : 'is-offline']"
                aria-hidden="true"
              ></span>
            </span>

            <span class="player-copy">
              <span class="player-name">
                {{ player.name }}
                <AppIcon
                  v-if="player.id === store.session?.host_player_id"
                  name="crown"
                  :size="12"
                  class="player-crown"
                />
              </span>
              <span v-if="playerRole(player)" class="player-role">{{ playerRole(player) }}</span>
            </span>

            <button
              v-if="player.id === store.player?.id"
              type="button"
              class="btn btn-ghost btn-icon btn-sm player-refresh"
              title="Générer un nouvel avatar"
              aria-label="Générer un nouvel avatar"
              @click="regenerateAvatar(player.id)"
            >
              <AppIcon name="refresh-cw" :size="14" />
            </button>

            <span
              v-if="isHost && player.id !== store.player?.id"
              class="player-actions"
            >
              <button
                v-if="!player.is_bot"
                type="button"
                class="btn btn-ghost btn-sm player-action"
                title="Transférer les droits d’hôte"
                :aria-label="`Promouvoir ${player.name} comme hôte`"
                @click="promotePlayer(player.id)"
              >
                <AppIcon name="crown" :size="14" />
                <span class="player-action-label">Promouvoir</span>
              </button>
              <button
                type="button"
                class="btn btn-ghost btn-sm player-action is-danger"
                title="Exclure de la partie"
                :aria-label="`Exclure ${player.name}`"
                @click="kickPlayer(player.id)"
              >
                <AppIcon name="user-x" :size="14" />
                <span class="player-action-label">Exclure</span>
              </button>
            </span>
          </li>
        </TransitionGroup>
      </section>

      <!-- Settings summary + start -->
      <footer class="lobby-footer" aria-label="Réglages et lancement">
        <div class="lobby-footer-inner">
          <div class="lobby-settings">
            <button type="button" class="btn btn-ghost btn-sm" @click="openSettings">
              <AppIcon name="sliders" :size="15" />
              Réglages
            </button>
            <p class="hint">{{ settingsSummary }}</p>
          </div>

          <div v-if="isHost" class="lobby-actions">
            <button type="button" class="btn btn-secondary" @click="addBot">
              <AppIcon name="robot" :size="15" />
              Ajouter un bot
            </button>
            <button type="button" class="btn btn-primary" @click="startSelection">
              <AppIcon name="play" :size="15" />
              Lancer la sélection
            </button>
          </div>
          <p v-else class="lobby-wait">
            En attente de <strong>{{ store.session?.host_name }}</strong> pour lancer la sélection.
          </p>
        </div>
      </footer>
    </main>

    <!-- Mobile host actions -->
    <div v-if="isHost" class="mobile-bar md:hidden">
      <button type="button" class="btn btn-ghost btn-icon mobile-settings" aria-label="Ouvrir les réglages" @click="openSettings">
        <AppIcon name="sliders" :size="18" />
      </button>
      <button type="button" class="btn btn-secondary" @click="addBot">
        <AppIcon name="robot" :size="15" />
        Bot
      </button>
      <button type="button" class="btn btn-primary" style="flex: 1" @click="startSelection">
        <AppIcon name="play" :size="15" />
        Lancer la sélection
      </button>
    </div>

    <!-- Settings dialog -->
    <Transition name="fade">
      <div v-if="showSettings" class="overlay" @click.self="showSettings = false">
        <div class="dialog settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
          <div class="dialog-head">
            <div>
              <p class="dialog-kicker">{{ isHost ? 'Hôte' : 'Lecture seule' }}</p>
              <h2 id="settings-title" class="dialog-title">Réglages de la partie</h2>
              <p class="panel-sub">
                {{ isHost ? 'Ajustez le rythme et les options.' : 'Seul l’hôte peut modifier ces réglages.' }}
              </p>
            </div>
            <button type="button" class="btn btn-ghost btn-icon btn-sm" aria-label="Fermer les réglages" @click="showSettings = false">
              <AppIcon name="x" :size="16" />
            </button>
          </div>

          <div class="settings-body">
            <div class="settings-group">
              <p class="settings-group-title">Déroulement</p>

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
                <p class="setting-label">Durée d’écoute / blind test</p>
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
                <p v-if="config.enableBlindTest" class="hint" style="margin-top: 6px">
                  Le blind test reste ouvert pendant toute cette durée.
                </p>
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
            </div>

            <div class="settings-group">
              <p class="settings-group-title">Système de points</p>

              <div class="scoring-list">
                <div
                  v-for="mode in scoringModes"
                  :key="mode.value"
                  :class="[
                    'scoring-card',
                    config.scoringMode === mode.value ? 'is-active' : '',
                    !isHost ? 'is-disabled' : '',
                  ]"
                >
                  <button
                    type="button"
                    class="scoring-card-btn"
                    :disabled="!isHost"
                    :aria-pressed="config.scoringMode === mode.value"
                    @click="selectScoringMode(mode.value)"
                  >
                    <span class="scoring-card-name">{{ mode.label }}</span>
                    <span class="scoring-card-summary">{{ mode.summary }}</span>
                  </button>
                  <span
                    class="info-tip"
                    tabindex="0"
                    role="note"
                    :aria-label="mode.detail"
                  >
                    <AppIcon name="info" :size="13" />
                    <span class="info-tooltip" role="tooltip">{{ mode.detail }}</span>
                  </span>
                </div>
              </div>
              <p class="hint">Le blind test rapporte 1 point dans tous les modes.</p>
            </div>

            <div class="settings-group">
              <p class="settings-group-title">Salon</p>

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
            </div>

            <div class="settings-group">
              <p class="settings-group-title">Options</p>

              <div class="setting">
                <p class="setting-label">Afficher le résultat du blind test avant de voter pour un joueur</p>
                <div class="seg">
                  <button
                    v-for="mode in trackInfoModes"
                    :key="mode.value"
                    type="button"
                    :class="['seg-btn', config.trackInfoMode === mode.value ? 'is-active' : '']"
                    :disabled="!isHost"
                    :aria-pressed="config.trackInfoMode === mode.value"
                    @click="selectTrackInfoMode(mode.value)"
                  >{{ mode.label }}</button>
                </div>
                <p class="hint" style="margin-top: 6px">{{ trackInfoHint }}</p>
              </div>

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

          <div class="dialog-actions">
            <button type="button" class="btn btn-primary btn-block" @click="showSettings = false">
              <AppIcon name="check" :size="15" />
              Terminé
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, reactive, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useGameStore } from '../stores/gameStore';
import { avatarUrl } from '../utils/avatar';
import GameHeader from './GameHeader.vue';
import RoomCode from './RoomCode.vue';
import AppIcon from './AppIcon.vue';
import ThemeToggle from './ThemeToggle.vue';

const route = useRoute();
const router = useRouter();
const store = useGameStore();

const directPseudo = ref('');
const errorMsg = ref(null);
const isLoading = ref(true);
const showSettings = ref(false);

const trackInfoModes = [
  { value: 'before', label: 'Avant le vote', hint: 'Le résultat (titre, artiste, pochette) s’affiche à l’ouverture du vote.' },
  { value: 'after', label: 'Après le vote', hint: 'Il s’affiche à la révélation, une fois les votes fermés.' },
  { value: 'results', label: 'Aux résultats', hint: 'Il reste masqué pendant la manche et apparaît dans le classement final.' },
];

const scoringModes = [
  {
    value: 'detective',
    label: 'Détective',
    summary: '1 point par bonne accusation',
    detail: 'Chaque bonne accusation rapporte 1 point. Le proposeur ne marque aucun point pour son morceau.',
  },
  {
    value: 'balanced',
    label: 'Équilibré',
    summary: '3 points par bonne accusation · bluff jusqu’à 3',
    detail: 'Chaque bonne accusation rapporte 3 points. Sur votre morceau, vous marquez 3, 2, 1 ou 0 point selon le nombre de joueurs qui vous démasquent.',
  },
  {
    value: 'bluff',
    label: 'Bluff',
    summary: '3 points par bonne accusation · +1 par personne trompée',
    detail: 'Chaque bonne accusation rapporte 3 points. Sur votre morceau, chaque joueur trompé rapporte 1 point, jusqu’à 3.',
  },
];

const toggleOptions = [
  { key: 'enableBlindTest', label: 'Blind test', desc: 'Devinez aussi le titre pendant l’écoute. Une bonne réponse rapporte un point.' },
  { key: 'showVoteCount', label: 'Afficher les votes en direct', desc: 'Montre le nombre de votes reçus pendant le vote.' },
  { key: 'showAnswers', label: 'Révéler les réponses', desc: 'Affiche le proposeur et les réponses du blind test à la révélation.' },
  { key: 'autoAdvance', label: 'Enchaîner les manches', desc: 'Passe à la manche suivante sans action de l’hôte.' },
  { key: 'showScoreboard', label: 'Afficher le scoreboard en bas', desc: 'Affiche la barre des joueurs et des scores pendant la partie.' },
];

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
  scoringMode: 'balanced',
  showScoreboard: true,
  trackInfoMode: 'after',
});

const isHost = computed(() => store.isHost);

const maxPlayers = computed(() => store.session?.max_players || 8);

const headerSubtitle = computed(() => {
  if (isHost.value) return 'Tout le monde est là ? Lancez la sélection.';
  return 'L’hôte lancera la sélection.';
});

const formatDuration = (seconds) => (seconds >= 60 ? `${seconds / 60} min` : `${seconds} s`);

const scoringModeLabel = computed(
  () => scoringModes.find((mode) => mode.value === config.scoringMode)?.label || ''
);

const trackInfoLabel = computed(
  () => trackInfoModes.find((mode) => mode.value === config.trackInfoMode)?.label || ''
);

const trackInfoHint = computed(
  () => trackInfoModes.find((mode) => mode.value === config.trackInfoMode)?.hint || ''
);

const settingsSummary = computed(() => {
  const musics = `${config.maxMusicsPerPlayer} morceau${config.maxMusicsPerPlayer > 1 ? 'x' : ''} par joueur`;
  return `${musics}, ${formatDuration(config.selectionDuration)} de sélection, ${config.extractDuration} s d’écoute, ${config.votingDuration} s de vote · Points : ${scoringModeLabel.value} · Blind test : ${trackInfoLabel.value}`;
});

const playerRole = (player) => {
  if (!player.is_connected) return 'Hors ligne';
  if (player.is_bot) return 'Bot';
  const isPlayerHost = player.id === store.session?.host_player_id;
  const isLocal = player.id === store.player?.id;
  if (isPlayerHost) return isLocal ? 'Hôte, vous' : 'Hôte';
  if (isLocal) return 'Vous';
  return '';
};

const openSettings = () => {
  showSettings.value = true;
};

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
  config.scoringMode = s.scoring_mode || 'balanced';
  config.showScoreboard = s.show_scoreboard !== false;
  config.trackInfoMode = s.track_info_mode || 'after';
};

const loadAndSyncConfig = async () => {
  await store.loadSession(route.params.code);
  syncConfig(store.session);
};

const handleKeyDown = (e) => {
  if (showSettings.value) return;
  if (e.code === 'Space' && isHost.value) {
    if (!['INPUT', 'TEXTAREA', 'BUTTON', 'A', 'SELECT'].includes(document.activeElement?.tagName)) {
      e.preventDefault();
      startSelection();
    }
  }
};

const handleSettingsKeyDown = (e) => {
  if (e.key === 'Escape' && showSettings.value) {
    showSettings.value = false;
  }
};

onMounted(async () => {
  try {
    await loadAndSyncConfig();
    if (store.token && store.player && store.player.session_id === store.session?.id) {
      store.connectSocket(route.params.code);
    }
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keydown', handleSettingsKeyDown);
  } catch (err) {
    console.error('Failed to load waiting room:', err);
  } finally {
    isLoading.value = false;
  }
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keydown', handleSettingsKeyDown);
  document.body.style.overflow = '';
});

watch(() => store.session, (s) => {
  if (!s) return;
  syncConfig(s);
  // An invite link without a valid identity must stay on the join form.
  if (!store.player || store.player.session_id !== s.id) return;
  if (s.phase === 'selection') router.push(`/game/${route.params.code}/selection`);
  else if (s.phase === 'voting') router.push(`/game/${route.params.code}/voting`);
  else if (s.phase === 'results') router.push(`/game/${route.params.code}/results`);
}, { deep: true });

watch(showSettings, (open) => {
  document.body.style.overflow = open ? 'hidden' : '';
});

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

const selectScoringMode = (value) => {
  if (!isHost.value || config.scoringMode === value) return;
  config.scoringMode = value;
  saveConfig();
};

const selectTrackInfoMode = (value) => {
  if (!isHost.value || config.trackInfoMode === value) return;
  config.trackInfoMode = value;
  saveConfig();
};

const addBot = async () => { if (isHost.value) try { await store.addBot(); } catch { /* noop */ } };
const startSelection = async () => { if (isHost.value) try { await store.startSelection(); } catch { /* noop */ } };
const regenerateAvatar = async (id) => { try { await store.regenerateAvatar(id); } catch { /* noop */ } };

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
</script>
