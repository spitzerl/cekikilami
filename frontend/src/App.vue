<template>
  <main class="min-h-screen relative">
    <!-- Notifications Overlay -->
    <div class="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none">
      <TransitionGroup name="notification">
        <div
          v-for="notif in store.notifications"
          :key="notif.id"
          class="pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-xl shadow-lg border backdrop-blur-md transition-all duration-300"
          :class="getNotifClass(notif.type)"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <!-- Icon -->
            <component :is="getNotifIcon(notif.type)" class="w-5 h-5 flex-shrink-0" />
            <span class="text-sm font-semibold text-white truncate">{{ notif.message }}</span>
          </div>
          <!-- Close button -->
          <button @click="removeNotif(notif.id)" class="text-white/60 hover:text-white transition-colors" aria-label="Fermer la notification">
            <i class="fa-solid fa-xmark text-[14px]"></i>
          </button>
        </div>
      </TransitionGroup>
    </div>

    <!-- Pause Menu (Only when in game) -->
    <PauseMenu />

    <router-view />
  </main>
</template>

<script setup>
import { useGameStore } from './stores/gameStore';
import PauseMenu from './components/PauseMenu.vue';
import { h } from 'vue';

const store = useGameStore();

const removeNotif = (id) => {
  store.notifications = store.notifications.filter(n => n.id !== id);
};

const getNotifClass = (type) => {
  switch (type) {
    case 'success':
      return 'bg-emerald-950/80 border-emerald-500/30 text-emerald-200 shadow-emerald-950/20';
    case 'warning':
      return 'bg-amber-950/80 border-amber-500/30 text-amber-200 shadow-amber-950/20';
    case 'error':
      return 'bg-rose-950/80 border-rose-500/30 text-rose-200 shadow-rose-950/20';
    default:
      return 'bg-slate-900/80 border-slate-700/50 text-slate-200 shadow-slate-950/20';
  }
};

const getNotifIcon = (type) => {
  if (type === 'success') {
    return () => h('i', { class: 'fa-solid fa-circle-check text-emerald-400 text-[18px]' });
  }
  if (type === 'warning') {
    return () => h('i', { class: 'fa-solid fa-triangle-exclamation text-amber-400 text-[18px]' });
  }
  if (type === 'error') {
    return () => h('i', { class: 'fa-solid fa-circle-exclamation text-rose-400 text-[18px]' });
  }
  return () => h('i', { class: 'fa-solid fa-circle-info text-cyan-400 text-[18px]' });
};
</script>

<style scoped>
.notification-enter-active,
.notification-leave-active {
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
.notification-enter-from {
  opacity: 0;
  transform: translateY(-20px) scale(0.95);
}
.notification-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.95);
}
</style>
