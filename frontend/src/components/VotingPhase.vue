<template>
  <div :class="{ 'game-layout': true, 'no-dock': !showScoreboard }">
    <GameHeader
      :title="headerTitle"
      :subtitle="headerSubtitle"
      :step="3"
    >
      <template #actions>
        <div
          v-if="showTimer"
          :class="['timer', remainingTime < 10 ? 'is-urgent' : '']"
          role="timer"
          :aria-label="`Temps restant : ${remainingTime} secondes`"
        >
          <AppIcon name="clock" :size="15" />
          {{ remainingTime }} s
        </div>

        <button
          v-if="isHost && status === 'voting'"
          type="button"
          :class="['btn', everyoneHasVoted ? 'btn-primary' : 'btn-secondary']"
          @click="advanceSubphase"
        >
          <AppIcon name="eye" :size="15" />
          Révéler ({{ votesSummary.cast }}/{{ votesSummary.total }})
        </button>

        <button
          v-if="isHost && status === 'revelation'"
          type="button"
          class="btn btn-primary"
          @click="advanceFromRevelation"
        >
          <AppIcon name="forward" :size="15" />
          Manche suivante
        </button>
      </template>
    </GameHeader>

    <!-- First round -->
    <main v-if="status === 'idle'" class="game-shell game-body" style="max-width: 820px">
      <section class="panel stage">
        <span class="stage-kicker">
          <span class="status-dot is-live"></span>
          Préparation
        </span>
        <h2 class="stage-title">La partie va commencer</h2>
        <p class="stage-text pretty">
          La sélection est terminée. Écoutez chaque extrait et devinez quel joueur l’a proposé.
        </p>

        <button
          v-if="isHost"
          type="button"
          class="btn btn-primary btn-lg"
          style="margin-top: 26px"
          @click="launchRound"
        >
          <AppIcon name="play" :size="17" />
          Commencer la partie
        </button>
        <div v-else class="status" style="margin-top: 26px">
          <span class="status-dot is-live"></span>
          En attente de l’hôte…
        </div>
      </section>
    </main>

    <main v-else class="game-shell game-body">
      <div :class="['voting-grid', { 'is-single': !showSidePanel }]">
        <!-- Stage -->
        <section class="panel stage" aria-live="polite">
          <!-- Listening -->
          <template v-if="status === 'listening'">
            <span class="stage-kicker">
              <span class="status-dot is-live"></span>
              Écoute en cours
            </span>
            <div :class="['mystery-record', isAudioPlaying ? 'is-playing' : '']" aria-hidden="true"></div>
            <h2 class="stage-title">Écoutez bien</h2>
            <p class="stage-text pretty">
              L’extrait tourne. Les votes ouvriront dès la fin de la lecture.
            </p>

            <div v-if="audioError" class="callout callout-danger" style="margin-top: 18px; width: 100%; max-width: 380px" role="alert">
              <AppIcon name="alert-triangle" :size="15" style="flex-shrink: 0; margin-top: 1px" />
              Extrait indisponible ou bloqué par le navigateur.
            </div>
            <button
              v-if="store.currentMusic?.file_path"
              type="button"
              class="btn btn-ghost btn-sm"
              style="margin-top: 10px"
              @click="retryAudio"
            >
              <AppIcon name="play" :size="13" />
              Relancer l’extrait
            </button>
          </template>

          <!-- Voting -->
          <template v-else-if="status === 'voting'">
            <span class="stage-kicker">
              <span class="status-dot is-live"></span>
              Vote ouvert
            </span>
            <template v-if="hasTrackInfo">
              <div class="artwork artwork-compact">
                <img
                  v-if="store.currentMusic?.cover_url"
                  :src="store.currentMusic.cover_url"
                  :alt="`Pochette de ${store.currentMusic?.title}`"
                />
                <span v-else class="artwork-fallback">
                  <AppIcon name="music" :size="34" :stroke-width="1.25" />
                </span>
              </div>
              <h2 class="stage-title">{{ store.currentMusic.title }}</h2>
              <p class="stage-text">{{ store.currentMusic.artist }}</p>
            </template>
            <div v-else class="mystery-record" aria-hidden="true"></div>
            <h2 v-if="!hasTrackInfo" class="stage-title">À vous de dénoncer</h2>
            <p class="stage-text pretty">
              Désignez le joueur qui a proposé cet extrait.
              <template v-if="!hasTrackInfo">Le titre sera révélé à la fin de la manche.</template>
            </p>

            <div v-if="audioError" class="callout callout-danger" style="margin-top: 14px; width: 100%; max-width: 380px" role="alert">
              <AppIcon name="alert-triangle" :size="15" style="flex-shrink: 0; margin-top: 1px" />
              Extrait indisponible ou bloqué par le navigateur.
            </div>
            <button
              v-if="store.currentMusic?.file_path"
              type="button"
              class="btn btn-ghost btn-sm"
              style="margin-top: 8px"
              @click="retryAudio"
            >
              <AppIcon name="play" :size="13" />
              Relancer l’extrait
            </button>
          </template>

          <!-- Revelation -->
          <template v-else-if="status === 'revelation'">
            <span class="stage-kicker">
              <span class="status-dot is-live"></span>
              Manche terminée
            </span>
            <template v-if="hasTrackInfo">
              <div class="artwork">
                <img v-if="store.currentMusic?.cover_url" :src="store.currentMusic.cover_url" :alt="`Pochette de ${store.currentMusic?.title}`" />
                <span v-else class="artwork-fallback"><AppIcon name="music" :size="40" :stroke-width="1.25" /></span>
              </div>
              <h2 class="stage-title">{{ store.currentMusic.title }}</h2>
              <p class="stage-text">{{ store.currentMusic.artist }}</p>
            </template>
            <div v-else class="mystery-record" aria-hidden="true"></div>
            <p v-if="!hasTrackInfo" class="hint">Titre, artiste et pochette restent masqués jusqu’aux résultats.</p>

            <div v-if="proposerPlayer" class="reveal-proposer">
              <img
                v-if="proposerPlayer.avatar_seed"
                :src="avatarUrl(proposerPlayer.avatar_seed)"
                class="avatar avatar-sm"
                alt=""
              />
              <span v-else class="avatar avatar-sm avatar-fallback">{{ initials(proposerName) }}</span>
              <div style="text-align: left">
                <span class="reveal-label">Proposé par</span>
                <p class="reveal-name">{{ proposerName }}</p>
              </div>
            </div>

            <div v-if="!isObserver" class="result-tags">
              <span v-if="store.session?.enable_blind_test && myBlindTestResult" :class="myBlindTestResult.statusClass">
                Blind test : {{ myBlindTestResult.statusLabel.toLowerCase() }}
              </span>
              <span v-if="myVoteResult" :class="myVoteResult.statusClass">
                Votre vote : {{ myVoteResult.statusLabel.toLowerCase() }}
              </span>
            </div>
          </template>
        </section>

        <!-- Ballot / details -->
        <section v-if="showSidePanel" class="panel panel-pad">
          <!-- Voting ballot -->
          <template v-if="status === 'voting'">
            <div v-if="isObserver" class="callout">
              <AppIcon name="eye" :size="15" style="flex-shrink: 0; margin-top: 1px" />
              Vous êtes spectateur de cette partie. Observez les votes en direct.
            </div>
            <template v-else>
              <div class="panel-head">
                <div>
                  <h2 class="panel-title">Qui a proposé ce morceau ?</h2>
                  <p class="panel-sub">Vous pouvez changer de suspect jusqu’à la révélation.</p>
                </div>
              </div>

              <div v-if="isProposer" class="callout callout-accent" style="margin-bottom: 16px">
                <AppIcon name="info" :size="15" style="flex-shrink: 0; margin-top: 1px" />
                Vous avez proposé ce morceau. Votre vote sert uniquement à brouiller les pistes.
              </div>

              <TransitionGroup name="list" tag="div" class="ballot-list">
                <button
                  v-for="target in ballotTargets"
                  :key="target.id"
                  type="button"
                  :class="['ballot-btn', selectedVoteId === target.id ? 'is-selected' : '']"
                  :disabled="target.id === store.player?.id"
                  :aria-label="`Voter pour ${target.name}${target.id === store.player?.id ? ' (vous ne pouvez pas voter pour vous-même)' : ''}`"
                  @click="castVote(target.id)"
                >
                  <span class="media-row" style="gap: 9px">
                    <img
                      v-if="target.avatar_seed"
                      :src="avatarUrl(target.avatar_seed)"
                      class="avatar avatar-sm"
                      alt=""
                    />
                    <span v-else class="avatar avatar-sm avatar-fallback">{{ initials(target.name) }}</span>
                    <span>
                      {{ target.name }}
                      <span v-if="target.id === store.player?.id" class="tag" style="margin-left: 4px">Vous</span>
                      <span v-else-if="target.id === store.session?.host_player_id" class="tag" style="margin-left: 4px">Hôte</span>
                    </span>
                  </span>
                  <span
                    v-if="store.session?.show_vote_count && getVoteCountForPlayer(target.id) > 0"
                    class="ballot-count"
                    :aria-label="`${getVoteCountForPlayer(target.id)} votes`"
                  >
                    {{ getVoteCountForPlayer(target.id) }}
                  </span>
                </button>
              </TransitionGroup>
            </template>
          </template>

          <!-- Listening: blind test -->
          <template v-else-if="status === 'listening'">
            <div v-if="isObserver" class="callout">
              <AppIcon name="eye" :size="15" style="flex-shrink: 0; margin-top: 1px" />
              Blind test en cours pour les joueurs.
            </div>
            <template v-else>
              <div class="panel-head">
                <div>
                  <h2 class="panel-title">Blind test</h2>
                  <p class="panel-sub">Devinez le titre pendant l’écoute.</p>
                </div>
              </div>

              <div v-if="isProposer" class="callout callout-accent" style="margin-bottom: 16px">
                <AppIcon name="info" :size="15" style="flex-shrink: 0; margin-top: 1px" />
                C’est votre morceau : vous ne participez pas au blind test.
              </div>
              <div class="option-grid">
                <button
                  v-for="(option, index) in blindTestOptions"
                  :key="index"
                  type="button"
                  :class="getBlindTestOptionClass(option)"
                  :disabled="isProposer || remainingTime <= 0"
                  @click="submitBlindTestAnswer(option)"
                >
                  <span class="title">{{ option.title }}</span>
                  <span class="artist">{{ option.artist }}</span>
                </button>
              </div>
              <p v-if="hasAnsweredBlindTest" class="hint" style="margin-top: 12px">
                Réponse enregistrée. Vous pouvez encore la modifier jusqu’à la fin du chrono.
              </p>
            </template>
          </template>

          <!-- Revelation: vote details -->
          <template v-else-if="status === 'revelation'">
            <div class="panel-head">
              <div>
                <h2 class="panel-title">Détail des votes</h2>
                <p class="panel-sub">Ce que chacun a répondu pour cette manche.</p>
              </div>
            </div>

            <div class="scroll-area">
              <div
                v-for="result in voteResults"
                :key="result.player.id"
                class="vote-detail-row"
              >
                <div class="vote-detail-copy">
                  <img
                    v-if="result.player.avatar_seed"
                    :src="avatarUrl(result.player.avatar_seed)"
                    class="avatar avatar-sm"
                    alt=""
                  />
                  <span v-else class="avatar avatar-sm avatar-fallback">{{ initials(result.player.name) }}</span>
                  <span class="who">{{ result.player.name }}</span>
                  <span v-if="result.vote" class="what">
                    pense que c’est <strong>{{ getPlayerName(result.vote.guessed_player_id) }}</strong>
                  </span>
                  <span v-else class="what">n’a pas voté</span>
                </div>
                <span v-if="result.vote" :class="result.statusClass">{{ result.statusLabel }}</span>
              </div>
            </div>

            <p v-if="!voteResults?.length" class="hint" style="text-align: center; padding: 24px 0">
              Aucun joueur pour cette manche.
            </p>
          </template>
        </section>
      </div>
    </main>

    <GamePlayersTracker />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useGameStore } from '../stores/gameStore';
