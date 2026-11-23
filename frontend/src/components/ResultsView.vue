<template>
  <div class="game-layout">
    <GameHeader
      title="Résultats"
      subtitle="Session terminée. Voici ce que la playlist a révélé."
      :step="4"
    >
      <template #actions>
        <button type="button" class="btn btn-secondary" :disabled="!store.ranking.length" @click="exportImage">
          <AppIcon name="download" :size="15" />
          Partager les scores
        </button>
        <button v-if="isHost" type="button" class="btn btn-primary" @click="replay">
          <AppIcon name="rotate-cw" :size="15" />
          Rejouer
        </button>
      </template>
    </GameHeader>

    <main class="game-shell game-body">
      <div v-if="!store.ranking.length" class="empty-state">
        <AppIcon name="bar-chart" :size="20" />
        <strong>Aucun résultat pour l’instant</strong>
        <p>Les scores apparaîtront quand la partie sera terminée.</p>
      </div>

      <div v-else class="results-stack">
        <!-- Winner & runners-up -->
        <section aria-label="Podium">
          <div class="winner">
            <span class="winner-rank">Vainqueur</span>
            <div class="winner-main">
              <img
                v-if="podium[0].avatar_seed"
                :src="avatarUrl(podium[0].avatar_seed)"
                class="avatar"
                alt=""
              />
              <span v-else class="avatar avatar-fallback" style="font-size: 18px">
                {{ initials(podium[0].name) }}
              </span>
              <div style="min-width: 0">
                <p class="winner-name">{{ podium[0].name }}</p>
                <p class="winner-meta">
                  {{ scoreDetails(podium[0]) }}
                </p>
              </div>
            </div>
            <p class="winner-score">
              {{ podium[0].score }}<small> pts</small>
            </p>
          </div>

          <div v-if="podium.length > 1" class="runner-ups" style="margin-top: 12px">
            <div
              v-for="(player, index) in podium.slice(1, 3)"
              :key="player.id"
              class="runner"
            >
              <span class="runner-rank">{{ String(player.rank ?? (index + 2)).padStart(2, '0') }}</span>
              <img
                v-if="player.avatar_seed"
                :src="avatarUrl(player.avatar_seed)"
                class="avatar avatar-sm"
                alt=""
              />
              <span v-else class="avatar avatar-sm avatar-fallback">{{ initials(player.name) }}</span>
              <div style="min-width: 0">
                <p class="rank-name">{{ player.name }}</p>
                <p class="rank-sub">{{ scoreDetails(player) }}</p>
              </div>
              <p class="runner-score">{{ player.score }}<small class="faint"> pts</small></p>
            </div>
          </div>
        </section>

        <!-- Full ranking -->
        <section class="panel panel-pad" aria-labelledby="ranking-heading">
          <div class="panel-head">
            <div>
              <h2 id="ranking-heading" class="panel-title">
                <AppIcon name="bar-chart" :size="16" />
                Classement complet
              </h2>
              <p class="panel-sub">
                {{ store.ranking.length }} joueur{{ store.ranking.length > 1 ? 's' : '' }} classé{{ store.ranking.length > 1 ? 's' : '' }},
                du premier au dernier · mode {{ scoringModeLabel }}.
              </p>
            </div>
          </div>

          <div>
            <div v-for="(player, idx) in store.ranking" :key="player.id" class="rank-row">
              <span class="rank-index">{{ String(player.rank ?? (idx + 1)).padStart(2, '0') }}</span>
              <div class="rank-main">
                <img
                  v-if="player.avatar_seed"
                  :src="avatarUrl(player.avatar_seed)"
                  class="avatar"
                  alt=""
                />
                <span v-else class="avatar avatar-fallback">{{ initials(player.name) }}</span>
                <div style="min-width: 0">
                  <p class="rank-name">
                    {{ player.name }}
                    <span v-if="player.id === store.player?.id" class="tag tag-accent" style="margin-left: 4px">Vous</span>
                    <span v-if="player.id === store.session?.host_player_id" class="tag" style="margin-left: 4px">Hôte</span>
                    <span v-if="player.is_bot" class="tag" style="margin-left: 4px">Bot</span>
                    <span v-if="player.is_observer" class="tag" style="margin-left: 4px">Spectateur</span>
                  </p>
                  <p class="rank-sub">{{ scoreDetails(player) }}</p>
                </div>
              </div>
              <p class="rank-score">{{ player.score }}<small> pts</small></p>
            </div>
          </div>
        </section>

        <!-- Game stats -->
        <section class="stats-strip" aria-label="Statistiques de la partie">
          <div class="stat-cell">
            <p class="stat-label">Morceaux joués</p>
            <p class="stat-value">{{ totalTracks }} <span>titre{{ totalTracks > 1 ? 's' : '' }}</span></p>
          </div>
          <div class="stat-cell">
            <p class="stat-label">Meilleur détective</p>
            <p v-if="bestDetective" class="stat-value">
              {{ bestDetective.name }}
              <span>({{ bestDetective.correctAccusations }} accusation{{ bestDetective.correctAccusations > 1 ? 's' : '' }})</span>
            </p>
            <p v-else class="stat-value faint">Aucun</p>
          </div>
          <div class="stat-cell">
            <p class="stat-label">Le plus suspecté</p>
            <p v-if="mostSuspected" class="stat-value">
              {{ mostSuspected.name }}
              <span>({{ mostSuspected.votesReceived }} vote{{ mostSuspected.votesReceived > 1 ? 's' : '' }} reçu{{ mostSuspected.votesReceived > 1 ? 's' : '' }})</span>
            </p>
            <p v-else class="stat-value faint">Aucun</p>
          </div>
        </section>

        <!-- Music lineup -->
        <section v-if="store.musics.length" class="panel panel-pad" aria-labelledby="music-heading">
          <div class="panel-head">
            <div>
              <h2 id="music-heading" class="panel-title">
                <AppIcon name="music" :size="16" />
                La playlist
              </h2>
              <p class="panel-sub">Tout ce que le salon a écouté ce soir.</p>
            </div>
            <span class="count-pill">{{ store.musics.length }}</span>
          </div>

          <div class="row-list">
            <div v-for="music in store.musics" :key="music.id" class="row">
              <div class="media-row">
                <img
                  v-if="music.cover_url"
                  :src="music.cover_url"
                  class="media-cover"
                  :alt="`Pochette de ${music.title}`"
                  loading="lazy"
                />
                <span v-else class="media-cover media-cover-fallback">
                  <AppIcon name="music" :size="18" />
                </span>
                <div class="media-text">
                  <p class="media-title">{{ music.title }}</p>
                  <p class="media-sub">{{ music.artist }}</p>
                </div>
              </div>
              <span class="tag">par {{ getPlayerName(music.player_id) }}</span>
            </div>
          </div>
        </section>
      </div>
    </main>

    <!-- Export dialog -->
    <Transition name="fade">
      <div v-if="showExportModal" class="overlay" @click.self="showExportModal = false">
        <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="export-title">
          <div class="dialog-head">
            <div>
              <h2 id="export-title" class="dialog-title">Résumé de la partie</h2>
              <p class="panel-sub">Une carte à partager avec le groupe.</p>
            </div>
            <button ref="exportClose" type="button" class="btn btn-ghost btn-icon btn-sm" aria-label="Fermer" @click="showExportModal = false">
              <AppIcon name="x" :size="16" />
            </button>
          </div>

          <div style="padding: 18px 0">
            <div class="export-preview">
              <img :src="exportImageUrl" alt="Résumé des scores de la partie" />
            </div>
            <p class="hint" style="text-align: center; margin-top: 10px">
              Appui long ou clic droit sur l’image pour l’enregistrer.
            </p>
          </div>

          <div class="dialog-actions">
            <a :href="exportImageUrl" :download="exportImageFilename" class="btn btn-primary btn-block">
              <AppIcon name="download" :size="15" />
              Télécharger l’image
            </a>
            <button type="button" class="btn btn-secondary btn-block" @click="showExportModal = false">
              Fermer
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useGameStore } from '../stores/gameStore';
import { avatarUrl } from '../utils/avatar';
import GameHeader from './GameHeader.vue';
import AppIcon from './AppIcon.vue';

