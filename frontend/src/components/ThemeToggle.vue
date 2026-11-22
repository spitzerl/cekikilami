<script setup>
import { theme, toggleTheme } from '../services/themeService';
import AppIcon from './AppIcon.vue';
</script>

<template>
  <button
    type="button"
    class="btn btn-ghost btn-icon theme-toggle"
    :aria-label="theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre'"
    :title="theme === 'dark' ? 'Thème clair' : 'Thème sombre'"
    @click="toggleTheme"
  >
    <AppIcon :name="theme === 'dark' ? 'sun' : 'moon'" :size="18" />
  </button>
</template>
