<template>
  <div :class="['room-code', `room-code-${size}`, { 'is-revealed': revealed }]">
    <button
      type="button"
      class="room-code-text"
      :aria-label="revealed ? `Masquer le code ${code}` : `Afficher le code ${code}`"
      :title="revealed ? 'Masquer le code' : 'Afficher le code'"
      :aria-pressed="revealed"
      @click="revealed = !revealed"
    >
      {{ code }}
    </button>
    <span class="room-code-actions">
      <button
        type="button"
        class="room-code-btn"
        :class="{ 'is-done': copiedAction === 'code' }"
        :aria-label="copiedAction === 'code' ? 'Code copié' : 'Copier le code du salon'"
        :title="copiedAction === 'code' ? 'Code copié' : 'Copier le code du salon'"
        @click="copyCode"
      >
        <AppIcon :name="copiedAction === 'code' ? 'check' : 'copy'" :size="size === 'sm' ? 13 : 16" />
      </button>
      <button
        type="button"
        class="room-code-btn"
        :class="{ 'is-done': copiedAction === 'link' }"
        :aria-label="copiedAction === 'link' ? 'Lien copié' : 'Copier le lien d’invitation'"
        :title="copiedAction === 'link' ? 'Lien copié' : 'Copier le lien d’invitation'"
        @click="copyLink"
      >
        <AppIcon :name="copiedAction === 'link' ? 'check' : 'link'" :size="size === 'sm' ? 13 : 16" />
      </button>
    </span>
    <span class="sr-only" role="status">{{ copiedMessage }}</span>
  </div>
</template>

<script setup>
import { computed, onUnmounted, ref, watch } from 'vue';
import AppIcon from './AppIcon.vue';

const props = defineProps({
  code: { type: String, required: true },
  size: { type: String, default: 'md' },
});

const revealed = ref(false);
const copiedAction = ref(null);
let copiedTimer = null;

const copiedMessage = computed(() => {
  if (copiedAction.value === 'code') return 'Code du salon copié.';
  if (copiedAction.value === 'link') return 'Lien d’invitation copié.';
  return '';
});

const clearCopiedTimer = () => {
  if (copiedTimer) {
    window.clearTimeout(copiedTimer);
    copiedTimer = null;
  }
};

watch(() => props.code, () => {
  revealed.value = false;
  copiedAction.value = null;
  clearCopiedTimer();
});

const copyValue = async (value, action) => {
  try {
    await navigator.clipboard.writeText(value);
    copiedAction.value = action;
    clearCopiedTimer();
    copiedTimer = window.setTimeout(() => { copiedAction.value = null; }, 2000);
  } catch {
    /* clipboard unavailable */
  }
};

const copyCode = () => copyValue(props.code, 'code');
const copyLink = () => copyValue(`${window.location.origin}/game/${props.code}`, 'link');

onUnmounted(clearCopiedTimer);
</script>