import { avatarUrl } from '../utils/avatar';
import GameHeader from './GameHeader.vue';
import GamePlayersTracker from './GamePlayersTracker.vue';
import AppIcon from './AppIcon.vue';

const route = useRoute();
const router = useRouter();
const store = useGameStore();

const showScoreboard = computed(() => store.session?.show_scoreboard !== false);

const remainingTime = ref(0);
let timerInterval = null;

const selectedVoteId = ref(null);
const audioError = ref(false);
const isAudioPlaying = ref(false);

const blindTestSelectedAnswer = ref(null);
const blindTestSubmitting = ref(false);

const blindTestOptions = computed(() => {
  if (!store.currentMusic || !store.currentMusic.blind_test_options) return [];
  try {
    return typeof store.currentMusic.blind_test_options === 'string' ? JSON.parse(store.currentMusic.blind_test_options) : store.currentMusic.blind_test_options;
  } catch (e) {
    return [];
  }
});

const blindTestResult = computed(() => {
  if (!store.currentMusic || !store.currentMusic.blind_test_answers || !store.player) return null;
  const answer = store.currentMusic.blind_test_answers.find(a => a.player_id === store.player.id);
  return answer || null;
});

const answeredBlindTestOption = computed(() => {
  if (blindTestSelectedAnswer.value) return blindTestSelectedAnswer.value;
  const answer = blindTestResult.value;
  if (!answer) return null;
  return { title: answer.answer_title, artist: answer.answer_artist };
});

