<template>
  <header class="topbar">
    <div class="shell topbar-inner">
      <RouterLink v-slot="{ href, navigate }" custom to="/">
        <a
          :href="href"
          class="brand brand-link"
          aria-label="Retour à l’accueil"
          @click="handleBrandClick($event, navigate)"
        >
          <span class="brand-mark" aria-hidden="true"></span>
          Cékikilami
        </a>
      </RouterLink>
      <span class="spacer"></span>

      <RoomCode v-if="code && showCode" :code="code" size="sm" />

      <button
        type="button"
        class="btn btn-ghost btn-icon"
        aria-label="Ouvrir le menu de la partie"
        @click="openMenu"
      >
        <AppIcon name="menu" :size="19" />
      </button>
    </div>
  </header>

  <section class="shell game-header-content" aria-label="En-tête de la partie">
    <nav class="stepper" aria-label="Progression de la partie">
      <ol>
        <li
          v-for="(label, index) in steps"
          :key="label"
          :class="[
            'step',
            index + 1 < step ? 'is-past' : '',
            index + 1 === step ? 'is-current' : '',
          ]"
          :aria-current="index + 1 === step ? 'step' : undefined"
        >
          <span class="sr-only">{{ label }}</span>
        </li>
      </ol>
    </nav>

    <div class="game-head">
      <div class="game-head-copy">
        <h1 class="game-title">{{ title }}</h1>
        <p v-if="subtitle" class="game-sub">{{ subtitle }}</p>
      </div>
      <div v-if="$slots.actions" class="game-actions">
        <slot name="actions" />
      </div>
    </div>
  </section>

  <Transition name="fade">
    <div v-if="showHomeConfirm" class="overlay" @click.self="closeHomeConfirm">
      <div
        ref="homeDialog"
        class="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="home-confirm-title"
        aria-describedby="home-confirm-desc"
        @keydown="handleHomeDialogKeydown"
      >
        <div class="dialog-head">
          <div>
            <p class="dialog-kicker">Retour à l’accueil</p>
            <h2 id="home-confirm-title" class="dialog-title">{{ confirmTitle }}</h2>
          </div>
          <button
            type="button"
            class="btn btn-ghost btn-icon btn-sm"
            :aria-label="stayLabel"
            @click="closeHomeConfirm"
          >
            <AppIcon name="x" :size="16" />
          </button>
        </div>

        <p id="home-confirm-desc" class="home-confirm-text">{{ homeConfirmMessage }}</p>

        <div class="dialog-actions">
          <button ref="stayButton" type="button" class="btn btn-primary btn-block" @click="closeHomeConfirm">
            <AppIcon :name="stayIcon" :size="15" />
            {{ stayLabel }}
          </button>
          <button type="button" class="btn btn-warning btn-block" @click="goHome">
            <AppIcon name="log-out" :size="15" />
            Retourner à l’accueil
          </button>
        </div>

        <p class="hint home-confirm-hint">Vous pourrez rejoindre un salon avec son code.</p>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useGameStore } from '../stores/gameStore';
import AppIcon from './AppIcon.vue';
import RoomCode from './RoomCode.vue';

defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  step: { type: Number, default: 1 },
  showCode: { type: Boolean, default: true },
});

const store = useGameStore();
const route = useRoute();
const router = useRouter();

const steps = ['Salon', 'Sélection', 'Écoute & vote', 'Résultats'];

const code = computed(() => store.session?.code || route.params.code || '');

const isWaitingRoom = computed(() => route.path === `/game/${code.value}`);

const isFinished = computed(() => route.path.endsWith('/results'));

const showHomeConfirm = ref(false);
const homeDialog = ref(null);
const stayButton = ref(null);
let previousFocus = null;
let bodyOverflow = '';

const confirmTitle = computed(() => {
  if (isWaitingRoom.value) return 'Quitter le salon ?';
  if (isFinished.value) return 'Quitter les résultats ?';
  return 'Quitter la partie ?';
});

const stayLabel = computed(() => {
  if (isWaitingRoom.value) return 'Rester dans le salon';
  if (isFinished.value) return 'Rester sur les résultats';
  return 'Rester dans la partie';
});

const stayIcon = computed(() => {
  if (isWaitingRoom.value) return 'x';
  if (isFinished.value) return 'bar-chart';
  return 'play';
});

const homeConfirmMessage = computed(() => {
  if (isWaitingRoom.value) {
    return 'Vous êtes dans le salon d’attente. En revenant à l’accueil, vous quitterez ce salon.';
  }
  if (isFinished.value) {
    return 'La partie est terminée. En revenant à l’accueil, vous quitterez le salon.';
  }
  return 'Une partie est en cours. En revenant à l’accueil, vous quitterez cette partie.';
});

const openHomeConfirm = () => {
  previousFocus = document.activeElement;
  showHomeConfirm.value = true;
};

const closeHomeConfirm = () => {
  showHomeConfirm.value = false;
};

const goHome = () => {
  closeHomeConfirm();
  store.leaveSession();
  router.push('/');
};

const handleBrandClick = (event, navigate) => {
  const isPlainClick = event.button === 0
    && !event.metaKey
    && !event.ctrlKey
    && !event.shiftKey
    && !event.altKey;

  // Modified clicks keep the browser's default behaviour (new tab, and so on).
  if (!store.session || !isPlainClick) {
    navigate(event);
    return;
  }

  event.preventDefault();
  openHomeConfirm();
};

const handleHomeDialogKeydown = (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    closeHomeConfirm();
    return;
  }

  if (event.key !== 'Tab' || !homeDialog.value) return;

  const focusable = Array.from(
    homeDialog.value.querySelectorAll('button:not([disabled]), [href]')
  ).filter((element) => element.offsetParent !== null);
  if (!focusable.length) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
};

watch(showHomeConfirm, async (open) => {
  if (open) {
    bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    await nextTick();
    stayButton.value?.focus();
    return;
  }

  document.body.style.overflow = bodyOverflow;
  if (previousFocus instanceof HTMLElement) {
    previousFocus.focus();
    previousFocus = null;
  }
});

onUnmounted(() => {
  if (showHomeConfirm.value) document.body.style.overflow = bodyOverflow;
});

const openMenu = () => {
  window.dispatchEvent(new CustomEvent('open-pause-menu'));
};
</script>
