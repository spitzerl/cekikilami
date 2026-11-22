<template>
  <div class="app-root">
    <div class="toasts" aria-live="polite" aria-atomic="false">
      <TransitionGroup name="toast">
        <div
          v-for="notif in store.notifications"
          :key="notif.id"
          :class="['toast', `toast-${notif.type || 'info'}`]"
          role="status"
        >
          <AppIcon
            :name="getNotifIcon(notif.type)"
            :size="17"
            :style="{ color: getNotifColor(notif.type), flexShrink: 0, marginTop: '1px' }"
          />
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

const getNotifColor = (type) => {
  if (type === 'success') return 'var(--success)';
  if (type === 'warning') return 'var(--warning)';
  if (type === 'error') return 'var(--danger)';
  return 'var(--accent)';
};
</script>