const hasAnsweredBlindTest = computed(() => answeredBlindTestOption.value !== null);

const submitBlindTestAnswer = async (option) => {
  if (isObserver.value
    || isProposer.value
    || blindTestSubmitting.value
    || status.value !== 'listening'
    || remainingTime.value <= 0) return;
  const previous = blindTestSelectedAnswer.value;
  blindTestSelectedAnswer.value = option;
  blindTestSubmitting.value = true;
  try {
    await store.submitBlindTestAnswer(store.currentMusic.id, option.title, option.artist);
  } catch (err) {
    console.error('Failed to submit blind test answer:', err);
    blindTestSelectedAnswer.value = previous;
  } finally {
    blindTestSubmitting.value = false;
  }
};

const getBlindTestOptionClass = (option) => {
  if (!hasAnsweredBlindTest.value) return 'option-btn';
  const isSelected = answeredBlindTestOption.value?.title === option.title
    && answeredBlindTestOption.value?.artist === option.artist;
  if (!isSelected) return 'option-btn';
  // Keep the answer neutral until the reveal: the interface promises the
  // result at the end of the round, so don't leak it during listening.
  if (status.value === 'revelation' && blindTestResult.value?.is_correct) return 'option-btn is-correct';
  if (status.value === 'revelation' && blindTestResult.value) return 'option-btn is-wrong';
  return 'option-btn is-chosen';
};

