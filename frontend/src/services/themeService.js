import { ref } from 'vue';

const STORAGE_KEY = 'cekikilami_theme';
const META_COLORS = {
  dark: '#150f24',
  light: '#f6ead9',
};

const readStoredTheme = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
};

export const theme = ref(readStoredTheme());

export const applyTheme = (value) => {
  const next = value === 'light' ? 'light' : 'dark';
  theme.value = next;

  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = next;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', META_COLORS[next]);
  }

  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* storage unavailable — the theme still applies for this session */
  }

  return next;
};

export const setTheme = (value) => applyTheme(value);

export const toggleTheme = () => applyTheme(theme.value === 'dark' ? 'light' : 'dark');

export const initTheme = () => applyTheme(readStoredTheme());
