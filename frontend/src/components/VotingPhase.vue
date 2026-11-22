<template>
  <div class="game-layout">
    <GameHeader
      :title="status === 'revelation' ? 'Révélation' : 'Écoute & vote'"
      :subtitle="status === 'idle' ? 'La première manche va commencer.' : `Morceau ${(store.session?.current_music_index || 0) + 1}. Écoutez, puis dénoncez.`"
      :step="3"
    >
      <template #actions>
        <div
          v-if="status !== 'idle'"
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
          Révéler ({{ totalVotesCast }}/{{ totalEligibleVoters }})
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
      <div class="voting-grid">
        <!-- Stage -->
        <section class="panel stage" aria-live="polite">
          <!-- Listening -->
          <template v-if="status === 'listening'">
            <div class="mystery-record" aria-hidden="true"></div>
            <span class="stage-kicker">
              <span class="status-dot is-live"></span>
              Écoute en cours
            </span>
            <h2 class="stage-title">Écoutez bien</h2>
            <p class="stage-text pretty">
              L’extrait tourne. Les votes ouvriront dès la fin de la lecture.
            </p>
            <div class="eq is-playing" style="margin-top: 18px" aria-hidden="true">
              <span></span><span></span><span></span><span></span><span></span>
            </div>

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
            <div class="artwork artwork-compact">
              <img v-if="store.currentMusic?.cover_url" :src="store.currentMusic.cover_url" :alt="`Pochette de ${store.currentMusic?.title}`" />
              <span v-else class="artwork-fallback"><AppIcon name="music" :size="40" :stroke-width="1.25" /></span>
            </div>
            <h2 class="stage-title">{{ store.currentMusic?.title }}</h2>
            <p class="stage-text">{{ store.currentMusic?.artist }}</p>
            <p class="stage-kicker" style="margin-top: 22px; margin-bottom: 0">Qui a proposé ce morceau ?</p>

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
              Révélation
            </span>
            <div class="artwork">
              <img v-if="store.currentMusic?.cover_url" :src="store.currentMusic.cover_url" :alt="`Pochette de ${store.currentMusic?.title}`" />
              <span v-else class="artwork-fallback"><AppIcon name="music" :size="40" :stroke-width="1.25" /></span>
            </div>
            <h2 class="stage-title">{{ store.currentMusic?.title }}</h2>
            <p class="stage-text">{{ store.currentMusic?.artist }}</p>

            <div class="reveal-proposer">
              <img
                v-if="proposerPlayer?.avatar_seed"
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
                Blind test : {{ myBlindTestResult.statusLabel }}
              </span>
              <span v-if="myVoteResult" :class="myVoteResult.statusClass">
                Vote : {{ myVoteResult.statusLabel }}
              </span>
            </div>
          </template>
        </section>

        <!-- Ballot / details -->
        <section class="panel panel-pad">
          <!-- Voting ballot -->
          <template v-if="status === 'voting'">
            <div v-if="isObserver" class="callout">
              <AppIcon name="eye" :size="15" style="flex-shrink: 0; margin-top: 1px" />
              Vous êtes spectateur de cette partie. Observez les votes en direct.
            </div>
            <template v-else>
              <div v-if="isProposer" class="callout callout-accent" style="margin-bottom: 16px">
                <AppIcon name="info" :size="15" style="flex-shrink: 0; margin-top: 1px" />
                Vous avez proposé ce morceau. Votre vote sert uniquement à brouiller les pistes.
              </div>

              <p class="ballot-title">Votre suspect</p>
              <TransitionGroup name="list" tag="div" class="ballot-list">
                <button
                  v-for="target in eligiblePlayers"
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
                      <span v-else-if="target.name === store.session?.host_name" class="tag" style="margin-left: 4px">Hôte</span>
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
            <div v-if="!store.session?.enable_blind_test" class="callout">
              <AppIcon name="clock" :size="15" style="flex-shrink: 0; margin-top: 1px" />
              Les options de vote apparaîtront dès la fin de l’écoute.
            </div>
            <div v-else-if="isObserver" class="callout">
              <AppIcon name="eye" :size="15" style="flex-shrink: 0; margin-top: 1px" />
              Blind test en cours pour les joueurs.
            </div>
            <template v-else>
              <div v-if="isProposer" class="callout callout-accent" style="margin-bottom: 16px">
                <AppIcon name="info" :size="15" style="flex-shrink: 0; margin-top: 1px" />
                C’est votre morceau : vous ne participez pas au blind test.
              </div>
              <p class="ballot-title">Blind test : quel est ce morceau ?</p>
              <div class="option-grid">
                <button
                  v-for="(option, index) in blindTestOptions"
                  :key="index"
                  type="button"
                  :class="getBlindTestOptionClass(option)"
                  :disabled="hasAnsweredBlindTest || isProposer"
                  @click="submitBlindTestAnswer(option)"
                >
                  <span class="title">{{ option.title }}</span>
                  <span class="artist">{{ option.artist }}</span>
                </button>
              </div>
              <p v-if="hasAnsweredBlindTest" class="hint" style="margin-top: 12px">
                Réponse enregistrée. Résultat à la révélation.
              </p>
            </template>
          </template>

          <!-- Revelation: vote details -->
          <template v-else-if="status === 'revelation'">
            <div class="panel-head">
              <div>
                <h2 class="panel-title">Détail des votes</h2>
                <p class="panel-sub">Ce que chacun pensait, et ce que ça rapporte.</p>
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
                <span :class="result.statusClass">{{ result.statusLabel }}</span>
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
import GameHeader from './GameHeader.vue';
import GamePlayersTracker from './GamePlayersTracker.vue';
import AppIcon from './AppIcon.vue';

