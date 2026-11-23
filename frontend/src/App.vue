<template>
  <div class="app-root">
    <div class="toasts" aria-live="polite" aria-atomic="false">
      <TransitionGroup name="toast">
        <div
          v-for="notif in store.notifications"
          :key="notif.id"
          class="toast"
          role="status"
        >
          <span :class="['toast-icon', `toast-icon-${notif.type || 'info'}`]">
            <AppIcon :name="getNotifIcon(notif.type)" :size="16" />
          </span>
          <span class="toast-message">{{ notif.message }}</span>
          <button
            type="button"
            class="toast-close"
            aria-label="Fermer la notification"
            @click="removeNotif(notif.id)"
          >
            <AppIcon name="x" :size="15" />
          </button>
        </div>
      </TransitionGroup>
    </div>

    <PauseMenu />

    <RouterView v-slot="{ Component, route }">
      <Transition name="page" mode="out-in">
        <div :key="route.fullPath" class="page-wrap">
          <component :is="Component" />
        </div>
      </Transition>
    </RouterView>
  </div>
</template>

<script setup>
import { useGameStore } from './stores/gameStore';
import PauseMenu from './components/PauseMenu.vue';
import AppIcon from './components/AppIcon.vue';

const store = useGameStore();

const removeNotif = (id) => {
  store.notifications = store.notifications.filter(n => n.id !== id);
};

const getNotifIcon = (type) => {
  if (type === 'success') return 'check-circle';
  if (type === 'warning') return 'alert-triangle';
  if (type === 'error') return 'alert-circle';
  return 'info';
};

</script>