let audio = null;

const status = computed(() => store.session?.voting_status || 'listening');
const hasTrackInfo = computed(() => Boolean(store.currentMusic?.title));

const headerTitle = computed(() => (status.value === 'revelation' ? 'Révélation' : 'Écoute & vote'));

const headerSubtitle = computed(() => {
  if (status.value === 'idle') return 'La première manche va commencer.';

  const index = (store.session?.current_music_index ?? 0) + 1;
  const total = store.currentMusic?.round_total;
  const round = total ? `Morceau ${index} sur ${total}.` : `Morceau ${index}.`;

  if (status.value === 'listening') return `${round} Écoutez l’extrait.`;
  if (status.value === 'voting') return `${round} À vous de dénoncer.`;
  if (status.value === 'revelation') return `${round} La manche est terminée.`;
  return round;
});

const showTimer = computed(
  () => status.value === 'listening' || status.value === 'voting'
);

const showSidePanel = computed(() => {
  if (status.value === 'listening') {
    return !!store.session?.enable_blind_test && !isObserver.value;
  }
  return status.value === 'voting' || status.value === 'revelation';
});

const isHost = computed(() => store.isHost);

const launchRound = async () => {
  if (!isHost.value) return;
  try {
    await store.startRound();
  } catch (err) {
    console.error('Failed to launch round:', err);
  }
};

const advanceFromRevelation = async () => {
  if (!isHost.value) return;
  try {
    await store.advanceRound();
  } catch (err) {
    console.error('Failed to advance from revelation:', err);
  }
};

const advanceSubphase = async () => {
  if (!isHost.value) return;
  try {
    await store.advanceRound();
  } catch (err) {
    console.error('Failed to advance subphase:', err);
  }
};

