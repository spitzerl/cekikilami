<template>
  <div class="home">
    <header class="home-top shell">
      <RouterLink to="/" class="brand brand-link" aria-label="Cékikilami, accueil">
        <span class="brand-mark" aria-hidden="true"></span>
        Cékikilami
      </RouterLink>
      <span class="spacer"></span>
      <RouterLink to="/" class="text-link">Accueil</RouterLink>
    </header>

    <main class="home-main shell" style="align-items: center">
      <section class="panel panel-pad reveal" style="width: 100%; max-width: 420px">
        <h1 class="console-title">Rejoindre une partie</h1>
        <p class="console-sub">Entrez le code partagé par l’hôte.</p>

        <form @submit.prevent="submit">
          <div class="field">
            <label for="join-code" class="label">Code du salon</label>
            <input
              id="join-code"
              v-model="code"
              required
              maxlength="6"
              class="input input-code"
              placeholder="ABCDEF"
              autocomplete="off"
              autocapitalize="characters"
              spellcheck="false"
            />
          </div>
          <div class="field">
            <label for="join-name" class="label">Votre pseudo</label>
            <input
              id="join-name"
              v-model="name"
              required
              class="input"
              placeholder="Ex. Lucas"
              autocomplete="nickname"
              maxlength="32"
            />
          </div>
          <button type="submit" class="btn btn-primary btn-block btn-lg" style="margin-top: 16px">
            <AppIcon name="log-in" :size="16" />
            Rejoindre
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

const router = useRouter();
const store = useGameStore();
const code = ref('');
const name = ref('');

const submit = async () => {
  const sessionCode = code.value.trim().toUpperCase();
  await store.joinSession(sessionCode, name.value);
  store.connectSocket(sessionCode);
  router.push(`/game/${sessionCode}`);
};
</script>
