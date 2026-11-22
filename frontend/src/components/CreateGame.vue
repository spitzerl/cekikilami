<template>
  <div class="home">
    <header class="home-top shell">
      <span class="brand">
        <span class="brand-mark" aria-hidden="true"></span>
        Cékikilami
      </span>
      <span class="spacer"></span>
      <RouterLink to="/" class="text-link">Accueil</RouterLink>
    </header>

    <main class="home-main shell" style="align-items: center">
      <section class="panel panel-pad reveal" style="width: 100%; max-width: 420px">
        <h1 class="console-title">Créer une partie</h1>
        <p class="console-sub">Vous serez l’hôte du salon.</p>

        <form @submit.prevent="submit">
          <div class="field">
            <label for="host-name" class="label">Votre pseudo</label>
            <input
              id="host-name"
              v-model="hostName"
              required
              class="input"
              placeholder="Ex. Lucas"
              autocomplete="nickname"
              maxlength="32"
            />
          </div>
          <button type="submit" class="btn btn-primary btn-block btn-lg" style="margin-top: 16px">
            <AppIcon name="play" :size="16" />
            Créer le salon
          </button>
        </form>
      </section>
    </main>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useGameStore } from '../stores/gameStore';
import AppIcon from './AppIcon.vue';

const store = useGameStore();
const router = useRouter();
const hostName = ref('');

const submit = async () => {
  const { session } = await store.createSession(hostName.value);
  store.connectSocket(session.code);
  router.push(`/game/${session.code}`);
};
</script>
