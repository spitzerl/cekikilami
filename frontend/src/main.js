import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router/index.js';
import { initTheme } from './services/themeService';
import './index.css';

initTheme();

createApp(App).use(createPinia()).use(router).mount('#app');
