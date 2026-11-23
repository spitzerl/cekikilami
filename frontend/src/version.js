import packageJson from '../package.json';

export const APP_VERSION = packageJson.version;
export const APP_CHANNEL = APP_VERSION.includes('-beta') ? 'beta' : 'stable';
export const APP_CHANNEL_LABEL = APP_CHANNEL === 'beta' ? 'Bêta' : 'Stable';