const route = useRoute();
const router = useRouter();
const store = useGameStore();

const isHost = computed(() => store.isHost);

const podium = computed(() => store.ranking.slice(0, 3));

const scoringModeLabel = computed(() => ({
  detective: 'Détective',
  balanced: 'Équilibré',
  bluff: 'Bluff',
}[store.session?.scoring_mode] || 'Équilibré'));

const totalTracks = computed(() => store.musics.length);

const scoreDetails = (player) => {
  if (!player) return '';
  const accusations = player.correctAccusations || 0;
  const bluff = player.bluffPoints || 0;
  const blind = player.blindTestCorrect || 0;
  const parts = [`${accusations} accusation${accusations > 1 ? 's' : ''}`];
  if (bluff > 0) parts.push(`${bluff} pt${bluff > 1 ? 's' : ''} de bluff`);
  if (blind > 0) parts.push(`${blind} blind test${blind > 1 ? 's' : ''}`);
  return parts.join(' · ');
};

const bestDetective = computed(() => {
  let best = null;
  let maxCorrect = -1;
  store.ranking.forEach(p => {
    const correct = p.correctAccusations || 0;
    if (correct > maxCorrect) {
      maxCorrect = correct;
      best = p;
    }
  });
  return maxCorrect > 0 ? best : null;
});