const totalVotesCast = computed(() => {
  if (!store.votes) return 0;
  if (Array.isArray(store.votes)) return store.votes.length;
  return Object.values(store.votes).reduce((sum, count) => sum + count, 0);
});

const totalEligibleVoters = computed(() => {
  if (!store.players) return 0;
  return store.players.filter(p => !p.is_observer && p.is_connected).length;
});

const everyoneHasVoted = computed(() => {
  const voters = totalEligibleVoters.value;
  return voters > 0 && totalVotesCast.value >= voters;
});

const votesSummary = computed(() => ({
  cast: Math.min(totalVotesCast.value, totalEligibleVoters.value),
  total: totalEligibleVoters.value,
}));

const handleSpaceAdvance = async () => {
  if (!isHost.value) return;
  try {
    if (status.value === 'idle') {
      await store.startRound();
    } else if (status.value === 'voting' || status.value === 'revelation') {
      await store.advanceRound();
    }
  } catch (err) {
    console.error('Failed to advance phase via keyboard:', err);
  }
};

const handleKeyDown = (e) => {
  if (e.code === 'Space' && isHost.value) {
    const isInteractive = ['INPUT', 'TEXTAREA', 'BUTTON', 'A', 'SELECT'].includes(document.activeElement?.tagName);
    if (!isInteractive) {
      e.preventDefault();
      handleSpaceAdvance();
    }
  }
};

const isObserver = computed(() => store.player?.is_observer);

const isProposer = computed(() => {
  if (!store.currentMusic) return false;
  if (store.currentMusic.is_proposer !== undefined) return store.currentMusic.is_proposer;
  if (store.musics && store.musics.length > 0) {
    return store.musics.some(m => m.file_path === store.currentMusic.file_path || (m.title === store.currentMusic.title && m.artist === store.currentMusic.artist));
  }
  return false;
});

const eligiblePlayers = computed(() => {
  if (!store.players) return [];
  return store.players
    .filter(p => !p.is_observer)
    .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
});

// Yourself is never a valid target, so it goes last instead of splitting the list.
const ballotTargets = computed(() => {
  const selfId = store.player?.id;
  const others = eligiblePlayers.value.filter((p) => p.id !== selfId);
  const self = eligiblePlayers.value.find((p) => p.id === selfId);
  return self ? [...others, self] : others;
});

const voteResults = computed(() => {
  if (!eligiblePlayers.value) return [];
  const currentVotes = Array.isArray(store.votes) ? store.votes : [];
  return eligiblePlayers.value.map(player => {
    const vote = currentVotes.find(v => v.voter_id === player.id);
    const isProposerPlayer = player.id === store.currentMusic?.player_id;
    let statusLabel = '';
    let statusClass = '';

    if (!vote) {
      statusLabel = 'N’a pas voté';
      statusClass = 'tag tag-danger';
    } else if (isProposerPlayer) {
      statusLabel = 'Bluff';
      statusClass = 'tag';
    } else if (vote.guessed_player_id === store.currentMusic?.player_id) {
      statusLabel = 'Correct';
      statusClass = 'tag tag-success';
    } else {
      statusLabel = 'Incorrect';
      statusClass = 'tag tag-danger';
    }

    return { player, vote, isProposer: isProposerPlayer, statusLabel, statusClass };
  });
});

const myVoteResult = computed(() => {
  if (!store.player) return null;
  return voteResults.value.find(r => r.player.id === store.player.id) || null;
});

const myBlindTestResult = computed(() => {
  if (!store.session?.enable_blind_test || !store.player) return null;

  let statusLabel = '';
  let statusClass = 'tag';

  if (isProposer.value) {
    statusLabel = 'Ne participe pas';
    statusClass = 'tag';
  } else if (!blindTestResult.value) {
    statusLabel = 'Sans réponse';
    statusClass = 'tag tag-danger';
  } else if (blindTestResult.value.is_correct) {
    statusLabel = 'Correct';
    statusClass = 'tag tag-success';
  } else {
    statusLabel = 'Incorrect';
    statusClass = 'tag tag-danger';
  }

  return { statusLabel, statusClass };
});

