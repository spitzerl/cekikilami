<template>
  <div :class="['room-code', `room-code-${size}`, { 'is-revealed': revealed }]">
    <span class="room-code-text">{{ code }}</span>
    <span class="room-code-actions">
      <button
        type="button"
        class="room-code-btn"
        :aria-label="revealed ? 'Masquer le code' : 'Afficher le code'"
        :title="revealed ? 'Masquer le code' : 'Afficher le code'"
        :aria-pressed="revealed"
        @click="revealed = !revealed"
      >
        <AppIcon :name="revealed ? 'eye-off' : 'eye'" :size="size === 'sm' ? 14 : 17" />
      </button>
      <button
        type="button"
        class="room-code-btn"
        :class="{ 'is-done': copied }"
        :aria-label="copied ? 'Lien copié' : 'Copier le lien d’invitation'"
        :title="copied ? 'Lien copié' : 'Copier le lien d’invitation'"
        @click="copy"
      >
        <AppIcon :name="copied ? 'check' : 'copy'" :size="size === 'sm' ? 13 : 16" />
      </button>
    </span>
    <span class="sr-only" role="status">{{ copied ? 'Lien d’invitation copié.' : '' }}</span>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import AppIcon from './AppIcon.vue';

const props = defineProps({
  code: { type: String, required: true },
  size: { type: String, default: 'md' },
});

const revealed = ref(false);
const copied = ref(false);

watch(() => props.code, () => {
  revealed.value = false;
  copied.value = false;
});

const copy = async () => {
  revealed.value = true;
  try {
    await navigator.clipboard.writeText(`${window.location.origin}/game/${props.code}`);
    copied.value = true;
    window.setTimeout(() => { copied.value = false; }, 2000);
  } catch {
    /* clipboard unavailable */
  }
};
</script>
