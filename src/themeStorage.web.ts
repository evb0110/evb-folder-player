import type { TThemePreference } from './theme';
export const themeStorage = {
  async get() {
    return localStorage.getItem('folder-player-theme');
  },
  async set(value: TThemePreference) {
    localStorage.setItem('folder-player-theme', value);
  },
};
