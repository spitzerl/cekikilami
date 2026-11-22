<template>
  <header class="topbar">
    <div class="shell topbar-inner">
      <span class="brand">
        <span class="brand-mark" aria-hidden="true"></span>
        Cékikilami
      </span>
      <span class="spacer"></span>

      <button
        v-if="code && showCode"
        type="button"
        class="code-chip"
        :aria-label="`Copier le lien d'invitation, code ${code}`"
        @click="copyCode"
      >
        <span class="code-chip-label">Salon</span>
        <span class="code-chip-value">{{ code }}</span>
        <AppIcon :name="copied ? 'check' : 'copy'" :size="13" />
      </button>

      <button
        type="button"
        class="btn btn-ghost btn-icon"
        aria-label="Ouvrir le menu de la partie"
        @click="openMenu"
      >
        <AppIcon name="menu" :size="19" />
      </button>
      <span class="sr-only" aria-live="polite">{{ copied ? 'Lien d’invitation copié' : '' }}</span>
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
          <span class="step-num">{{ String(index + 1).padStart(2, '0') }}</span>
          <span class="step-label">{{ label }}</span>
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
</template>

<script setup>
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useGameStore } from '../stores/gameStore';
import AppIcon from './AppIcon.vue';

defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  step: { type: Number, default: 1 },
  showCode: { type: Boolean, default: true },
});

const store = useGameStore();
const route = useRoute();
const copied = ref(false);

const steps = ['Salon', 'Sélection', 'Écoute & vote', 'Résultats'];

const code = computed(() => store.session?.code || route.params.code || '');

const copyCode = async () => {
  try {
    await navigator.clipboard.writeText(`${window.location.origin}/game/${code.value}`);
    copied.value = true;
    window.setTimeout(() => { copied.value = false; }, 2000);
  } catch {
    /* clipboard unavailable — no-op */
  }
};

const openMenu = () => {
  window.dispatchEvent(new CustomEvent('open-pause-menu'));
};
</script>