const proposerPlayer = computed(() => {
  if (!store.currentMusic || !store.currentMusic.player_id) return null;
  return store.players.find(p => p.id === store.currentMusic.player_id) || null;
});

const proposerName = computed(() => {
  const p = proposerPlayer.value;
  return p ? p.name : 'Inconnu';
});

const getPlayerName = (id) => {
  const p = store.players.find(player => player.id === id);
  return p ? p.name : 'Inconnu';
};

const getVoteCountForPlayer = (playerId) => {
  if (status.value === 'voting' && store.votes) {
    return store.votes[playerId] || 0;
  }
  return 0;
};

const initials = (name) =>
  (name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();

const formatAudioUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://')) return path.replace('http://', 'https://');
  if (path.startsWith('https://')) return path;
  return path;
};

const isIgnorablePlayError = (error) => ['NotAllowedError', 'AbortError'].includes(error?.name);

const stopAudio = () => {
  if (!audio) return;
  const previous = audio;
  audio = null;
  previous.onerror = null;
  previous.onplaying = null;
  previous.onpause = null;
  previous.onended = null;
  previous.pause();
  isAudioPlaying.value = false;
};

watch(() => store.volume, (newVol) => {
  if (audio) audio.volume = newVol;
});

const startAudio = () => {
  audioError.value = false;
  isAudioPlaying.value = false;
  stopAudio();

  if (!store.currentMusic?.file_path) return;

  const current = new Audio(formatAudioUrl(store.currentMusic.file_path));
  audio = current;
  current.volume = store.volume;

  current.onerror = () => {
    if (audio !== current || status.value !== 'listening') return;
    audioError.value = true;
    isAudioPlaying.value = false;
  };
  current.onplaying = () => {
    if (audio !== current) return;
    audioError.value = false;
    isAudioPlaying.value = true;
  };
  current.onpause = () => {
    if (audio === current) isAudioPlaying.value = false;
  };
  current.onended = () => {
    if (audio === current) isAudioPlaying.value = false;
  };

  if (status.value === 'listening') {
    current.play().then(() => {
      if (audio !== current) return;
      audioError.value = false;
      isAudioPlaying.value = true;
    }).catch(err => {
      if (audio !== current) return;
      console.warn('Autoplay was blocked or audio failed:', err);
      if (!isIgnorablePlayError(err)) audioError.value = true;
    });
  }
};

const retryAudio = () => {
  audioError.value = false;
  if (!audio || audio.error) {
    startAudio();
    return;
  }

  const current = audio;
  current.play().then(() => {
    if (audio !== current) return;
    audioError.value = false;
    isAudioPlaying.value = true;
  }).catch(err => {
    if (audio !== current) return;
    console.error('Manual replay failed:', err);
    if (!isIgnorablePlayError(err)) audioError.value = true;
  });
};

const castVote = async (targetId) => {
  if (isObserver.value || status.value !== 'voting') return;

  try {
    selectedVoteId.value = targetId;
    await store.submitVote(store.currentMusic.id, targetId);
  } catch (err) {
    console.error('Failed to submit vote:', err);
  }
};

const updateTimer = () => {
  if (store.session?.timer_ends_at) {
    const end = new Date(store.session.timer_ends_at).getTime();
    remainingTime.value = Math.max(0, Math.round((end - store.correctedNow()) / 1000));
  } else {
    remainingTime.value = 0;
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

  startAudio();
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval);
  stopAudio();
  window.removeEventListener('keydown', handleKeyDown);
});

watch(() => store.currentMusic?.id, () => {
  selectedVoteId.value = null;
  blindTestSelectedAnswer.value = null;
});

watch([status, () => store.currentMusic?.id], ([newStatus]) => {
  if (newStatus === 'listening') {
    startAudio();
  } else {
    if (audio) audio.pause();
    isAudioPlaying.value = false;
    audioError.value = false;
  }
});

watch(() => store.session?.phase, (newPhase) => {
  if (newPhase === 'results') {
    router.push(`/game/${route.params.code}/results`);
  } else if (newPhase === 'selection') {
    router.push(`/game/${route.params.code}/selection`);
  } else if (newPhase === 'waiting') {
    router.push(`/game/${route.params.code}`);
  }
});
</script>