const mostSuspected = computed(() => {
  let suspect = null;
  let maxVotes = -1;
  store.ranking.forEach(p => {
    if (p.votesReceived > maxVotes) {
      maxVotes = p.votesReceived;
      suspect = p;
    }
  });
  return maxVotes > 0 ? suspect : null;
});

const getPlayerName = (id) => {
  const p = store.players.find(player => player.id === id);
  return p ? p.name : 'Inconnu';
};

const initials = (name) =>
  (name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();

const handleKeyDown = (e) => {
  if (e.key === 'Escape' && showExportModal.value) {
    showExportModal.value = false;
    return;
  }
  if (e.code === 'Space' && isHost.value && !showExportModal.value) {
    const isInteractive = ['INPUT', 'TEXTAREA', 'BUTTON', 'A', 'SELECT'].includes(document.activeElement?.tagName);
    if (!isInteractive) {
      e.preventDefault();
      replay();
    }
  }
};

onMounted(async () => {
  if (route.path === '/test-export') {
    store.ranking = [
      { id: '1', name: 'Lucas', score: 120, correctAccusations: 5, bluffPoints: 3, blindTestCorrect: 1, votesReceived: 2, is_bot: false, avatar_seed: 'fVyG60h8GX5iVQBD' },
      { id: '2', name: 'Sophie (Bot)', score: 95, correctAccusations: 4, bluffPoints: 2, blindTestCorrect: 1, votesReceived: 3, is_bot: true, avatar_seed: 'or6bBXdiiaz0jng4' },
      { id: '3', name: 'Alex', score: 80, correctAccusations: 3, bluffPoints: 2, blindTestCorrect: 0, votesReceived: 4, is_bot: false, avatar_seed: 'Cm0YdR_hifPYKJX1' },
      { id: '4', name: 'Thomas', score: 65, correctAccusations: 2, bluffPoints: 1, blindTestCorrect: 0, votesReceived: 1, is_bot: false, avatar_seed: 'Ooique6iYoWUQtPm' },
      { id: '5', name: 'Emma', score: 40, correctAccusations: 1, bluffPoints: 1, blindTestCorrect: 0, votesReceived: 5, is_bot: false, avatar_seed: 'bLBps-pksgS4ROQp' },
    ];
    store.players = [
      { id: '1', name: 'Lucas', is_connected: true, is_bot: false },
      { id: '2', name: 'Sophie (Bot)', is_connected: true, is_bot: true },
      { id: '3', name: 'Alex', is_connected: true, is_bot: false },
      { id: '4', name: 'Thomas', is_connected: true, is_bot: false },
      { id: '5', name: 'Emma', is_connected: true, is_bot: false },
    ];
    store.musics = [
      { id: 'm1', title: 'Get Lucky', artist: 'Daft Punk', proposer_id: '1', player_id: '1', cover_url: '' },
      { id: 'm2', title: 'Billie Jean', artist: 'Michael Jackson', proposer_id: '2', player_id: '2', cover_url: '' },
      { id: 'm3', title: 'Blinding Lights', artist: 'The Weeknd', proposer_id: '3', player_id: '3', cover_url: '' },
      { id: 'm4', title: 'Shape of You', artist: 'Ed Sheeran', proposer_id: '4', player_id: '4', cover_url: '' },
      { id: 'm5', title: 'Bohemian Rhapsody', artist: 'Queen', proposer_id: '5', player_id: '5', cover_url: '' },
    ];
    store.session = {
      code: 'TEST12',
      phase: 'results',
      host_name: 'Lucas'
    };
    return;
  }

  await store.loadSession(route.params.code);
  if (!store.token || !store.player || store.player.session_id !== store.session?.id) {
    router.push(`/game/${route.params.code}`);
    return;
  }
  await store.loadResults(route.params.code);
  store.connectSocket(route.params.code);
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
  document.body.style.overflow = '';
});

watch(() => store.session?.phase, (newPhase) => {
  if (newPhase === 'waiting') {
    router.push(`/game/${route.params.code}`);
  }
});

const replay = async () => {
  if (!isHost.value) return;
  try {
    await store.resetSession();
  } catch (err) {
    console.error('Failed to reset session:', err);
  }
};

const showExportModal = ref(false);
const exportClose = ref(null);
const exportImageUrl = ref('');

watch(showExportModal, async (open) => {
  document.body.style.overflow = open ? 'hidden' : '';
  if (open) {
    await nextTick();
    exportClose.value?.focus();
  }
});

const exportImageFilename = computed(() => {
  const code = store.session?.code || 'game';
  return `cekikilami_scores_${code}.png`;
});

const truncateText = (text, maxLength) => {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength - 1) + '…' : text;
};