const route = useRoute();
const router = useRouter();
const store = useGameStore();

const remainingTime = ref(0);
let timerInterval = null;

const selectedVoteId = ref(null);
const audioError = ref(false);

const blindTestSelectedAnswer = ref(null);

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
  if (isObserver.value || status.value !== 'listening' || hasAnsweredBlindTest.value) return;
  blindTestSelectedAnswer.value = option;
  try {
    await store.submitBlindTestAnswer(store.currentMusic.id, option.title, option.artist);
  } catch (err) {
    console.error('Failed to submit blind test answer:', err);
    blindTestSelectedAnswer.value = null;
  }
};

const getBlindTestOptionClass = (option) => {
  if (!hasAnsweredBlindTest.value) return 'option-btn';
  const isSelected = answeredBlindTestOption.value?.title === option.title
    && answeredBlindTestOption.value?.artist === option.artist;
  if (!isSelected) return 'option-btn';
  if (blindTestResult.value?.is_correct) return 'option-btn is-correct';
  if (blindTestResult.value) return 'option-btn is-wrong';
  return 'option-btn is-chosen';
};

let audio = null;

const status = computed(() => store.session?.voting_status || 'listening');

const isHost = computed(() => {
  return store.player && store.session && store.player.name === store.session.host_name;
});

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

const handleSpaceAdvance = async () => {
  if (!isHost.value) return;
  try {
    if (status.value === 'idle') {
      await store.startRound();
    } else {
      await store.advanceRound();
    }
  } catch (err) {
    console.error('Failed to advance phase via keyboard:', err);
  }
};

const handleKeyDown = (e) => {
  if (e.code === 'Space' && isHost.value) {
    const isTyping = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
    if (!isTyping) {
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

const voteResults = computed(() => {
  if (!eligiblePlayers.value) return [];
  const currentVotes = Array.isArray(store.votes) ? store.votes : [];
  return eligiblePlayers.value.map(player => {
    const vote = currentVotes.find(v => v.voter_id === player.id);
    const isProposerPlayer = player.id === store.currentMusic?.player_id;
    let statusLabel = '';
    let statusClass = '';

    if (isProposerPlayer) {
      statusLabel = 'Bluff';
      statusClass = 'tag';
    } else if (!vote) {
      statusLabel = 'N’a pas voté';
      statusClass = 'tag tag-danger';
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

const avatarUrl = (seed) =>
  `https://api.dicebear.com/9.x/notionists-neutral/svg?seed=${encodeURIComponent(seed)}&backgroundColor=e9e8e2,f1f1ec,ffffff`;

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

watch(() => store.volume, (newVol) => {
  if (audio) audio.volume = newVol;
});

const startAudio = () => {
  audioError.value = false;
  if (audio) audio.pause();

  if (store.currentMusic?.file_path) {
    const url = formatAudioUrl(store.currentMusic.file_path);
    audio = new Audio(url);
    audio.volume = store.volume;

    audio.onerror = () => { audioError.value = true; };

    if (status.value === 'listening') {
      audio.play().catch(err => {
        console.warn('Autoplay was blocked or audio failed:', err);
        if (err.name !== 'NotAllowedError') audioError.value = true;
      });
    }
  }
};

const retryAudio = () => {
  audioError.value = false;
  if (audio) {
    audio.play().catch(err => {
      console.error('Manual replay failed:', err);
      audioError.value = true;
    });
  } else {
    startAudio();
  }
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
  if (!store.player) {
    router.push(`/game/${route.params.code}`);
    return;
  }

  await store.loadSession(route.params.code);
  store.connectSocket(route.params.code);

  updateTimer();
  timerInterval = setInterval(updateTimer, 1000);

  startAudio();
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval);
  if (audio) audio.pause();
  window.removeEventListener('keydown', handleKeyDown);
});

watch(() => store.currentMusic?.id, () => {
  selectedVoteId.value = null;
  blindTestSelectedAnswer.value = null;
  startAudio();
});

watch(() => status.value, (newStatus) => {
  if (newStatus === 'listening') {
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(e => console.warn(e));
    } else {
      startAudio();
    }
  } else if (audio) {
    audio.pause();
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