const avatarImageCache = new Map();

const loadAvatarImage = (seed) => {
  if (!seed) return Promise.resolve(null);
  if (avatarImageCache.has(seed)) return avatarImageCache.get(seed);

  const promise = new Promise((resolve) => {
    const image = new Image();
    const timer = setTimeout(() => resolve(null), 5000);
    image.onload = () => {
      clearTimeout(timer);
      resolve(image);
    };
    image.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    image.src = avatarUrl(seed);
  });
  avatarImageCache.set(seed, promise);
  return promise;
};

const drawAvatar = (ctx, image, cx, cy, radius, fallback, ringColor = 'rgba(255, 248, 237, 0.95)') => {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  if (image) {
    const scale = Math.max((radius * 2) / image.width, (radius * 2) / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    ctx.drawImage(image, cx - width / 2, cy - height / 2, width, height);
  } else {
    ctx.fillStyle = 'rgba(46, 27, 63, 0.08)';
    ctx.fill();
    ctx.fillStyle = '#644f72';
    ctx.font = `700 ${Math.max(9, Math.round(radius * 0.55))}px Archivo, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(fallback, cx, cy);
    ctx.textBaseline = 'alphabetic';
  }
  ctx.restore();

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = ringColor;
  ctx.lineWidth = 2;
  ctx.stroke();
};

const drawRoundedRect = (ctx, x, y, width, height, radius, fillStyle, strokeStyle, strokeWidth = 1) => {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = strokeWidth;
    ctx.stroke();
  }
};

const drawGlowBlob = (ctx, x, y, r, color) => {
  const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
};

const exportImage = async () => {
  const ranking = store.ranking || [];
  const first = ranking[0];
  const second = ranking[1];
  const third = ranking[2];

  const avatarImages = new Map();
  await Promise.all(ranking.map(async (player) => {
    const image = await loadAvatarImage(player.avatar_seed);
    if (image) avatarImages.set(player.id, image);
  }));

  const remainingPlayersCount = Math.max(0, ranking.length - 3);
  const panelHeight = Math.max(220, 85 + remainingPlayersCount * 40);
  const canvasHeight = 450 + panelHeight + 110;

  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');

  // Paper background
  const bgGrad = ctx.createRadialGradient(400, canvasHeight / 2, 50, 400, canvasHeight / 2, Math.max(600, canvasHeight));
  bgGrad.addColorStop(0, '#fff8ed');
  bgGrad.addColorStop(0.7, '#f6ead9');
  bgGrad.addColorStop(1, '#eadfe9');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 800, canvasHeight);

  drawGlowBlob(ctx, 130, 140, 300, 'rgba(107, 60, 224, 0.16)');
  drawGlowBlob(ctx, 670, canvasHeight - 140, 300, 'rgba(228, 86, 159, 0.10)');

  // Header
  ctx.fillStyle = '#2e1b3f';
  ctx.font = '800 38px Archivo, system-ui, -apple-system, sans-serif';
  ctx.fillText('CÉKIKILAMI', 50, 75);

  ctx.fillStyle = '#644f72';
  ctx.font = '600 14px Archivo, system-ui, sans-serif';
  ctx.fillText(`Classement final — salon ${store.session?.code || ''}`, 50, 108);

  const dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  ctx.fillStyle = '#6f5b7a';
  ctx.font = '500 13px ui-monospace, monospace';
  ctx.textAlign = 'right';
  ctx.fillText(dateStr, 750, 108);
  ctx.textAlign = 'left';

  ctx.beginPath();
  ctx.moveTo(50, 132);
  ctx.lineTo(750, 132);
  ctx.strokeStyle = 'rgba(46, 27, 63, 0.16)';
  ctx.lineWidth = 1;
  ctx.stroke();

  const podiumStats = (player) => {
    const parts = [];
    if (player.correctAccusations) {
      parts.push(`${player.correctAccusations} accusation${player.correctAccusations > 1 ? 's' : ''}`);
    }
    if (player.bluffPoints) parts.push(`${player.bluffPoints} bluff`);
    if (player.blindTestCorrect) parts.push(`${player.blindTestCorrect} blind`);
    return parts.length ? parts.join(' · ') : 'Aucun point';
  };

  // Podium
  const drawPodiumCard = (x, y, w, h, radius, player, rank, accent, border) => {
    if (!player) return;

    ctx.save();
    ctx.shadowColor = 'rgba(46, 27, 63, 0.12)';
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 12;
    drawRoundedRect(ctx, x, y, w, h, radius, 'rgba(255, 248, 237, 0.94)', border, 1.5);
    ctx.restore();

    const avatarX = x + w / 2;
    const avatarY = y + 44;
    drawAvatar(
      ctx,
      avatarImages.get(player.id),
      avatarX,
      avatarY,
      26,
      initials(player.name),
      'rgba(255, 248, 237, 0.95)'
    );

    const badgeX = avatarX + 21;
    const badgeY = avatarY + 21;
    ctx.beginPath();
    ctx.arc(badgeX, badgeY, 11, 0, Math.PI * 2);
    ctx.fillStyle = accent;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 248, 237, 0.95)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = '700 11px Archivo, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(rank), badgeX, badgeY);
    ctx.textBaseline = 'alphabetic';

    if (rank === 1) {
      ctx.fillStyle = '#6f5b7a';
      ctx.font = '600 9px Archivo, sans-serif';
      ctx.fillText('VAINQUEUR', avatarX, y + 86);
    }

    ctx.fillStyle = '#2e1b3f';
    ctx.font = '700 15px Archivo, system-ui, sans-serif';
    ctx.fillText(truncateText(player.name, player.is_bot ? 14 : 16), avatarX, y + h - 72);

    const scoreText = String(player.score ?? 0);
    ctx.fillStyle = accent;
    ctx.font = '700 26px ui-monospace, monospace';
    ctx.fillText(scoreText, avatarX - 12, y + h - 42);
    ctx.fillStyle = '#644f72';
    ctx.font = '500 11px Archivo, sans-serif';
    ctx.fillText('pts', avatarX + (scoreText.length * 8), y + h - 42);

    ctx.fillStyle = '#6f5b7a';
    ctx.font = '500 10px Archivo, sans-serif';
    ctx.fillText(podiumStats(player), avatarX, y + h - 16);
  };

  ctx.textAlign = 'center';
  drawPodiumCard(110, 235, 180, 185, 18, second, 2, '#2b8ed6', 'rgba(43, 142, 214, 0.28)');
  drawPodiumCard(310, 195, 180, 225, 20, first, 1, '#6b3ce0', 'rgba(107, 60, 224, 0.40)');
  drawPodiumCard(510, 250, 180, 170, 16, third, 3, '#b8315f', 'rgba(228, 86, 159, 0.25)');
  ctx.textAlign = 'left';

  drawRoundedRect(ctx, 50, 450, 700, panelHeight, 16, 'rgba(255, 248, 237, 0.9)', 'rgba(46, 27, 63, 0.12)', 1);

  ctx.fillStyle = '#6f5b7a';
  ctx.font = '600 11px ui-monospace, monospace';
  ctx.fillText('Suite du classement', 70, 485);

  let yOffset = 515;
  if (ranking.length <= 3) {
    ctx.fillStyle = '#6f5b7a';
    ctx.font = 'italic 13px Archivo, sans-serif';
    ctx.fillText('Aucun autre joueur', 70, 515);
  } else {
    for (let i = 3; i < ranking.length; i++) {
      const p = ranking[i];

      drawRoundedRect(ctx, 70, yOffset - 16, 32, 22, 6, 'rgba(46, 27, 63, 0.04)', 'rgba(46, 27, 63, 0.1)', 1);

      ctx.fillStyle = '#644f72';
      ctx.font = '600 11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`#${i + 1}`, 86, yOffset - 1);

      drawAvatar(
        ctx,
        avatarImages.get(p.id),
        122,
        yOffset - 5,
        12,
        initials(p.name),
        'rgba(46, 27, 63, 0.12)'
      );

      ctx.fillStyle = '#2e1b3f';
      ctx.font = '600 13px Archivo, system-ui, sans-serif';
      ctx.textAlign = 'left';
      let displayName = p.name;
      if (p.is_bot) displayName += ' (Bot)';
      ctx.fillText(truncateText(displayName, 14), 146, yOffset);

      ctx.fillStyle = '#5227c4';
      ctx.font = '600 13px ui-monospace, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${p.score} pts`, 370, yOffset);
      ctx.textAlign = 'left';

      ctx.beginPath();
      ctx.moveTo(70, yOffset + 12);
      ctx.lineTo(370, yOffset + 12);
      ctx.strokeStyle = 'rgba(46, 27, 63, 0.07)';
      ctx.stroke();

      yOffset += 40;
    }
  }

  ctx.beginPath();
  ctx.moveTo(400, 470);
  ctx.lineTo(400, 450 + panelHeight - 25);
  ctx.strokeStyle = 'rgba(46, 27, 63, 0.12)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#6f5b7a';
  ctx.font = '600 11px ui-monospace, monospace';
  ctx.fillText('Statistiques', 430, 485);

  const totalTracks = store.musics.length;

  let bestDetective = null;
  let maxCorrect = 0;
  ranking.forEach(p => {
    const correct = p.correctAccusations || 0;
    if (correct > maxCorrect) {
      maxCorrect = correct;
      bestDetective = p.name;
    }
  });

  let mostSuspected = null;
  let maxVotes = 0;
  ranking.forEach(p => {
    if (p.votesReceived > maxVotes) {
      maxVotes = p.votesReceived;
      mostSuspected = p.name;
    }
  });

  let statsY = 525;

  const drawStatItem = (icon, title, value, valColor) => {
    ctx.font = '22px system-ui';
    ctx.fillText(icon, 430, statsY - 2);

    ctx.fillStyle = '#6f5b7a';
    ctx.font = '600 11px Archivo, sans-serif';
    ctx.fillText(title, 468, statsY - 10);

    ctx.fillStyle = valColor || '#2e1b3f';
    ctx.font = '700 14px Archivo, system-ui, sans-serif';
    ctx.fillText(value, 468, statsY + 8);

    statsY += 52;
  };

  drawStatItem('🎵', 'Morceaux joués', `${totalTracks} titres proposés`, '#644f72');

  if (bestDetective) {
    drawStatItem('🎯', 'Meilleur détective', `${bestDetective} (${maxCorrect} accusation${maxCorrect > 1 ? 's' : ''})`, '#2c7a6e');
  } else {
    drawStatItem('🎯', 'Meilleur détective', 'Aucune accusation réussie', '#6f5b7a');
  }

  if (mostSuspected) {
    drawStatItem('💜', 'Le plus suspecté', `${mostSuspected} (${maxVotes} vote${maxVotes > 1 ? 's' : ''} reçu${maxVotes > 1 ? 's' : ''})`, '#5227c4');
  } else {
    drawStatItem('💜', 'Le plus suspecté', 'Aucun vote reçu', '#6f5b7a');
  }

  ctx.beginPath();
  ctx.moveTo(50, 450 + panelHeight + 25);
  ctx.lineTo(750, 450 + panelHeight + 25);
  ctx.strokeStyle = 'rgba(46, 27, 63, 0.12)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#6f5b7a';
  ctx.font = '500 13px Archivo, system-ui, sans-serif';
  ctx.fillText('Cékikilami · jeu de musique entre amis', 400, 450 + panelHeight + 65);
  ctx.textAlign = 'left';

  exportImageUrl.value = canvas.toDataURL('image/png');
  showExportModal.value = true;
};
</script>
